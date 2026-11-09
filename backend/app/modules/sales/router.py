from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.api.authorization import require_roles
from app.api.dependencies import get_sales_service
from app.modules.cash_register.errors import CashSessionNotOpenError
from app.modules.inventory.errors import InsufficientStockError, ProductNotFoundError
from app.modules.inventory.errors import InvalidProductIdError
from app.modules.sales.errors import (
    InsufficientCashReceivedError,
    IdempotencyKeyConflictError,
    ProductPriceChangedError,
    SaleTotalTooLargeError,
    InvalidSaleDiscountError,
)
from app.modules.sales.schemas import SaleCreate, SaleHistoryEntry, SaleResponse
from app.modules.sales.service import SalesService
from app.modules.users.schemas import UserRole


router = APIRouter(prefix="/api/sales", tags=["Ventas"])
SalesServiceDependency = Annotated[SalesService, Depends(get_sales_service)]
require_staff = require_roles([UserRole.ADMIN, UserRole.VENDOR])


@router.get("/history", response_model=list[SaleHistoryEntry])
async def sale_history(
    service: SalesServiceDependency,
    current_user: Annotated[dict, Depends(require_staff)],
    sale_date: date | None = None,
    cash_session_id: Annotated[str | None, Query(pattern=r"^[0-9a-f]{24}$")] = None,
    reference: Annotated[str, Query(max_length=40)] = "",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=25)] = 15,
):
    start = end = None
    if cash_session_id:
        if current_user["role"] != UserRole.ADMIN.value:
            raise HTTPException(403, "El detalle de cierres está reservado para administración.")
        if sale_date is not None or reference.strip():
            raise HTTPException(422, "Consulta el cierre o busca por fecha de venta.")
    else:
        if sale_date is None or sale_date == date.max:
            raise HTTPException(422, "Selecciona una fecha de venta válida.")
        bogota = timezone(timedelta(hours=-5))
        start = datetime.combine(sale_date, time.min, bogota).astimezone(UTC)
        end = start + timedelta(days=1)
    return await service.history(
        start=start, end=end, cash_session_id=cash_session_id,
        reference=reference.strip(), skip=skip, limit=limit,
    )


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, InvalidSaleDiscountError):
        raise HTTPException(status_code=422, detail="El descuento no puede superar el precio de la prenda ni el subtotal de la venta") from error
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
    if isinstance(error, InsufficientCashReceivedError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El efectivo recibido no cubre el total de la venta",
        ) from error
    conflict_details = (
        (CashSessionNotOpenError, "No hay una sesión de caja abierta"),
        (IdempotencyKeyConflictError, "La solicitud entra en conflicto con una venta existente"),
        (InsufficientStockError, "Las existencias cambiaron y no alcanzan para completar la venta"),
        (ProductPriceChangedError, "El precio de una prenda cambió; actualiza el carrito antes de continuar"),
    )
    for error_type, detail in conflict_details:
        if isinstance(error, error_type):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail,
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
        InsufficientCashReceivedError,
        InsufficientStockError,
        InvalidProductIdError,
        ProductNotFoundError,
        ProductPriceChangedError,
        SaleTotalTooLargeError,
        InvalidSaleDiscountError,
    ) as error:
        _raise_http_error(error)
