import os


def test_catalog_health(catalog_client):
    response = catalog_client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["data"]["service"] == "catalog"


def test_catalog_requires_auth(catalog_client):
    response = catalog_client.get("/api/products")
    assert response.status_code == 401


def test_catalog_list_products_as_admin(catalog_client, identity_client):
    password = os.environ.get("SEED_USER_PASSWORD")
    if not password:
        return
    login = identity_client.post(
        "/api/auth/login",
        json={"email": "admin@dubai-phone.local", "password": password},
    )
    assert login.status_code == 200
    token = identity_client.cookies.get("dp_session")
    catalog_client.cookies.set("dp_session", token)
    products = catalog_client.get("/api/products")
    assert products.status_code == 200
    body = products.json()
    assert body["success"] is True
    assert "items" in body["data"]
    brands = catalog_client.get("/api/brands")
    assert brands.status_code == 200
    categories = catalog_client.get("/api/categories")
    assert categories.status_code == 200
