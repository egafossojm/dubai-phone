from typing import Any


STATUS_BY_CODE = {
    "VALIDATION_ERROR": 400,
    "AUTHENTICATION_ERROR": 401,
    "AUTHORIZATION_ERROR": 403,
    "NOT_FOUND": 404,
    "CONFLICT": 409,
    "BUSINESS_RULE_ERROR": 422,
    "NOT_IMPLEMENTED": 501,
    "INFRASTRUCTURE_ERROR": 503,
    "INTERNAL_ERROR": 500,
}


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code or STATUS_BY_CODE.get(code, 500)
        self.details = details
