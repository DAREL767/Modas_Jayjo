from datetime import UTC, datetime

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.infrastructure.mongodb.collections import (
    get_inventory_collection,
    get_inventory_movements_collection,
)
from app.infrastructure.mongodb.transactions import MongoTransactionRunner
from app.modules.inventory.errors import (
    DuplicateSKUError,
    InsufficientStockError,
    InvalidProductIdError,
    ProductNotFoundError,
    StockLimitExceededError,
)
from app.modules.sales.errors import ProductPriceChangedError


class InventoryRepository:
    @staticmethod
    def _collection():
        return get_inventory_collection()

    @staticmethod
    def _object_id(product_id: str) -> ObjectId:
        if not ObjectId.is_valid(product_id):
            raise InvalidProductIdError
        return ObjectId(product_id)

    async def create(self, product: dict, *, actor_id: str) -> dict:
        collection = self._collection()
        async def operation(session):
            try:
                result = await collection.insert_one(product, session=session)
            except DuplicateKeyError as exc:
                raise DuplicateSKUError from exc
            created = await collection.find_one(
                {"_id": result.inserted_id}, session=session
            )
            if created is None:
                raise RuntimeError(
                    "MongoDB insert completed but product could not be read"
                )
            if product["stock_quantity"] > 0:
                await get_inventory_movements_collection().insert_one(
                    {
                        "product_id": result.inserted_id,
                        "delta": product["stock_quantity"],
                        "reason": "initial_stock",
                        "actor_id": actor_id,
                        "stock_after": product["stock_quantity"],
                        "created_at": product["created_at"],
                    },
                    session=session,
                )
            return created

        return await MongoTransactionRunner().run(operation)

    async def get_by_id(self, product_id: str, *, session=None) -> dict | None:
        return await self._collection().find_one(
            {"_id": self._object_id(product_id)}, session=session
        )

    async def list_products(
        self, *, skip: int = 0, limit: int = 50, active_only: bool = True
    ) -> list[dict]:
        query = {"is_active": {"$ne": False}} if active_only else {}
        cursor = self._collection().find(query).sort([("name", 1), ("sku", 1)])
        return [product async for product in cursor.skip(skip).limit(limit)]

    async def update(self, product_id: str, changes: dict) -> dict | None:
        try:
            return await self._collection().find_one_and_update(
                {"_id": self._object_id(product_id)},
                {"$set": changes},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise DuplicateSKUError from exc

    async def adjust_stock(
        self, product_id: str, delta: int, reason: str, actor_id: str
    ) -> dict | None:
        product_oid = self._object_id(product_id)
        query = {"_id": product_oid, "is_active": {"$ne": False}}
        if delta < 0:
            query["stock_quantity"] = {"$gte": abs(delta)}
        else:
            query["stock_quantity"] = {"$lte": 1_000_000 - delta}

        async def operation(session):
            product = await self._collection().find_one_and_update(
                query,
                {
                    "$inc": {"stock_quantity": delta},
                    "$set": {"updated_at": datetime.now(UTC)},
                },
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            if product is None:
                existing = await self._collection().find_one(
                    {"_id": product_oid, "is_active": {"$ne": False}},
                    {"_id": 1},
                    session=session,
                )
                if existing is not None and delta < 0:
                    raise InsufficientStockError
                if existing is not None and delta > 0:
                    raise StockLimitExceededError
                return None

            await get_inventory_movements_collection().insert_one(
                {
                    "product_id": product_oid,
                    "delta": delta,
                    "reason": reason,
                    "actor_id": actor_id,
                    "stock_after": product["stock_quantity"],
                    "created_at": datetime.now(UTC),
                },
                session=session,
            )
            return product

        return await MongoTransactionRunner().run(operation)

    async def decrement_for_sale(
        self,
        product_id: str,
        quantity: int,
        expected_price_cop: int,
        actor_id: str,
        sale_id: str,
        *,
        session,
    ) -> dict | None:
        product_oid = self._object_id(product_id)
        product = await self._collection().find_one_and_update(
            {
                "_id": product_oid,
                "is_active": {"$ne": False},
                "stock_quantity": {"$gte": quantity},
                "unit_price_cop": expected_price_cop,
            },
            {
                "$inc": {"stock_quantity": -quantity},
                "$set": {"updated_at": datetime.now(UTC)},
            },
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        if product is None:
            existing = await self._collection().find_one(
                {"_id": product_oid, "is_active": {"$ne": False}},
                {"stock_quantity": 1, "unit_price_cop": 1},
                session=session,
            )
            if existing is None:
                raise ProductNotFoundError
            if existing["unit_price_cop"] != expected_price_cop:
                raise ProductPriceChangedError
            raise InsufficientStockError

        await get_inventory_movements_collection().insert_one(
            {
                "product_id": product_oid,
                "delta": -quantity,
                "reason": "sale",
                "actor_id": actor_id,
                "sale_id": sale_id,
                "stock_after": product["stock_quantity"],
                "created_at": datetime.now(UTC),
            },
            session=session,
        )
        return product
