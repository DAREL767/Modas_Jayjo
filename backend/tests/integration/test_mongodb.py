import logging
import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from app.modules.auth.errors import GoogleIdentityConflictError
from app.modules.users.errors import DuplicateUserError

from app.core.config import settings
from app.infrastructure.mongodb import client as mongo_client
from app.infrastructure.mongodb.indexes.user_indexes import ensure_user_indexes
from app.infrastructure.mongodb.collections import get_inventory_collection, get_inventory_movements_collection
from app.infrastructure.mongodb.repositories.inventory_repository import InventoryRepository
from app.infrastructure.mongodb.repositories.cash_session_repository import CashSessionRepository
from app.infrastructure.mongodb.repositories.change_repository import ChangeRepository
from app.infrastructure.mongodb.repositories.sales_repository import SaleRepository
from app.infrastructure.mongodb.transactions import MongoTransactionRunner
from app.modules.cash_register.service import CashRegisterService
from app.modules.changes.schemas import ChangeCreate
from app.modules.changes.service import ChangeError, ChangeService
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SalesService
from app.infrastructure.mongodb.maintenance.user_maintenance_repository import (
    UserMaintenanceRepository,
)
from app.infrastructure.mongodb.repositories.user_repository import UserRepository


logger = logging.getLogger(__name__)
MAX_DATABASE_NAME_BYTES = 38


def _temporary_database_name(*reserved_database_names: str) -> str:
    """Return a short, unique database name within Atlas's name limit."""
    for _ in range(5):
        database_name = f"mjj_pytest_{uuid4().hex[:16]}"
        if (
            database_name not in reserved_database_names
            and len(database_name.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES
        ):
            return database_name
    raise RuntimeError("Could not generate a safe temporary MongoDB database name")


def test_temporary_database_name_is_short_and_not_production():
    reserved_database_names = ("modas_jayjo_db", "mjj_pytest_reserved")
    temporary_database = _temporary_database_name(*reserved_database_names)

    assert temporary_database not in reserved_database_names
    assert len(temporary_database.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES


@pytest.mark.integration
@pytest.mark.anyio
async def test_mongodb_connection_and_isolated_crud(monkeypatch):
    test_uri = os.getenv("MONGODB_TEST_URI")
    base_test_database = os.getenv("MONGODB_TEST_DATABASE")
    if not test_uri or not base_test_database:
        pytest.skip("Set MONGODB_TEST_URI and MONGODB_TEST_DATABASE to enable MongoDB integration tests")
    if base_test_database == settings.DATABASE_NAME:
        pytest.fail("MONGODB_TEST_DATABASE must be different from DATABASE_NAME")

    temporary_database = _temporary_database_name(
        settings.DATABASE_NAME, base_test_database
    )
    assert len(temporary_database.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES
    monkeypatch.setattr(settings, "MONGODB_URI", test_uri)
    monkeypatch.setattr(settings, "DATABASE_NAME", temporary_database)

    operation_error = None
    try:
        await mongo_client.connect_to_mongo()
        repository = UserRepository()
        maintenance = UserMaintenanceRepository()
        await ensure_user_indexes()
        username = f"pytest_{uuid4().hex}"
        email = f"{username}@example.invalid"
        user = {
            "username": username,
            "email": email,
            "full_name": "Temporary MongoDB integration record",
            "password": "not-a-real-credential",
            "role": "vendor",
            "is_active": True,
        }

        created = await repository.create(user)
        assert created["username"] == username
        assert await repository.get_by_username(username) is not None
        assert await repository.get_by_id(str(created["_id"])) is not None
        assert await repository.exists_by_username_or_email(username, email)
        google_subject = f"google_{uuid4().hex}"
        assert await repository.link_google_subject(
            str(created["_id"]), google_subject,
            expected_email="changed@example.invalid", expected_session_version=None,
        ) is None
        assert await repository.link_google_subject(
            str(created["_id"]), google_subject,
            expected_email=email, expected_session_version="stale-version",
        ) is None
        linked = await repository.link_google_subject(
            str(created["_id"]), google_subject,
            expected_email=email, expected_session_version=None,
        )
        assert linked["google_sub"] == google_subject
        assert "password" not in linked
        assert await repository.get_by_google_subject(google_subject) is not None
        with pytest.raises(DuplicateUserError):
            await repository.create(user)

        updated = await repository.update_by_id(
            str(created["_id"]), {"full_name": "Updated test record"}
        )
        assert updated["full_name"] == "Updated test record"
        assert "password" not in updated

        assert await repository.deactivate_by_id(str(created["_id"]))
        deactivated = await repository.get_by_id(str(created["_id"]))
        assert deactivated["is_active"] is False
        assert deactivated["session_version"]
        assert await repository.list_all(is_active=False, limit=10)

        legacy_vendor = await repository.create(
            {
                "username": "legacy_vendor",
                "email": "legacy_vendor@example.invalid",
                "full_name": "Legacy vendor",
                "password": "not-a-real-credential",
                "role": "vendedor",
                "is_active": True,
            }
        )
        with pytest.raises(GoogleIdentityConflictError):
            await repository.link_google_subject(
                str(legacy_vendor["_id"]), google_subject
            )
        await repository.create(
            {
                "username": "admin",
                "email": "admin@modasjayjo.com",
                "full_name": "Legacy bootstrap admin",
                "password": "not-a-real-credential",
                "role": "admin",
                "is_active": True,
            }
        )
        assert await maintenance.normalize_legacy_roles() == 1
        assert await maintenance.disable_public_bootstrap_admin()
        legacy_vendor = await repository.get_by_username("legacy_vendor")
        legacy_admin = await repository.get_by_username("admin")
        assert legacy_vendor["role"] == "vendor"
        assert legacy_admin["role"] == "vendor"
        assert legacy_admin["is_active"] is False

        inventory = InventoryRepository()
        product = await inventory.create({
            "sku": "TEST-1", "name": "Prenda de prueba", "is_active": False,
            "stock_quantity": 3, "created_at": datetime.now(UTC),
            "photo": "fixture", "has_photo": True,
        }, actor_id="test-admin")
        product_id = str(product["_id"])
        assert (await inventory.get_by_id(product_id))["photo"] == "fixture"
        listed = await inventory.list_products(active_only=False)
        assert len(listed) == 1
        assert listed[0]["has_photo"] and "photo" not in listed[0]

        assert await inventory.delete(product_id, actor_id="test-admin")
        assert not await inventory.delete(product_id, actor_id="test-admin")
        deleted = await get_inventory_collection().find_one({"_id": product["_id"]})
        assert deleted["stock_quantity"] == -1 and "photo" not in deleted
        assert await inventory.list_products(active_only=False) == []
        assert await inventory.get_by_id(product_id) is None
        assert await inventory.update(product_id, {"is_active": True}) is None
        assert await inventory.adjust_stock(product_id, 2, "Ajuste de prueba", "test-admin") is None
        movements = get_inventory_movements_collection()
        assert await movements.count_documents({"product_id": product["_id"], "reason": "product_deleted", "delta": -3}) == 1
        await _check_changes(inventory)
    except Exception as exc:
        operation_error = exc
        raise
    finally:
        active_client = mongo_client.client_state.client
        try:
            if active_client is not None:
                try:
                    await active_client.drop_database(temporary_database)
                except Exception as cleanup_error:
                    if operation_error is None:
                        raise
                    operation_error.add_note(
                        f"Temporary MongoDB cleanup also failed: {type(cleanup_error).__name__}"
                    )
                    logger.warning(
                        "Temporary MongoDB cleanup failed; preserving the original test error (%s)",
                        type(cleanup_error).__name__,
                    )
        finally:
            await mongo_client.close_mongo_connection()


async def _check_changes(inventory):
    cash = CashSessionRepository()
    sales = SaleRepository()
    reports = ChangeRepository()
    transactions = MongoTransactionRunner()
    service = ChangeService(reports, inventory, sales, cash, transactions)
    cash_service = CashRegisterService(cash)
    await cash_service.open_session(10_000, "admin")

    async def create_variant(sku, price, stock):
        product = await inventory.create({
            "sku": sku, "name": "Camisa", "size": sku, "color": "Azul", "is_active": True,
            "stock_quantity": stock, "unit_price_cop": price, "created_at": datetime.now(UTC),
        }, actor_id="admin")
        return str(product["_id"])

    returned_id = await create_variant("M", 10_000, 2)
    replacement_id = await create_variant("L", 6_000, 1)
    sale = await SalesService(sales, inventory, cash, transactions).create_sale(
        SaleCreate(
            items=[{"product_id": returned_id, "quantity": 1}],
            global_discount_cop=3_000, cash_received_cop=7_000,
        ),
        actor_id="vendor", idempotency_key="changes-test-sale",
    )
    exchange = ChangeCreate(
        kind="exchange", sale_id=sale["sale_id"], product_id=returned_id,
        replacement_id=replacement_id, reason="La persona necesita talla L",
    )
    request_id = str(uuid4())
    report = await service.create(exchange, actor_id="vendor", request_id=request_id)
    assert report["status"] == "pending"
    assert report["credit_cop"] == 7_000 and report["difference_cop"] == -1_000
    assert (await inventory.get_by_id(returned_id))["stock_quantity"] == 1
    assert (await inventory.get_by_id(replacement_id))["stock_quantity"] == 1

    await inventory.adjust_stock(replacement_id, -1, "Agotar reemplazo para prueba", "admin")
    with pytest.raises(ChangeError):
        await service.approve(request_id, actor_id="admin")
    assert (await reports.get(request_id))["status"] == "pending"
    assert (await cash.get_open_session()).get("exchange_cash_cop", 0) == 0
    assert (await inventory.get_by_id(returned_id))["stock_quantity"] == 1

    await inventory.adjust_stock(replacement_id, 1, "Restablecer reemplazo para prueba", "admin")
    approved = await service.approve(request_id, actor_id="admin")
    assert approved["status"] == "approved" and approved["cash_session_id"]
    with pytest.raises(ChangeError):
        await service.approve(request_id, actor_id="admin")
    assert (await service.create(exchange, actor_id="vendor", request_id=request_id))["status"] == "approved"
    assert (await inventory.get_by_id(returned_id))["stock_quantity"] == 2
    assert (await inventory.get_by_id(replacement_id))["stock_quantity"] == 0
    assert (await cash.get_open_session())["exchange_cash_cop"] == -1_000
    assert await service.sale_lines(sale["sale_id"]) == []

    defect_id = str(uuid4())
    await service.create(
        ChangeCreate(kind="defect", product_id=returned_id, reason="Costura abierta"),
        actor_id="vendor", request_id=defect_id,
    )
    await service.approve(defect_id, actor_id="admin")
    assert (await inventory.get_by_id(returned_id))["stock_quantity"] == 1
    results = await reports.list(state="approved", start=None, end=None, search="Costura", skip=0, limit=20)
    assert [item["id"] for item in results] == [defect_id]
    closed = await cash_service.close_session(16_000, "admin")
    assert closed["expected_cash_cop"] == 16_000 and closed["difference_cash_cop"] == 0
