class GoogleAuthNotConfiguredError(Exception):
    """Raised when Google login is called without configured client IDs."""


class GoogleProviderUnavailableError(Exception):
    """Raised when Google's public verification service cannot be reached."""


class InvalidGoogleTokenError(Exception):
    """Raised when the supplied Google ID token is invalid or incomplete."""


class GoogleAccountLinkRequiredError(Exception):
    """Raised when an authorized local account has not linked Google yet."""


class GoogleAccountLinkFailedError(Exception):
    """Raised when local credentials cannot authorize a Google account link."""


class GoogleIdentityConflictError(Exception):
    """Raised when a Google subject is already assigned to another user."""
