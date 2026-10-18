class InventoryError(Exception):
    """Base error for inventory use cases."""


class ProductNotFoundError(InventoryError):
    pass


class InvalidProductIdError(InventoryError):
    pass


class DuplicateSKUError(InventoryError):
    pass


class InvalidStockAdjustmentError(InventoryError):
    pass


class StockLimitExceededError(InventoryError):
    pass


class InsufficientStockError(InventoryError):
    pass


class EmptyProductUpdateError(InventoryError):
    pass
