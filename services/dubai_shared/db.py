from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from dubai_shared.settings import Settings

_engine = None
_SessionLocal = None


def configure_engine(settings: Settings) -> None:
    global _engine, _SessionLocal
    _engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def get_engine():
    if _engine is None:
        raise RuntimeError("Database engine is not configured")
    return _engine


def session_scope() -> Generator[Session, None, None]:
    if _SessionLocal is None:
        raise RuntimeError("Database engine is not configured")
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
