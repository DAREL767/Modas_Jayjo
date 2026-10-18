class SaleError(Exception):
    """Base error for sale use cases."""


class DuplicateIdempotencyKeyError(SaleError):
    pass


class IdempotencyKeyConflictError(SaleError):
    pass


class ProductPriceChangedError(SaleError):
    pass


class SaleTotalTooLargeError(SaleError):
    pass


class SaleNotFoundError(SaleError):
    pass
