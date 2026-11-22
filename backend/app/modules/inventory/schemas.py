from base64 import b64decode
from binascii import Error
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator


def validate_photo(value: str) -> str:
    prefix = "data:image/jpeg;base64,"
    try:
        data = b64decode(value[len(prefix):], validate=True) if value.startswith(prefix) else b""
    except (Error, ValueError):
        data = b""
    if not data.startswith(b"\xff\xd8\xff") or not data.endswith(b"\xff\xd9"):
        raise ValueError("La foto debe ser una imagen JPEG válida")
    return value


ProductPhoto = Annotated[str, Field(max_length=131_072), AfterValidator(validate_photo)]


class ProductCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=80)
    size: str = Field(min_length=1, max_length=24)
    color: str = Field(min_length=1, max_length=40)
    unit_price_cop: int = Field(gt=0, le=2_000_000_000)
    unit_cost_cop: int | None = Field(default=None, ge=0, le=2_000_000_000)
    stock_quantity: int = Field(default=0, ge=0, le=1_000_000)
    low_stock_threshold: int = Field(default=0, ge=0, le=1_000_000)
    photo: ProductPhoto | None = None

    @field_validator("sku", "name", "category", "size", "color", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.upper()


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=2, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")
    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    size: str | None = Field(default=None, min_length=1, max_length=24)
    color: str | None = Field(default=None, min_length=1, max_length=40)
    unit_price_cop: int | None = Field(default=None, gt=0, le=2_000_000_000)
    unit_cost_cop: int | None = Field(default=None, ge=0, le=2_000_000_000)
    low_stock_threshold: int | None = Field(default=None, ge=0, le=1_000_000)
    is_active: bool | None = None
    photo: ProductPhoto | None = None

    @field_validator("sku", "name", "category", "size", "color", mode="before")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None

    @model_validator(mode="after")
    def require_changes(self):
        changes = self.model_dump(exclude_unset=True)
        if not changes or any(value is None for key, value in changes.items() if key not in {"photo", "unit_cost_cop"}):
            raise ValueError("Envía cambios no nulos para actualizar la prenda")
        return self


class StockAdjustment(BaseModel):
    delta: int = Field(ge=-1_000_000, le=1_000_000)
    reason: str = Field(min_length=3, max_length=240)

    @field_validator("delta")
    @classmethod
    def reject_zero_delta(cls, value: int) -> int:
        if value == 0:
            raise ValueError("El ajuste debe modificar las existencias")
        return value

    @field_validator("reason", mode="before")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ProductResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str = Field(validation_alias="_id")
    sku: str
    name: str
    category: str
    size: str
    color: str
    unit_price_cop: int
    unit_cost_cop: int | None = None
    stock_quantity: int
    low_stock_threshold: int
    is_active: bool = True
    has_photo: bool = False
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: object) -> str:
        return str(value)


class StockAdjustmentResponse(BaseModel):
    product: ProductResponse
    delta: int
    reason: str
