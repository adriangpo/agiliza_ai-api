from fastapi import FastAPI

from src.shared.infrastructure.config.settings import app_settings


def create_app() -> FastAPI:
    app = FastAPI(
        title=app_settings.APP_NAME,
        version=app_settings.API_VERSION,
        debug=app_settings.DEBUG,
    )

    return app


app = create_app()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}