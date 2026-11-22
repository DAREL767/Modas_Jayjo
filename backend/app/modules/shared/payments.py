from enum import Enum


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"


PAYMENT_METHODS = tuple(method.value for method in PaymentMethod)
