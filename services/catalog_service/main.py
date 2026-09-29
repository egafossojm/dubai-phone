from catalog_service.routes import router
from dubai_shared.http import create_app

app = create_app("catalog", [router])
