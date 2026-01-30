"""
Application Settings - DXF Export Microservice

Enterprise configuration management using Pydantic Settings.
All settings can be overridden via environment variables.

Reference: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Environment variables take precedence over default values.
    Prefix: None (direct variable names for simplicity)
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application Settings
    # -------------------------------------------------------------------------
    app_name: str = Field(default="DXF Export Service", description="Application name")
    app_env: Literal["development", "staging", "production"] = Field(
        default="development", description="Application environment"
    )
    app_host: str = Field(default="0.0.0.0", description="Server host")
    app_port: int = Field(default=8080, ge=1, le=65535, description="Server port")
    debug: bool = Field(default=False, description="Debug mode")

    # -------------------------------------------------------------------------
    # Logging Settings
    # -------------------------------------------------------------------------
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", description="Logging level"
    )
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log message format",
    )

    # -------------------------------------------------------------------------
    # CORS Settings
    # -------------------------------------------------------------------------
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated list of allowed CORS origins",
    )
    cors_allow_credentials: bool = Field(default=True, description="Allow credentials in CORS")
    cors_allow_methods: str = Field(default="GET,POST,OPTIONS", description="Allowed HTTP methods")
    cors_allow_headers: str = Field(default="*", description="Allowed HTTP headers")

    # -------------------------------------------------------------------------
    # DXF Export Settings
    # -------------------------------------------------------------------------
    max_file_size_mb: int = Field(
        default=50, ge=1, le=500, description="Maximum file size in MB"
    )
    default_dxf_version: str = Field(
        default="AC1015", description="Default DXF version (AC1015 = R2000)"
    )
    default_encoding: str = Field(default="utf-8", description="Default text encoding")
    coordinate_precision: int = Field(
        default=6, ge=1, le=15, description="Decimal precision for coordinates"
    )

    # -------------------------------------------------------------------------
    # Feature Flags
    # -------------------------------------------------------------------------
    feature_flag_enabled: bool = Field(
        default=False,
        description="Master feature flag for DXF export (PR-1C dependency)",
    )
    rate_limit_enabled: bool = Field(
        default=False, description="Enable rate limiting (requires Upstash)"
    )

    # -------------------------------------------------------------------------
    # Performance Settings
    # -------------------------------------------------------------------------
    max_entities_per_request: int = Field(
        default=10000, ge=100, le=100000, description="Maximum entities per export request"
    )
    export_timeout_seconds: int = Field(
        default=60, ge=5, le=300, description="Export operation timeout"
    )

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024

    # -------------------------------------------------------------------------
    # Validators
    # -------------------------------------------------------------------------
    @field_validator("default_dxf_version")
    @classmethod
    def validate_dxf_version(cls, v: str) -> str:
        """Validate DXF version is supported."""
        supported = {"AC1009", "AC1015", "AC1018", "AC1021", "AC1024", "AC1027", "AC1032"}
        if v not in supported:
            raise ValueError(f"DXF version must be one of: {supported}")
        return v


@lru_cache
def get_settings() -> Settings:
    """
    Get cached application settings.

    Uses LRU cache to avoid re-parsing environment variables on every call.
    Clear cache with: get_settings.cache_clear()
    """
    return Settings()
