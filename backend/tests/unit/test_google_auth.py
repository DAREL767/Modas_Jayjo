import pytest

from app.modules.auth.errors import (
    GoogleAccountLinkFailedError,
    GoogleAccountLinkRequiredError,
    GoogleIdentityConflictError,
    InvalidGoogleTokenError,
)
from app.modules.auth.google_service import GoogleAuthService
from app.modules.auth.ports import GoogleIdentity
from app.modules.auth.service import AuthService, InactiveUserError
from app.security.passwords import get_password_hash


class FakeGoogleVerifier:
    def __init__(self, identity):
        self.identity = identity

    async def verify(self, credential):
        assert credential == "a-google-credential"
        return self.identity


class FakeUserRepository:
    def __init__(self, *users):
        self.users = list(users)

    async def get_by_username(self, username):
        return next((user for user in self.users if user["username"] == username), None)

    async def get_by_google_subject(self, subject):
        return next((user for user in self.users if user.get("google_sub") == subject), None)

    async def link_google_subject(self, user_id, subject):
        linked = await self.get_by_google_subject(subject)
        if linked is not None and str(linked["_id"]) != user_id:
            raise GoogleIdentityConflictError
        user = next((user for user in self.users if str(user["_id"]) == user_id), None)
        if user is None or user.get("is_active", True) is False or user.get("google_sub"):
            return None
        user["google_sub"] = subject
        return user


@pytest.fixture
def provisioned_user():
    return {
        "_id": "user-1",
        "username": "sandra",
        "email": "sandra@example.com",
        "password": get_password_hash("admin-issued-password"),
        "role": "vendor",
        "is_active": True,
    }


@pytest.fixture
def google_identity():
    return GoogleIdentity(
        subject="google-sub-123",
        email="sandra@example.com",
        email_verified=True,
    )


def make_service(users, identity):
    return GoogleAuthService(
        users=users,
        local_auth=AuthService(users),
        verifier=FakeGoogleVerifier(identity),
    )


@pytest.mark.anyio
async def test_first_google_login_links_only_matching_admin_provisioned_account(
    provisioned_user, google_identity
):
    users = FakeUserRepository(provisioned_user)
    service = make_service(users, google_identity)

    linked = await service.authenticate(
        "a-google-credential",
        username="  SANDRA ",
        password="admin-issued-password",
    )

    assert linked["google_sub"] == "google-sub-123"
    assert linked["role"] == "vendor"

    returning = await service.authenticate("a-google-credential")
    assert returning["_id"] == "user-1"


@pytest.mark.anyio
async def test_unlinked_google_identity_requires_admin_issued_credentials(
    provisioned_user, google_identity
):
    service = make_service(FakeUserRepository(provisioned_user), google_identity)

    with pytest.raises(GoogleAccountLinkRequiredError):
        await service.authenticate("a-google-credential")


@pytest.mark.anyio
async def test_link_rejects_wrong_password_and_mismatched_email(
    provisioned_user, google_identity
):
    users = FakeUserRepository(provisioned_user)
    service = make_service(users, google_identity)

    with pytest.raises(GoogleAccountLinkFailedError):
        await service.authenticate(
            "a-google-credential", username="sandra", password="wrong-password"
        )
    assert "google_sub" not in provisioned_user

    mismatched_identity = GoogleIdentity(
        subject="google-sub-456",
        email="someone-else@example.com",
        email_verified=True,
    )
    service = make_service(users, mismatched_identity)
    with pytest.raises(GoogleAccountLinkFailedError):
        await service.authenticate(
            "a-google-credential",
            username="sandra",
            password="admin-issued-password",
        )
    assert "google_sub" not in provisioned_user


@pytest.mark.anyio
async def test_rejects_unverified_google_email(provisioned_user, google_identity):
    identity = GoogleIdentity(
        subject=google_identity.subject,
        email=google_identity.email,
        email_verified=False,
    )
    service = make_service(FakeUserRepository(provisioned_user), identity)

    with pytest.raises(InvalidGoogleTokenError):
        await service.authenticate("a-google-credential")


@pytest.mark.anyio
async def test_rejects_inactive_linked_user(provisioned_user, google_identity):
    provisioned_user["google_sub"] = google_identity.subject
    provisioned_user["is_active"] = False
    service = make_service(FakeUserRepository(provisioned_user), google_identity)

    with pytest.raises(InactiveUserError):
        await service.authenticate("a-google-credential")


@pytest.mark.anyio
async def test_existing_google_link_cannot_be_replaced(provisioned_user, google_identity):
    provisioned_user["google_sub"] = "different-google-sub"
    service = make_service(FakeUserRepository(provisioned_user), google_identity)

    with pytest.raises(GoogleAccountLinkFailedError):
        await service.authenticate(
            "a-google-credential",
            username="sandra",
            password="admin-issued-password",
        )
    assert provisioned_user["google_sub"] == "different-google-sub"
