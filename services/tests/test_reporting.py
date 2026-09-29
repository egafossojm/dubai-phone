import os


def test_reporting_health(reporting_client):
    response = reporting_client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"]["service"] == "reporting"


def test_reporting_dashboard_as_admin(reporting_client, identity_client):
    password = os.environ.get("SEED_USER_PASSWORD")
    if not password:
        return
    login = identity_client.post(
        "/api/auth/login",
        json={"email": "admin@dubai-phone.local", "password": password},
    )
    assert login.status_code == 200
    reporting_client.cookies.set("dp_session", identity_client.cookies.get("dp_session"))
    dashboard = reporting_client.get("/api/dashboard?period=today")
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["success"] is True
    assert "saleCount" in body["data"]
    audit = reporting_client.get("/api/audit")
    assert audit.status_code == 200
    reports = reporting_client.get("/api/reports")
    assert reports.status_code == 200
