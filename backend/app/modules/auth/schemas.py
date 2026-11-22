from pydantic import BaseModel
from pydantic import Field, SecretStr, field_validator, model_validator


class Token(BaseModel):
    access_token: str
    token_type: str


class GoogleLoginRequest(BaseModel):
    credential: SecretStr = Field(..., min_length=1, max_length=8192)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    password: SecretStr | None = Field(default=None, min_length=1, max_length=1024)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str | None) -> str | None:
        return value.strip().lower() if value is not None else None

    @model_validator(mode="after")
    def require_link_credentials_together(self):
        if (self.username is None) != (self.password is None):
            raise ValueError("username y password deben enviarse juntos")
        return self
