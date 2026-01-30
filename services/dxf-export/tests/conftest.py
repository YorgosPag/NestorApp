"""
Pytest Configuration and Fixtures

Provides shared fixtures for DXF Export Microservice tests.
"""

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def client() -> TestClient:
    """Synchronous test client fixture."""
    return TestClient(app)


@pytest.fixture
async def async_client() -> AsyncClient:
    """Asynchronous test client fixture."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_scene() -> dict:
    """Sample scene for export tests."""
    return {
        "entities": [
            {
                "id": "line-001",
                "type": "line",
                "layer": "0",
                "visible": True,
                "start": {"x": 0, "y": 0},
                "end": {"x": 100, "y": 100},
            },
            {
                "id": "circle-001",
                "type": "circle",
                "layer": "0",
                "visible": True,
                "center": {"x": 50, "y": 50},
                "radius": 25,
            },
            {
                "id": "rect-001",
                "type": "rectangle",
                "layer": "Layer1",
                "visible": True,
                "points": [
                    {"x": 0, "y": 0},
                    {"x": 100, "y": 0},
                    {"x": 100, "y": 50},
                    {"x": 0, "y": 50},
                ],
                "closed": True,
            },
        ],
        "layers": [
            {"name": "0", "visible": True, "locked": False},
            {"name": "Layer1", "visible": True, "locked": False, "color": "#FF0000"},
        ],
        "metadata": {"name": "test-drawing"},
    }


@pytest.fixture
def sample_settings() -> dict:
    """Sample export settings for tests."""
    return {
        "version": "AC1015",
        "units": "millimeters",
        "encoding": "utf-8",
        "quality": {
            "coordinate_precision": 6,
            "simplify_polylines": False,
            "simplify_tolerance": 0.001,
            "splines_as_polylines": False,
            "spline_segments": 32,
            "merge_colinear_lines": False,
            "remove_duplicates": False,
            "duplicate_tolerance": 0.0001,
        },
        "layers": {
            "visible_only": True,
            "include_locked": False,
            "flatten_to_layer": None,
            "layer_mapping": {},
            "default_layer": "0",
        },
        "include_metadata": True,
        "include_timestamp": True,
        "application_name": "Nestor DXF Viewer",
        "header_variables": {},
    }
