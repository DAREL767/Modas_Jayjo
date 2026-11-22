from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, StringConstraints, field_validator, model_validator

ProductId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{24}$")]
ChangeStatus = Literal["pending", "approved", "rejected"]


class ChangeCreate(BaseModel):
    kind: Literal["defect", "exchange"]
    product_id: ProductId
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
    sale_id: UUID | None = None
    replacement_id: ProductId | None = None

    @model_validator(mode="after")
    def check_exchange(self):
        if self.kind == "exchange":
            if not self.sale_id or not self.replacement_id or self.product_id == self.replacement_id:
                raise ValueError("Selecciona la venta original y una variante diferente")
        elif self.sale_id or self.replacement_id:
            raise ValueError("El retiro por defecto solo requiere la prenda dañada")
        return self


class ChangeProduct(BaseModel):
    product_id: str
    sku: str
    name: str
    size: str
    color: str


class ReturnLine(ChangeProduct):
    remaining: int
    credit_cop: int


class ChangeResponse(ChangeCreate):
    id: str
    status: ChangeStatus
    product: ChangeProduct
    replacement: ChangeProduct | None = None
    credit_cop: int = 0
    replacement_price_cop: int = 0
    difference_cop: int = 0
    requested_by: str
    created_at: datetime
    resolved_at: datetime | None = None
    resolved_by: str | None = None
    cash_session_id: str | None = None

    @field_validator("created_at", "resolved_at")
    @classmethod
    def utc_from_mongo(cls, value: datetime | None) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value
