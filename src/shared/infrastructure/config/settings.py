from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Application
    APP_NAME: str = "Agiliza Aí"
    DEBUG: bool = False
    API_VERSION: str = "v1"

    # Database
    DATABASE_URL: str

    # CORS
    CORS_ORIGINS: list[str] = ["*"]
    CORS_CREDENTIALS: bool = True


app_settings = AppSettings()