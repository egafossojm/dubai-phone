from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from dubai_shared.auth import AuthUser, db_session, require_permission
from dubai_shared.errors import AppError
from dubai_shared.http import ok
from dubai_shared.models import AuditLog
from reporting_service.dashboard import get_dashboard
from reporting_service.dashboard_policies import DASHBOARD_CUSTOM_MAX_DAYS, inclusive_day_span

router = APIRouter()


@router.get("/api/dashboard")
def dashboard(
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("dashboard.read")),
    period: str = Query("today"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
):
    if period not in {"today", "week", "month", "custom"}:
        raise AppError("VALIDATION_ERROR", "Filtres tableau de bord invalides.")
    if period == "custom":
        if not from_ or not to:
            raise AppError(
                "VALIDATION_ERROR",
                "Filtres tableau de bord invalides.",
                details={"from": ["Période personnalisée : from et to (YYYY-MM-DD) requis."]},
            )
        if from_ > to:
            raise AppError(
                "VALIDATION_ERROR",
                "Filtres tableau de bord invalides.",
                details={"from": ["La date de début doit précéder la date de fin."]},
            )
        if inclusive_day_span(from_, to) > DASHBOARD_CUSTOM_MAX_DAYS:
            raise AppError(
                "VALIDATION_ERROR",
                "Filtres tableau de bord invalides.",
                details={"to": [f"Période trop longue (max {DASHBOARD_CUSTOM_MAX_DAYS} jours)."]},
            )
    payload = get_dashboard(db, user, period, from_, to)
    return ok(payload)


@router.get("/api/audit")
def list_audit(
    db: Session = Depends(db_session),
    _user: AuthUser = Depends(require_permission("audit.read")),
):
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.createdAt.desc()).limit(50)
    ).all()
    return ok(
        {
            "logs": [
                {
                    "id": row.id,
                    "action": row.action,
                    "entityType": row.entityType,
                    "createdAt": row.createdAt.isoformat(),
                }
                for row in rows
            ]
        }
    )


@router.get("/api/reports")
def reports(_user: AuthUser = Depends(require_permission("reports.read"))):
    return ok({"message": "Rapports détaillés : phase ultérieure"})
