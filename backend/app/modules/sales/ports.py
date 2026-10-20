from typing import Protocol

class SaleRepositoryPort(Protocol):
    async def create(self, sale: dict, *, session) -> dict: ...
    async def get_by_idempotency_key(self, key: str) -> dict | None: ...


class SaleInventoryPort(Protocol):
    async def get_by_id(self, product_id: str, *, session=None) -> dict | None: ...
    async def decrement_for_sale(
        self,
        product_id: str,
        quantity: int,
        expected_price_cop: int,
        actor_id: str,
        sale_id: str,
        *,
        session,
    ) -> dict | None: ...


class SaleCashSessionPort(Protocol):
    async def get_open_session(self, *, session=None) -> dict | None: ...
    async def add_sale_total(
        self, session_id: str, amount_cop: int, *, session
    ) -> bool: ...


class TransactionRunnerPort(Protocol):
    async def run(self, operation): ...
