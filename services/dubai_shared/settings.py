from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str
    service_name: str = "dubai-phone"
    node_env: str = "development"
    trusted_proxy: str = "0"
    next_public_app_url: str = "http://localhost:3000"
    log_level: str = "info"

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url.replace("?schema=public", "").replace("&schema=public", "")
        if url.startswith("postgresql://") and "+psycopg" not in url:
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def trusted_proxy_enabled(self) -> bool:
        return self.trusted_proxy.strip() in {"1", "true", "TRUE", "yes"}


def load_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
