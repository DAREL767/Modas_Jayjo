from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.authorization import require_roles
from app.api.dependencies import get_cash_register_service
from app.modules.cash_register.errors import (
    CashSessionAlreadyClosedError,
    CashSessionAlreadyOpenError,
    CashSessionNotOpenError,
)
from app.modules.cash_register.schemas import (
    CashSessionClose,
    CashSessionOpen,
    CashSessionResponse,
)
from app.modules.cash_register.service import CashRegisterService
from app.modules.users.schemas import UserRole


router = APIRouter(prefix="/api/cash-register", tags=["Cierre de Caja"])
CashRegisterDependency = Annotated[
    CashRegisterService, Depends(get_cash_register_service)
]
require_admin = require_roles([UserRole.ADMIN])
require_staff = require_roles([UserRole.ADMIN, UserRole.VENDOR])


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, CashSessionAlreadyOpenError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una sesión de caja abierta",
        ) from error
    if isinstance(error, CashSessionNotOpenError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay una sesión de caja abierta",
        ) from error
    if isinstance(error, CashSessionAlreadyClosedError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La sesión de caja ya fue cerrada",
        ) from error
    raise error


@router.get("/current", response_model=CashSessionResponse | None)
async def get_current_session(
    service: CashRegisterDependency, _: dict = Depends(require_staff)
):
    return await service.get_current_session()


@router.post(
    "/open",
    response_model=CashSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def open_session(
    body: CashSessionOpen,
    service: CashRegisterDependency,
    current_user: dict = Depends(require_admin),
):
    try:
        return await service.open_session(
            body.opening_cash_cop, str(current_user["_id"]), body.note
        )
    except CashSessionAlreadyOpenError as error:
        _raise_http_error(error)


@router.post(
    "/close",
    response_model=CashSessionResponse,
    dependencies=[Depends(require_admin)],
)
async def close_session(
    body: CashSessionClose,
    service: CashRegisterDependency,
    current_user: dict = Depends(require_admin),
):
    try:
        return await service.close_session(
            body.counted_cash_cop, str(current_user["_id"]), body.note
        )
    except (
        CashSessionAlreadyClosedError,
        CashSessionNotOpenError,
    ) as error:
        _raise_http_error(error)


@router.get(
    "/history",
    response_model=list[CashSessionResponse],
    dependencies=[Depends(require_admin)],
)
async def list_closed_sessions(
    service: CashRegisterDependency,
    start_date: date,
    end_date: date,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    if end_date < start_date or (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El rango debe ser válido y no puede superar 367 días",
        )
    bogota_timezone = timezone(timedelta(hours=-5))
    start_at = datetime.combine(start_date, time.min, bogota_timezone).astimezone(UTC)
    end_at = datetime.combine(
        end_date + timedelta(days=1), time.min, bogota_timezone
    ).astimezone(UTC)
    return await service.list_closed_sessions(
        start_at, end_at, skip=skip, limit=limit
    )
