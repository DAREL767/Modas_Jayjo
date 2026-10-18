import asyncio

from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from requests import RequestException

from app.modules.auth.errors import (
    GoogleAuthNotConfiguredError,
    GoogleProviderUnavailableError,
    InvalidGoogleTokenError,
)
from app.modules.auth.ports import GoogleIdentity


GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleIDTokenVerifier:
    """Verify Google ID tokens using Google's maintained authentication library."""

    def __init__(self, client_ids: tuple[str, ...]) -> None:
        self._client_ids = frozenset(client_ids)

    async def verify(self, credential: str) -> GoogleIdentity:
        if not self._client_ids:
            raise GoogleAuthNotConfiguredError

        try:
            claims = await asyncio.to_thread(
                id_token.verify_oauth2_token,
                credential,
                Request(),
                None,
            )
        except ValueError as exc:
            raise InvalidGoogleTokenError from exc
        except (GoogleAuthError, RequestException, TimeoutError, OSError) as exc:
            raise GoogleProviderUnavailableError from exc

        if claims.get("iss") not in GOOGLE_ISSUERS:
            raise InvalidGoogleTokenError

        audiences = claims.get("aud")
        if isinstance(audiences, str):
            audience_matches = audiences in self._client_ids
        elif isinstance(audiences, list) and all(
            isinstance(audience, str) for audience in audiences
        ):
            audience_matches = bool(self._client_ids.intersection(audiences))
        else:
            audience_matches = False
        if not audience_matches:
            raise InvalidGoogleTokenError

        subject = claims.get("sub")
        email = claims.get("email")
        if not isinstance(subject, str) or not subject.strip():
            raise InvalidGoogleTokenError
        if not isinstance(email, str) or not email.strip():
            raise InvalidGoogleTokenError

        return GoogleIdentity(
            subject=subject,
            email=email,
            email_verified=claims.get("email_verified") is True,
        )
