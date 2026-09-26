from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Obtener la ruta raíz del proyecto (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Modas Jayjo POS"
    PROJECT_VERSION: str = "1.0.0"
    
    MONGODB_URI: str
    DATABASE_NAME: str = "modas_jayjo_db"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    # Configuración de Pydantic para cargar el archivo .env automáticamente
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()