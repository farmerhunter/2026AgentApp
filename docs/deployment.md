# Deployment

## Target

The planned deployment target is a lightweight cloud server or Docker container. The server may run:

- Agent runtime
- Webhook or upload service
- Dashboard web app
- Markdown/JSON storage
- LLM provider integration

## Configuration

Use environment variables for all provider keys and deployment-specific settings.

Example variable names:

- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `RUNTIME_DATA_DIR`
- `DASHBOARD_PORT`

Do not commit real values. Keep local values in `.env`, which is ignored by Git.

## Runtime Data

Generated records should be written to `runtime/` in local development or to a configured data directory in production.
