"""
Health Endpoint Tests

Tests for the /health endpoints.
"""

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    """Test suite for health check endpoints."""

    def test_health_check_returns_200(self, client: TestClient) -> None:
        """Health check should return 200 with service info."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()

        assert data["healthy"] is True
        assert "version" in data
        assert "ezdxf_version" in data
        assert "python_version" in data
        assert "supported_versions" in data
        assert len(data["supported_versions"]) == 7  # AC1009 through AC1032

    def test_liveness_probe(self, client: TestClient) -> None:
        """Liveness probe should return simple alive status."""
        response = client.get("/health/live")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"

    def test_readiness_probe_success(self, client: TestClient) -> None:
        """Readiness probe should verify ezdxf and config."""
        response = client.get("/health/ready")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "ready"
        assert data["checks"]["ezdxf"] is True
        assert data["checks"]["config"] is True

    def test_service_info(self, client: TestClient) -> None:
        """Service info should return detailed information."""
        response = client.get("/health/info")

        assert response.status_code == 200
        data = response.json()

        assert "service" in data
        assert "runtime" in data
        assert "libraries" in data
        assert "capabilities" in data

        assert data["service"]["version"] == "1.0.0"
        assert "ezdxf" in data["libraries"]


class TestRootEndpoint:
    """Test suite for root endpoint."""

    def test_root_returns_service_info(self, client: TestClient) -> None:
        """Root endpoint should return service overview."""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()

        assert data["service"] == "DXF Export Microservice"
        assert data["version"] == "1.0.0"
        assert "/docs" in data["docs"]
        assert "/health" in data["health"]
