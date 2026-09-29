from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Annotated
from uuid import uuid4

import bcrypt
from fastapi import Cookie, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from dubai_shared.db import session_scope
from dubai_shared.errors import AppError
from dubai_shared.models import Permission, Role, RolePermission, User, UserRole
from dubai_shared.models import Session as DbSession
from dubai_shared.settings import Settings

SESSION_COOKIE = "dp_session"
SESSION_TTL_SECONDS = 60 * 60 * 12


class AuthUser:
    def __init__(
        self,
        id: str,
        email: str,
        full_name: str,
        roles: list[str],
        permissions: list[str],
    ) -> None:
        self.id = id
        self.email = email
        self.fullName = full_name
        self.roles = roles
        self.permissions = permissions

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "fullName": self.fullName,
            "roles": self.roles,
            "permissions": self.permissions,
        }


def hash_session_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_session_token() -> str:
    return token_urlsafe(32)


def verify_password(plain: str, password_hash: str) -> bool:
    if not (password_hash.startswith("$2a$") or password_hash.startswith("$2b$")):
        return False
    return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))


def db_session() -> Session:
    yield from session_scope()


def client_ip(request, settings: Settings) -> str:
    if not settings.trusted_proxy_enabled:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return (request.headers.get("x-real-ip") or "unknown").strip()


def get_user_from_token(db: Session, token: str) -> AuthUser | None:
    session = db.scalar(
        select(DbSession).where(DbSession.tokenHash == hash_session_token(token))
    )
    if session is None:
        return None
    now = datetime.now(UTC).replace(tzinfo=None)
    if session.revokedAt is not None or session.expiresAt <= now:
        return None
    user = db.scalar(select(User).where(User.id == session.userId))
    if user is None or user.status != "ACTIVE" or user.deletedAt is not None:
        return None

    rows = db.execute(
        select(Role.code, Permission.code)
        .select_from(UserRole)
        .join(Role, Role.id == UserRole.roleId)
        .join(RolePermission, RolePermission.roleId == Role.id)
        .join(Permission, Permission.id == RolePermission.permissionId)
        .where(UserRole.userId == user.id)
    ).all()
    roles = sorted({row[0] for row in rows})
    permissions = sorted({row[1] for row in rows})
    return AuthUser(user.id, user.email, user.fullName, roles, permissions)


def create_user_session(db: Session, user_id: str) -> str:
    now = datetime.now(UTC).replace(tzinfo=None)
    db.execute(
        update(DbSession)
        .where(DbSession.userId == user_id, DbSession.revokedAt.is_(None))
        .values(revokedAt=now)
    )
    token = create_session_token()
    db.add(
        DbSession(
            id=str(uuid4()),
            userId=user_id,
            tokenHash=hash_session_token(token),
            expiresAt=now + timedelta(seconds=SESSION_TTL_SECONDS),
            revokedAt=None,
            createdAt=now,
        )
    )
    db.flush()
    return token


def revoke_session_token(db: Session, token: str) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    db.execute(
        update(DbSession)
        .where(
            DbSession.tokenHash == hash_session_token(token),
            DbSession.revokedAt.is_(None),
        )
        .values(revokedAt=now)
    )


def current_user(
    db: Annotated[Session, Depends(db_session)],
    dp_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> AuthUser:
    if not dp_session:
        raise AppError(
            "AUTHENTICATION_ERROR",
            "Session expirée. Veuillez vous reconnecter.",
        )
    user = get_user_from_token(db, dp_session)
    if user is None:
        raise AppError(
            "AUTHENTICATION_ERROR",
            "Session expirée. Veuillez vous reconnecter.",
        )
    return user


def require_permission(code: str):
    def dependency(user: Annotated[AuthUser, Depends(current_user)]) -> AuthUser:
        if code not in user.permissions:
            raise AppError("AUTHORIZATION_ERROR", "Action non autorisée.")
        return user

    return dependency
