from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.shared.payments import PaymentMethod


class SaleLineRequest(BaseModel):
    product_id: str = Field(min_length=24, max_length=24)
    quantity: int = Field(ge=1, le=100)


class SaleCreate(BaseModel):
    items: list[SaleLineRequest] = Field(min_length=1, max_length=100)
    payment_method: PaymentMethod

    @model_validator(mode="after")
    def reject_repeated_products(self):
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Cada prenda debe aparecer una sola vez en la venta")
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


class SaleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sale_id: str
    status: str
    items: list[SaleLineResponse]
    payment_method: PaymentMethod
    total_cop: int
    cashier_id: str
    cash_session_id: str
    idempotency_key: str
    created_at: datetime
