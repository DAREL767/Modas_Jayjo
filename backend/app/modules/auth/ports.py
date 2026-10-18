from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    email_verified: bool


class GoogleIdentityVerifier(Protocol):
    async def verify(self, credential: str) -> GoogleIdentity: ...


class GoogleAuthUserRepository(Protocol):
    async def get_by_google_subject(self, subject: str) -> dict | None: ...

    async def get_by_username(self, username: str) -> dict | None: ...

    async def link_google_subject(
        self, user_id: str, subject: str
    ) -> dict | None: ...
