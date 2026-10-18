from datetime import UTC, datetime

from app.modules.inventory.errors import (
    DuplicateSKUError,
    EmptyProductUpdateError,
    InsufficientStockError,
    ProductNotFoundError,
)
from app.modules.inventory.ports import InventoryRepositoryPort
from app.modules.inventory.schemas import ProductCreate, ProductUpdate


class InventoryService:
    def __init__(self, products: InventoryRepositoryPort) -> None:
        self._products = products

    async def create_product(self, data: ProductCreate, *, actor_id: str) -> dict:
        product = data.model_dump()
        now = datetime.now(UTC)
        product.update(is_active=True, created_at=now, updated_at=now)
        return await self._products.create(product, actor_id=actor_id)

    async def get_product(
        self, product_id: str, *, include_inactive: bool = False
    ) -> dict:
        product = await self._products.get_by_id(product_id)
        if product is None or (
            not include_inactive and product.get("is_active", True) is False
        ):
            raise ProductNotFoundError
        return product

    async def list_products(
        self, *, skip: int = 0, limit: int = 50, active_only: bool = True
    ) -> list[dict]:
        return await self._products.list_products(
            skip=skip, limit=limit, active_only=active_only
        )

    async def update_product(self, product_id: str, data: ProductUpdate) -> dict:
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            raise EmptyProductUpdateError
        changes["updated_at"] = datetime.now(UTC)
        try:
            product = await self._products.update(product_id, changes)
        except DuplicateSKUError:
            raise
        if product is None:
            raise ProductNotFoundError
        return product

    async def adjust_stock(
        self, product_id: str, delta: int, reason: str, actor_id: str
    ) -> dict:
        try:
            product = await self._products.adjust_stock(
                product_id, delta, reason, actor_id
            )
        except InsufficientStockError:
            raise
        if product is None:
            raise ProductNotFoundError
        return {"product": product, "delta": delta, "reason": reason}
