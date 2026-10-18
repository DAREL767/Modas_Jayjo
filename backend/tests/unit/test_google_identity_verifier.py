import pytest
from google.auth.exceptions import GoogleAuthError

from app.infrastructure.google import identity_verifier
from app.modules.auth.errors import (
    GoogleAuthNotConfiguredError,
    GoogleProviderUnavailableError,
    InvalidGoogleTokenError,
)


@pytest.fixture
def valid_claims():
    return {
        "iss": "https://accounts.google.com",
        "aud": "web-client-id",
        "sub": "google-sub-123",
        "email": "sandra@example.com",
        "email_verified": True,
    }


@pytest.mark.anyio
async def test_verifier_checks_google_claims_and_allowed_audience(
    monkeypatch, valid_claims
):
    calls = []

    def verify(token, request, audience):
        calls.append((token, audience))
        return valid_claims

    monkeypatch.setattr(identity_verifier.id_token, "verify_oauth2_token", verify)
    verifier = identity_verifier.GoogleIDTokenVerifier(("web-client-id", "mobile-id"))

    identity = await verifier.verify("signed-token")

    assert calls == [("signed-token", None)]
    assert identity.subject == "google-sub-123"
    assert identity.email == "sandra@example.com"
    assert identity.email_verified is True


@pytest.mark.anyio
async def test_verifier_rejects_wrong_issuer_and_unregistered_audience(
    monkeypatch, valid_claims
):
    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: {**valid_claims, "iss": "https://attacker.example"},
    )
    verifier = identity_verifier.GoogleIDTokenVerifier(("web-client-id",))
    with pytest.raises(InvalidGoogleTokenError):
        await verifier.verify("signed-token")

    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: {**valid_claims, "aud": ["web-client-id", "untrusted-client"]},
    )
    with pytest.raises(InvalidGoogleTokenError):
        await verifier.verify("signed-token")

    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: {**valid_claims, "aud": "untrusted-client-id"},
    )
    with pytest.raises(InvalidGoogleTokenError):
        await verifier.verify("signed-token")


@pytest.mark.anyio
async def test_verifier_maps_invalid_token_and_provider_outage(
    monkeypatch, valid_claims
):
    verifier = identity_verifier.GoogleIDTokenVerifier(("web-client-id",))
    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: (_ for _ in ()).throw(ValueError("invalid")),
    )
    with pytest.raises(InvalidGoogleTokenError):
        await verifier.verify("bad-token")

    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: (_ for _ in ()).throw(GoogleAuthError("unavailable")),
    )
    with pytest.raises(GoogleProviderUnavailableError):
        await verifier.verify("signed-token")


@pytest.mark.anyio
async def test_verifier_rejects_use_when_no_google_client_is_configured(monkeypatch):
    verifier = identity_verifier.GoogleIDTokenVerifier(())
    monkeypatch.setattr(
        identity_verifier.id_token,
        "verify_oauth2_token",
        lambda *_: pytest.fail("must not contact Google without client IDs"),
    )

    with pytest.raises(GoogleAuthNotConfiguredError):
        await verifier.verify("signed-token")
