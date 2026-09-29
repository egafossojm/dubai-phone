import os


def test_identity_health(identity_client):
    response = identity_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["service"] == "identity"


def test_identity_ready(identity_client):
    response = identity_client.get("/ready")
    assert response.status_code == 200
    assert response.json()["data"]["schema"] == "migrated"


def test_identity_login_and_me(identity_client):
    password = os.environ.get("SEED_USER_PASSWORD")
    if not password:
        return
    failed = identity_client.post(
        "/api/auth/login",
        json={"email": "admin@dubai-phone.local", "password": "wrong-password"},
    )
    assert failed.status_code == 401
    assert failed.json()["error"]["code"] == "AUTHENTICATION_ERROR"

    login = identity_client.post(
        "/api/auth/login",
        json={"email": "admin@dubai-phone.local", "password": password},
    )
    assert login.status_code == 200
    assert login.json()["success"] is True
    assert identity_client.cookies.get("dp_session")

    me = identity_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "admin@dubai-phone.local"

    users = identity_client.get("/api/users")
    assert users.status_code == 200
    assert "users" in users.json()["data"]
