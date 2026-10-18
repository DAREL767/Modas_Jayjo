from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

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
    GOOGLE_CLIENT_IDS: str | None = None
    CORS_ORIGINS: str | None = "http://localhost:5173"

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

    @field_validator("GOOGLE_CLIENT_IDS", mode="before")
    @classmethod
    def normalize_google_client_ids(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str) or not value.strip():
            return None
        client_ids = [client_id.strip() for client_id in value.split(",")]
        if any(not client_id for client_id in client_ids):
            raise ValueError("GOOGLE_CLIENT_IDS contiene un identificador vacío")
        if len(client_ids) != len(set(client_ids)):
            raise ValueError("GOOGLE_CLIENT_IDS no puede contener duplicados")
        return ",".join(client_ids)

    @property
    def google_client_id_allowlist(self) -> tuple[str, ...]:
        if not self.GOOGLE_CLIENT_IDS:
            return ()
        return tuple(self.GOOGLE_CLIENT_IDS.split(","))

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str) or not value.strip():
            return None
        origins = [origin.strip().rstrip("/") for origin in value.split(",")]
        if any(not origin or origin == "*" for origin in origins):
            raise ValueError("CORS_ORIGINS debe contener orígenes explícitos")
        if len(origins) != len(set(origins)):
            raise ValueError("CORS_ORIGINS no puede contener duplicados")
        for origin in origins:
            parsed = urlparse(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.path
                or parsed.params
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
            ):
                raise ValueError("CORS_ORIGINS solo admite orígenes HTTP(S) explícitos")
        return ",".join(origins)

    @property
    def cors_origin_allowlist(self) -> tuple[str, ...]:
        if not self.CORS_ORIGINS:
            return ()
        return tuple(self.CORS_ORIGINS.split(","))

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.APP_ENV == "production" and len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres en producción")
        if self.APP_ENV == "production" and not self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS es obligatorio en producción")
        return self

    # Configuración de Pydantic para cargar el archivo .env automáticamente
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
