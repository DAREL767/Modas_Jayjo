from passlib.context import CryptContext

_password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _password_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return _password_context.hash(password)
