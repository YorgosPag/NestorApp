"""
Export Endpoint Tests

Tests for the /api/v1/dxf/export endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestExportStatus:
    """Test suite for export status endpoint."""

    def test_status_returns_service_info(self, client: TestClient) -> None:
        """Status endpoint should return current configuration."""
        response = client.get("/api/v1/dxf/status")

        assert response.status_code == 200
        data = response.json()

        assert "export_enabled" in data
        assert "max_entities" in data
        assert "max_file_size_mb" in data
        assert "default_version" in data


class TestVersionsList:
    """Test suite for versions endpoint."""

    def test_versions_returns_all_supported(self, client: TestClient) -> None:
        """Versions endpoint should list all supported DXF versions."""
        response = client.get("/api/v1/dxf/versions")

        assert response.status_code == 200
        data = response.json()

        assert "versions" in data
        assert "default" in data
        assert data["default"] == "AC1015"
        assert len(data["versions"]) == 7

        # Check version structure
        first_version = data["versions"][0]
        assert "code" in first_version
        assert "name" in first_version
        assert "notes" in first_version


class TestExportEndpoint:
    """Test suite for export endpoint."""

    def test_export_disabled_by_default(
        self, client: TestClient, sample_scene: dict, sample_settings: dict
    ) -> None:
        """Export should return 503 when feature flag is disabled."""
        response = client.post(
            "/api/v1/dxf/export",
            json={"scene": sample_scene, "settings": sample_settings},
        )

        # Feature flag is OFF by default
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["code"] == "FEATURE_DISABLED"

    @patch("src.config.settings.Settings.feature_flag_enabled", True)
    def test_export_with_feature_flag_enabled(
        self, sample_scene: dict, sample_settings: dict
    ) -> None:
        """Export should work when feature flag is enabled."""
        # Need to create new client after patching
        from src.main import create_app

        with patch("src.config.settings.get_settings") as mock_settings:
            from src.config.settings import Settings

            settings = Settings()
            settings.feature_flag_enabled = True
            mock_settings.return_value = settings

            test_app = create_app()
            client = TestClient(test_app)

            response = client.post(
                "/api/v1/dxf/export",
                json={"scene": sample_scene, "settings": sample_settings},
            )

            # Should succeed or return valid error (not 503)
            assert response.status_code != 503


class TestValidationEndpoint:
    """Test suite for validation endpoint."""

    def test_validate_scene(
        self, client: TestClient, sample_scene: dict
    ) -> None:
        """Validation should work without feature flag."""
        response = client.post(
            "/api/v1/dxf/validate",
            json={"scene": sample_scene, "target_version": "AC1015"},
        )

        assert response.status_code == 200
        data = response.json()

        assert "valid" in data
        assert "total_entities" in data
        assert "exportable_entities" in data
        assert "entity_results" in data

    def test_validate_r12_incompatible_entities(
        self, client: TestClient
    ) -> None:
        """Validation should flag R12-incompatible entities."""
        scene = {
            "entities": [
                {
                    "id": "spline-001",
                    "type": "spline",
                    "layer": "0",
                    "visible": True,
                }
            ],
            "layers": [{"name": "0", "visible": True}],
            "metadata": {},
        }

        response = client.post(
            "/api/v1/dxf/validate",
            json={"scene": scene, "target_version": "AC1009"},  # R12
        )

        assert response.status_code == 200
        data = response.json()

        # Should report issues for R12-incompatible spline
        assert data["valid"] is False or data["issue_summary"]["errors"] > 0

    def test_validate_non_exportable_entity(
        self, client: TestClient
    ) -> None:
        """Validation should flag non-exportable entities."""
        scene = {
            "entities": [
                {
                    "id": "measurement-001",
                    "type": "angle-measurement",
                    "layer": "0",
                    "visible": True,
                }
            ],
            "layers": [{"name": "0", "visible": True}],
            "metadata": {},
        }

        response = client.post(
            "/api/v1/dxf/validate",
            json={"scene": scene, "target_version": "AC1015"},
        )

        assert response.status_code == 200
        data = response.json()

        # angle-measurement should not be exportable
        assert data["non_exportable_entities"] == 1
