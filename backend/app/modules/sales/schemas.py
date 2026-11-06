from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

class SaleLineRequest(BaseModel):
    product_id: str = Field(min_length=24, max_length=24)
    quantity: int = Field(ge=1, le=100)
    unit_discount_cop: int = Field(default=0, ge=0, le=2_000_000_000, strict=True)


class SaleCreate(BaseModel):
    items: list[SaleLineRequest] = Field(min_length=1, max_length=100)
    cash_received_cop: int = Field(ge=0, le=2_000_000_000)
    global_discount_cop: int = Field(default=0, ge=0, le=2_000_000_000, strict=True)

    @model_validator(mode="after")
    def reject_repeated_products(self):
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Cada prenda debe aparecer una sola vez en la venta")
        if self.global_discount_cop and any(item.unit_discount_cop for item in self.items):
            raise ValueError("No se puede combinar descuento global con descuentos por prenda")
        return self


class SaleLineResponse(BaseModel):
    product_id: str
    sku: str
    name: str
    size: str
    color: str
    quantity: int
    unit_price_cop: int
    line_total_cop: int
    unit_discount_cop: int = 0


class SaleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sale_id: str
    status: str
    items: list[SaleLineResponse]
    total_cop: int
    subtotal_cop: int | None = None
    discount_cop: int = 0
    global_discount_cop: int = 0
    cash_received_cop: int
    change_cop: int
    cashier_id: str
    cash_session_id: str
    idempotency_key: str
    created_at: datetime
