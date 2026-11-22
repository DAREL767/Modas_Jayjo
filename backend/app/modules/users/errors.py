class UserError(Exception):
    """Base exception for user use cases."""


class DuplicateUserError(UserError):
    """Raised when a username or email is already registered."""


class UserNotFoundError(UserError):
    """Raised when a requested user does not exist."""


class InvalidUserIdError(UserError):
    """Raised when a user identifier is not a valid MongoDB ObjectId."""


class EmptyUserUpdateError(UserError):
    """Raised when an update contains no fields."""


class CannotModifySelfError(UserError):
    """Raised when an administrator attempts to remove their own access."""


class LastActiveAdminError(UserError):
    """Raised when an operation would leave no active administrator."""
