import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dubai_shared.db import configure_engine
from dubai_shared.settings import Settings


def _load_repo_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_repo_env()


def _settings() -> Settings:
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL is required for service tests")
    return Settings(
        database_url=url,
        service_name="test",
        node_env="test",
        trusted_proxy="0",
        next_public_app_url="http://localhost:3000",
    )


@pytest.fixture(scope="session")
def settings():
    return _settings()


@pytest.fixture(scope="session")
def identity_client(settings):
    configure_engine(settings)
    from identity_service.main import app

    app.state.settings = settings
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def catalog_client(settings):
    configure_engine(settings)
    from catalog_service.main import app

    app.state.settings = settings
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def reporting_client(settings):
    configure_engine(settings)
    from reporting_service.main import app

    app.state.settings = settings
    with TestClient(app) as client:
        yield client
