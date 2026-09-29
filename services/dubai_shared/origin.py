from urllib.parse import urlparse

from starlette.requests import Request

from dubai_shared.errors import AppError
from dubai_shared.settings import Settings


def assert_mutating_origin(request: Request, settings: Settings) -> None:
    if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if not origin:
        return
    app_url = settings.next_public_app_url.strip()
    if not app_url:
        return
    expected = urlparse(app_url).scheme + "://" + urlparse(app_url).netloc
    actual = urlparse(origin).scheme + "://" + urlparse(origin).netloc
    if expected != actual:
        raise AppError(
            "AUTHENTICATION_ERROR",
            "Origine de la requête non autorisée.",
            status_code=403,
        )
