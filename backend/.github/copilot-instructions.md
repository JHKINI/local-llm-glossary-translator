# Project Guidelines

## Architecture

- `main.py` is the application entrypoint: it creates the FastAPI app, configures CORS, defines the `TranslateRequest` schema, and owns both routes.
- `GET /` is a health check. `POST /translate` accepts `text`, optional `source` (default `"auto"`), and optional `target` (default `"en"`), and returns a `translated` field. Translation is currently a placeholder, not a provider integration.

## Build and Test

- Run the API locally with `python -m uvicorn main:app --reload` from the repository root.
- No build step, test runner, linter, or project test files are currently configured.

## Conventions

- Keep request validation and defaults in Pydantic models; the translation endpoint receives a `TranslateRequest` and returns a JSON object.
- The app currently enables CORS for all origins, methods, and headers. Review this configuration if changing the API's deployment or client access requirements.
