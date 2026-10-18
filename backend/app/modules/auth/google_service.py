from app.modules.auth.errors import (
    GoogleAccountLinkFailedError,
    GoogleAccountLinkRequiredError,
    GoogleIdentityConflictError,
    InvalidGoogleTokenError,
)
from app.modules.auth.ports import GoogleAuthUserRepository, GoogleIdentityVerifier
from app.modules.auth.service import (
    AuthService,
    InactiveUserError,
    InvalidCredentialsError,
)


class GoogleAuthService:
    """Authenticate Google identities and link only admin-provisioned users."""

    def __init__(
        self,
        users: GoogleAuthUserRepository,
        local_auth: AuthService,
        verifier: GoogleIdentityVerifier,
    ) -> None:
        self._users = users
        self._local_auth = local_auth
        self._verifier = verifier

    async def authenticate(
        self,
        credential: str,
        *,
        username: str | None = None,
        password: str | None = None,
    ) -> dict:
        identity = await self._verifier.verify(credential)
        subject = identity.subject.strip()
        email = identity.email.strip().lower()
        if not subject or not email or identity.email_verified is not True:
            raise InvalidGoogleTokenError

        linked_user = await self._users.get_by_google_subject(subject)
        if linked_user is not None:
            if linked_user.get("is_active", True) is not True:
                raise InactiveUserError
            return linked_user

        if not username or password is None:
            raise GoogleAccountLinkRequiredError

        try:
            user = await self._local_auth.authenticate(username.strip().lower(), password)
        except InvalidCredentialsError as exc:
            raise GoogleAccountLinkFailedError from exc

        if user.get("email", "").strip().lower() != email:
            raise GoogleAccountLinkFailedError

        try:
            linked_user = await self._users.link_google_subject(
                str(user["_id"]), subject
            )
        except GoogleIdentityConflictError as exc:
            linked_user = await self._users.get_by_google_subject(subject)
            if linked_user is None or str(linked_user["_id"]) != str(user["_id"]):
                raise GoogleAccountLinkFailedError from exc

        if linked_user is None:
            # Another login may have completed this same link concurrently.
            linked_user = await self._users.get_by_google_subject(subject)
            if linked_user is None or str(linked_user["_id"]) != str(user["_id"]):
                raise GoogleAccountLinkFailedError

        if linked_user.get("is_active", True) is not True:
            raise InactiveUserError
        return linked_user
