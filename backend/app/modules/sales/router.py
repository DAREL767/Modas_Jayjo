from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.authorization import require_roles
from app.api.dependencies import get_sales_service
from app.modules.cash_register.errors import CashSessionNotOpenError
from app.modules.inventory.errors import InsufficientStockError, ProductNotFoundError
from app.modules.inventory.errors import InvalidProductIdError
from app.modules.sales.errors import (
    IdempotencyKeyConflictError,
    ProductPriceChangedError,
    SaleTotalTooLargeError,
)
from app.modules.sales.schemas import SaleCreate, SaleResponse
from app.modules.sales.service import SalesService
from app.modules.users.schemas import UserRole


router = APIRouter(prefix="/api/sales", tags=["Ventas"])
SalesServiceDependency = Annotated[SalesService, Depends(get_sales_service)]
require_staff = require_roles([UserRole.ADMIN, UserRole.VENDOR])


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, ProductNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Una prenda de la venta no existe o está inactiva",
        ) from error
    if isinstance(error, InvalidProductIdError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El identificador de una prenda no es válido",
        ) from error
    if isinstance(error, SaleTotalTooLargeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El total de la venta excede el máximo permitido",
        ) from error
    if isinstance(
        error,
        (
            CashSessionNotOpenError,
            IdempotencyKeyConflictError,
            InsufficientStockError,
            ProductPriceChangedError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar la venta por un conflicto de caja, precio o existencias",
        ) from error
    raise error


@router.post(
    "/",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_staff)],
)
async def create_sale(
    body: SaleCreate,
    service: SalesServiceDependency,
    current_user: dict = Depends(require_staff),
    idempotency_key: Annotated[
        str, Header(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")
    ] = ...,
):
    try:
        return await service.create_sale(
            body,
            actor_id=str(current_user["_id"]),
            idempotency_key=idempotency_key,
        )
    except (
        CashSessionNotOpenError,
        IdempotencyKeyConflictError,
        InsufficientStockError,
        InvalidProductIdError,
        ProductNotFoundError,
        ProductPriceChangedError,
        SaleTotalTooLargeError,
    ) as error:
        _raise_http_error(error)
