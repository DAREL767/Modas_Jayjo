class CashRegisterError(Exception):
    """Base error for cash register use cases."""


class CashSessionAlreadyOpenError(CashRegisterError):
    pass


class CashSessionNotOpenError(CashRegisterError):
    pass


class CashSessionAlreadyClosedError(CashRegisterError):
    pass
