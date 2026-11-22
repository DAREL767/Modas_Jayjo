from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.api.authorization import require_roles
from app.api.dependencies import get_change_service
from app.modules.changes.schemas import ChangeCreate, ChangeResponse, ChangeStatus, ReturnLine
from app.modules.changes.service import ChangeError, ChangeService
from app.modules.users.schemas import UserRole

router = APIRouter(prefix="/api/changes", tags=["Cambios"])
Service = Annotated[ChangeService, Depends(get_change_service)]
Staff = Annotated[dict, Depends(require_roles([UserRole.ADMIN, UserRole.VENDOR]))]
Admin = Annotated[dict, Depends(require_roles([UserRole.ADMIN]))]


@router.get("/sale/{sale_id}", response_model=list[ReturnLine])
async def find_sale(sale_id: UUID, service: Service, _: Staff):
    try:
        return await service.sale_lines(str(sale_id))
    except ChangeError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.post("/", response_model=ChangeResponse, status_code=201)
async def create_change(body: ChangeCreate, service: Service, user: Staff, request_id: Annotated[UUID, Header(alias="Idempotency-Key")]):
    try:
        return await service.create(body, actor_id=str(user["_id"]), request_id=str(request_id))
    except ChangeError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.get("/", response_model=list[ChangeResponse])
async def list_changes(
    service: Service, _: Admin, state: ChangeStatus | None = None,
    start_date: date | None = None, end_date: date | None = None,
    search: Annotated[str, Query(max_length=100)] = "",
    skip: Annotated[int, Query(ge=0)] = 0, limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    start = end = None
    if start_date is not None or end_date is not None:
        if (start_date is None or end_date is None or end_date < start_date
                or end_date == date.max or (end_date - start_date).days > 366):
            raise HTTPException(422, "Selecciona un rango válido de hasta 367 días.")
        bogota = timezone(timedelta(hours=-5))
        start = datetime.combine(start_date, time.min, bogota).astimezone(UTC)
        end = datetime.combine(end_date + timedelta(days=1), time.min, bogota).astimezone(UTC)
    return await service.changes.list(state=state, start=start, end=end, search=search.strip(), skip=skip, limit=limit)


@router.post("/{request_id}/approve", response_model=ChangeResponse)
async def approve_change(request_id: UUID, service: Service, user: Admin):
    try:
        return await service.approve(str(request_id), actor_id=str(user["_id"]))
    except ChangeError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.post("/{request_id}/reject", response_model=ChangeResponse)
async def reject_change(request_id: UUID, service: Service, user: Admin):
    try:
        return await service.reject(str(request_id), actor_id=str(user["_id"]))
    except ChangeError as error:
        raise HTTPException(error.status_code, str(error)) from error
