import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from dubai_shared.models import AuditLog


def write_audit(
    db: Session,
    *,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before: object | None = None,
    after: object | None = None,
    reason: str | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            id=str(uuid4()),
            actorId=actor_id,
            action=action,
            entityType=entity_type,
            entityId=entity_id,
            beforeJson=json.dumps(before) if before is not None else None,
            afterJson=json.dumps(after) if after is not None else None,
            reason=reason,
            ipAddress=ip_address,
            createdAt=datetime.now(UTC).replace(tzinfo=None),
        )
    )
