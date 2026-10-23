from fastapi import HTTPException
import pytest

from app.modules.cash_register.errors import CashSessionNotOpenError
from app.modules.inventory.errors import InsufficientStockError
from app.modules.sales.errors import IdempotencyKeyConflictError, ProductPriceChangedError
from app.modules.sales.router import _raise_http_error


@pytest.mark.parametrize(
    ("error", "expected_detail"),
    [
        (CashSessionNotOpenError(), "No hay una sesión de caja abierta"),
        (InsufficientStockError(), "Las existencias cambiaron"),
        (ProductPriceChangedError(), "El precio de una prenda cambió"),
        (IdempotencyKeyConflictError(), "La solicitud entra en conflicto"),
    ],
)
def test_sale_conflicts_return_actionable_details(error, expected_detail):
    with pytest.raises(HTTPException) as caught:
        _raise_http_error(error)

    assert caught.value.status_code == 409
    assert expected_detail in caught.value.detail
