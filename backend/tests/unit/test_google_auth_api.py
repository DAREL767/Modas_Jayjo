from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_google_auth_service
from app.modules.auth.errors import (
    GoogleAccountLinkFailedError,
    GoogleAccountLinkRequiredError,
    GoogleAuthNotConfiguredError,
    GoogleProviderUnavailableError,
    InvalidGoogleTokenError,
)
from app.modules.auth.router import router as auth_router
from app.modules.auth.service import InactiveUserError
from app.security.tokens import decode_access_token


class FakeGoogleAuthService:
    def __init__(self, outcome):
        self.outcome = outcome

    async def authenticate(self, credential, *, username=None, password=None):
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return {"username": "sandra", "role": "vendor"}


def make_client(outcome):
    app = FastAPI()
    app.include_router(auth_router)
    app.dependency_overrides[get_google_auth_service] = lambda: FakeGoogleAuthService(
        outcome
    )
    return TestClient(app)


def test_google_login_returns_application_jwt():
    response = make_client({}).post(
        "/api/auth/google", json={"credential": "signed-google-token"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert decode_access_token(body["access_token"]) == {
        "sub": "sandra",
        "role": "vendor",
        "exp": decode_access_token(body["access_token"])["exp"],
    }


def test_google_login_reports_first_link_requirement():
    response = make_client(GoogleAccountLinkRequiredError()).post(
        "/api/auth/google", json={"credential": "signed-google-token"}
    )

    assert response.status_code == 428
    assert response.json()["detail"] == "google_account_link_required"


def test_google_login_maps_authentication_failures_without_details():
    for error, expected_status in (
        (InvalidGoogleTokenError(), 401),
        (GoogleAccountLinkFailedError(), 401),
        (InactiveUserError(), 403),
        (GoogleAuthNotConfiguredError(), 503),
        (GoogleProviderUnavailableError(), 503),
    ):
        response = make_client(error).post(
            "/api/auth/google", json={"credential": "signed-google-token"}
        )
        assert response.status_code == expected_status


def test_google_login_requires_link_credentials_as_a_pair():
    response = make_client({}).post(
        "/api/auth/google",
        json={"credential": "signed-google-token", "username": "sandra"},
    )

    assert response.status_code == 422
