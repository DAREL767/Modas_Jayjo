from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Obtener la ruta raíz del proyecto (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Modas Jayjo POS"
    PROJECT_VERSION: str = "1.0.0"

    APP_ENV: Literal["development", "test", "production"] = "development"
    MONGODB_URI: str
    DATABASE_NAME: str = "modas_jayjo_db"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    INITIAL_ADMIN_USERNAME: str | None = None
    INITIAL_ADMIN_EMAIL: str | None = None
    INITIAL_ADMIN_FULL_NAME: str | None = None
    INITIAL_ADMIN_PASSWORD: str | None = None

    @field_validator("MONGODB_URI", "SECRET_KEY", mode="before")
    @classmethod
    def reject_blank_critical_values(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("El valor es obligatorio y no puede estar vacío")
        return value.strip()

    @field_validator("MONGODB_URI")
    @classmethod
    def validate_mongodb_uri(cls, value: str) -> str:
        if not value.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("MONGODB_URI debe usar mongodb:// o mongodb+srv://")
        return value

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def validate_token_lifetime(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES debe ser mayor que cero")
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def reject_known_placeholder_secrets(cls, value: str) -> str:
        placeholders = {"changeme", "secret", "your-secret-key", "change-me"}
        if value.lower() in placeholders:
            raise ValueError("SECRET_KEY no puede usar un valor de ejemplo")
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.APP_ENV == "production" and len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres en producción")
        return self

    # Configuración de Pydantic para cargar el archivo .env automáticamente
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
