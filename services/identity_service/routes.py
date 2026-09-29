import re

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from dubai_shared.audit import write_audit
from dubai_shared.auth import (
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    AuthUser,
    client_ip,
    create_user_session,
    current_user,
    db_session,
    require_permission,
    revoke_session_token,
    verify_password,
)
from dubai_shared.errors import AppError
from dubai_shared.http import ok
from dubai_shared.models import User
from dubai_shared.rate_limit import (
    is_login_rate_limited,
    record_login_failure,
    reset_login_rate_limit,
)

router = APIRouter()


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginBody(BaseModel):
    email: str
    password: str


def _settings(request: Request):
    return request.app.state.settings


@router.post("/api/auth/login")
def login(
    payload: LoginBody,
    request: Request,
    db: Session = Depends(db_session),
):
    settings = _settings(request)
    if not EMAIL_RE.match(payload.email.strip()) or not payload.password:
        raise AppError("VALIDATION_ERROR", "Identifiants invalides.")
    email = payload.email.strip().lower()
    ip = client_ip(request, settings)
    if is_login_rate_limited(ip, email):
        raise AppError(
            "AUTHENTICATION_ERROR",
            "Trop de tentatives. Réessayez dans quelques minutes.",
            status_code=429,
        )

    user = db.scalar(select(User).where(User.email == email))
    password_ok = (
        bool(user)
        and user.deletedAt is None
        and verify_password(payload.password, user.passwordHash)
    )
    if user is None or user.status != "ACTIVE" or not password_ok:
        record_login_failure(ip, email)
        write_audit(
            db,
            actor_id=user.id if user else None,
            action="auth.login_failed",
            entity_type="User",
            entity_id=user.id if user else email,
            reason="invalid_credentials_or_disabled",
            ip_address=ip,
        )
        raise AppError("AUTHENTICATION_ERROR", "E-mail ou mot de passe incorrect.")

    reset_login_rate_limit(ip, email)
    token = create_user_session(db, user.id)
    write_audit(
        db,
        actor_id=user.id,
        action="auth.login",
        entity_type="User",
        entity_id=user.id,
        ip_address=ip,
    )
    result = ok({"id": user.id, "email": user.email, "fullName": user.fullName})
    result.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path="/",
        max_age=SESSION_TTL_SECONDS,
    )
    return result


@router.post("/api/auth/logout")
def logout(
    request: Request,
    db: Session = Depends(db_session),
):
    settings = _settings(request)
    ip = client_ip(request, settings)
    token = request.cookies.get(SESSION_COOKIE)
    actor_id = None
    session_id = "none"
    if token:
        from dubai_shared.auth import hash_session_token
        from dubai_shared.models import Session as DbSession

        session = db.scalar(
            select(DbSession).where(DbSession.tokenHash == hash_session_token(token))
        )
        if session and session.revokedAt is None:
            actor_id = session.userId
            session_id = session.id
        revoke_session_token(db, token)
    write_audit(
        db,
        actor_id=actor_id,
        action="auth.logout",
        entity_type="Session",
        entity_id=session_id,
        ip_address=ip,
    )
    result = ok({"loggedOut": True})
    result.delete_cookie(SESSION_COOKIE, path="/")
    return result


@router.get("/api/auth/me")
def me(user: AuthUser = Depends(current_user)):
    return ok(user.as_dict())


@router.get("/api/users")
def list_users(
    db: Session = Depends(db_session),
    _user: AuthUser = Depends(require_permission("users.read")),
):
    rows = db.scalars(select(User).where(User.deletedAt.is_(None))).all()
    return ok(
        {
            "users": [
                {
                    "id": row.id,
                    "email": row.email,
                    "fullName": row.fullName,
                    "status": row.status,
                }
                for row in rows
            ]
        }
    )


@router.post("/api/users")
def create_user(_user: AuthUser = Depends(require_permission("users.create"))):
    raise AppError(
        "NOT_IMPLEMENTED",
        "Cette opération n'est pas encore disponible.",
    )


@router.patch("/api/users/{user_id}")
def patch_user(
    user_id: str,
    _user: AuthUser = Depends(require_permission("users.update")),
):
    raise AppError(
        "NOT_IMPLEMENTED",
        "Cette opération n'est pas encore disponible.",
    )
