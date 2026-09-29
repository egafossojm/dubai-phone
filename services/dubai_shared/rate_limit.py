from datetime import UTC, datetime, timedelta

WINDOW_MS = 15 * 60 * 1000
MAX_ATTEMPTS_EMAIL = 5
MAX_ATTEMPTS_IP = 30

_buckets: dict[str, tuple[int, datetime]] = {}


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _read(key: str) -> tuple[int, datetime] | None:
    current = _buckets.get(key)
    if current is None:
        return None
    count, reset_at = current
    if reset_at <= _now():
        _buckets.pop(key, None)
        return None
    return count, reset_at


def _bump(key: str) -> None:
    current = _read(key)
    if current is None:
        _buckets[key] = (1, _now() + timedelta(milliseconds=WINDOW_MS))
        return
    count, reset_at = current
    _buckets[key] = (count + 1, reset_at)


def record_login_failure(ip: str, email: str) -> None:
    _bump(f"email:{email.strip().lower()}")
    if ip.strip().lower() != "unknown":
        _bump(f"ip:{ip.strip().lower()}")


def is_login_rate_limited(ip: str, email: str) -> bool:
    email_bucket = _read(f"email:{email.strip().lower()}")
    if email_bucket and email_bucket[0] >= MAX_ATTEMPTS_EMAIL:
        return True
    if ip.strip().lower() == "unknown":
        return False
    ip_bucket = _read(f"ip:{ip.strip().lower()}")
    return bool(ip_bucket and ip_bucket[0] >= MAX_ATTEMPTS_IP)


def reset_login_rate_limit(ip: str, email: str) -> None:
    _buckets.pop(f"email:{email.strip().lower()}", None)
    _buckets.pop(f"ip:{ip.strip().lower()}", None)
