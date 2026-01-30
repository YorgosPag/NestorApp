# DXF Export Microservice

Enterprise-grade Python microservice for DXF export using ezdxf library.

## Overview

This microservice provides a REST API for converting Nestor scene models to DXF format. It uses the [ezdxf](https://ezdxf.readthedocs.io/) library (MIT License) for DXF generation.

**Technology Decision**: See [docs/strategy/01-dxf-technology-decision.md](../../docs/strategy/01-dxf-technology-decision.md)

## Features

- **Multi-version DXF Export**: Supports AC1009 (R12) through AC1032 (R2018)
- **Entity Mapping**: Converts Nestor entity types to DXF entities
- **Layer Management**: Full layer support with visibility and locking
- **Pre-export Validation**: Check compatibility before generating DXF
- **Feature Flag Protection**: Export gated until rate limiting is deployed
- **Docker Ready**: Production-ready containerization

## Quick Start

### Local Development

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements-dev.txt

# Run development server
uvicorn src.main:app --reload --port 8080
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build image directly
docker build -t dxf-export-service .
docker run -p 8080:8080 dxf-export-service
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Full health check with service info |
| `/health/live` | GET | Liveness probe (Kubernetes) |
| `/health/ready` | GET | Readiness probe with dependency checks |
| `/api/v1/dxf/export` | POST | Export scene to DXF |
| `/api/v1/dxf/validate` | POST | Validate scene before export |
| `/api/v1/dxf/versions` | GET | List supported DXF versions |
| `/api/v1/dxf/status` | GET | Service configuration status |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | development | Environment (development/staging/production) |
| `APP_PORT` | 8080 | Server port |
| `LOG_LEVEL` | INFO | Logging level |
| `CORS_ORIGINS` | localhost:3000,3001 | Allowed CORS origins |
| `FEATURE_FLAG_ENABLED` | false | Enable export (requires PR-1C) |
| `MAX_FILE_SIZE_MB` | 50 | Maximum export file size |
| `MAX_ENTITIES_PER_REQUEST` | 10000 | Maximum entities per export |

## Testing

```bash
# Run all tests with coverage
pytest

# Run specific test file
pytest tests/test_health.py -v

# Run with markers
pytest -m "unit"          # Unit tests only
pytest -m "not slow"      # Skip slow tests
```

## Project Structure

```
services/dxf-export/
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Container orchestration
├── pyproject.toml          # Project configuration (PEP 621)
├── requirements.txt        # Production dependencies
├── requirements-dev.txt    # Development dependencies
├── README.md              # This file
├── src/
│   ├── __init__.py
│   ├── main.py            # FastAPI application
│   ├── api/
│   │   ├── __init__.py
│   │   ├── health.py      # Health check endpoints
│   │   └── export.py      # DXF export endpoints
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py    # Pydantic settings
│   ├── models/
│   │   ├── __init__.py
│   │   └── export_models.py  # Pydantic models
│   └── services/
│       ├── __init__.py
│       └── dxf_export_service.py  # Business logic
└── tests/
    ├── __init__.py
    ├── conftest.py        # Pytest fixtures
    ├── test_health.py     # Health endpoint tests
    └── test_export.py     # Export endpoint tests
```

## API Contract

The API models are synchronized with TypeScript types at:
`src/subapps/dxf-viewer/types/dxf-export.types.ts`

See [ADR-052: DXF Export API Contract](../../src/subapps/dxf-viewer/docs/centralized_systems.md#adr-052)

## Feature Flag

Export functionality is disabled by default (`FEATURE_FLAG_ENABLED=false`).

This gate exists until PR-1C (rate limiting with Upstash) is complete.

To enable for testing:
```bash
FEATURE_FLAG_ENABLED=true docker-compose up
```

## References

- [ezdxf Documentation](https://ezdxf.readthedocs.io/)
- [DXF Technology Decision](../../docs/strategy/01-dxf-technology-decision.md)
- [DXF Export Test Strategy](../../docs/testing/DXF_EXPORT_TEST_STRATEGY.md)
- [DXF Export Storage Strategy](../../docs/strategy/DXF_EXPORT_STORAGE_STRATEGY.md)

## License

MIT License - See [LICENSE](LICENSE) for details.
