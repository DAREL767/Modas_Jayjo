from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.shared.payments import PaymentMethod


class CashSessionOpen(BaseModel):
    opening_cash_cop: int = Field(ge=0, le=2_000_000_000)
    note: str | None = Field(default=None, max_length=240)

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class CashSessionClose(BaseModel):
    counted_by_payment_cop: dict[PaymentMethod, int]
    note: str | None = Field(default=None, max_length=240)

    @field_validator("counted_by_payment_cop")
    @classmethod
    def validate_payment_totals(cls, value: dict[PaymentMethod, int]):
        if set(value) != set(PaymentMethod):
            raise ValueError("Debe enviar el conteo de efectivo, tarjeta y transferencia")
        if any(amount < 0 or amount > 2_000_000_000 for amount in value.values()):
            raise ValueError("Los valores contados deben ser montos válidos")
        return value

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class CashSessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str = Field(validation_alias="_id")
    status: str
    opening_cash_cop: int
    sales_by_payment_cop: dict[str, int]
    expected_by_payment_cop: dict[str, int] | None = None
    counted_by_payment_cop: dict[str, int] | None = None
    difference_by_payment_cop: dict[str, int] | None = None
    opened_by: str
    closed_by: str | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    opening_note: str | None = None
    closing_note: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: object) -> str:
        return str(value)
