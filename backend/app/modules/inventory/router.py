from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.authorization import require_roles
from app.api.dependencies import get_inventory_service
from app.modules.inventory.errors import (
    DuplicateSKUError,
    EmptyProductUpdateError,
    InsufficientStockError,
    InvalidProductIdError,
    ProductNotFoundError,
    StockLimitExceededError,
)
from app.modules.inventory.schemas import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    StockAdjustment,
    StockAdjustmentResponse,
)
from app.modules.inventory.service import InventoryService
from app.modules.users.schemas import UserRole


router = APIRouter(prefix="/api/inventory", tags=["Inventario"])
InventoryServiceDependency = Annotated[
    InventoryService, Depends(get_inventory_service)
]
require_admin = require_roles([UserRole.ADMIN])
require_staff = require_roles([UserRole.ADMIN, UserRole.VENDOR])


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, DuplicateSKUError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El SKU ya está registrado",
        ) from error
    if isinstance(error, InvalidProductIdError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El identificador de la prenda no es válido",
        ) from error
    if isinstance(error, ProductNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prenda no encontrada",
        ) from error
    if isinstance(error, InsufficientStockError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay existencias suficientes para el ajuste",
        ) from error
    if isinstance(error, StockLimitExceededError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El ajuste excede el máximo de existencias permitido",
        ) from error
    if isinstance(error, EmptyProductUpdateError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe enviar al menos un campo para actualizar",
        ) from error
    raise error


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    service: InventoryServiceDependency,
    current_user: dict = Depends(require_staff),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    active_only: bool = True,
):
    can_view_inactive = current_user.get("role") == UserRole.ADMIN.value
    products = await service.list_products(
        skip=skip,
        limit=limit,
        active_only=active_only or not can_view_inactive,
    )
    if not can_view_inactive:
        for product in products:
            product.pop("unit_cost_cop", None)
    return products


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    service: InventoryServiceDependency,
    current_user: dict = Depends(require_staff),
):
    try:
        is_admin = current_user.get("role") == UserRole.ADMIN.value
        product = await service.get_product(
            product_id, include_inactive=is_admin
        )
        if not is_admin:
            product.pop("unit_cost_cop", None)
        return product
    except (InvalidProductIdError, ProductNotFoundError) as error:
        _raise_http_error(error)


@router.post(
    "/",
    response_model=ProductResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    product_in: ProductCreate,
    service: InventoryServiceDependency,
    current_user: dict = Depends(require_staff),
):
    try:
        if current_user.get("role") != UserRole.ADMIN.value:
            product_in = product_in.model_copy(update={"unit_cost_cop": None})
        product = await service.create_product(product_in, actor_id=str(current_user["_id"]))
        if current_user.get("role") != UserRole.ADMIN.value:
            product.pop("unit_cost_cop", None)
        return product
    except DuplicateSKUError as error:
        _raise_http_error(error)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_admin)],
)
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    service: InventoryServiceDependency,
):
    try:
        return await service.update_product(product_id, product_in)
    except (
        DuplicateSKUError,
        EmptyProductUpdateError,
        InvalidProductIdError,
        ProductNotFoundError,
    ) as error:
        _raise_http_error(error)


@router.post(
    "/{product_id}/stock-adjustments",
    response_model=StockAdjustmentResponse,
    dependencies=[Depends(require_admin)],
)
async def adjust_stock(
    product_id: str,
    adjustment: StockAdjustment,
    service: InventoryServiceDependency,
    current_user: dict = Depends(require_admin),
):
    try:
        return await service.adjust_stock(
            product_id,
            adjustment.delta,
            adjustment.reason,
            str(current_user["_id"]),
        )
    except (
        InsufficientStockError,
        InvalidProductIdError,
        ProductNotFoundError,
        StockLimitExceededError,
    ) as error:
        _raise_http_error(error)
