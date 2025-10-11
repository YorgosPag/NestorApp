-- ============================================================================
-- UNIFIED GEO-ALERT POSTGIS SCHEMA
-- Extracted from geo-canvas system and optimized for Universal Polygon System
-- ============================================================================

-- Enable PostGIS extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROJECTS TABLE - DXF Project Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_projects (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- DXF file metadata
    dxf_filename VARCHAR(500),
    dxf_file_hash VARCHAR(64), -- SHA-256 hash for integrity
    dxf_file_size BIGINT,

    -- Coordinate reference systems
    source_crs VARCHAR(50) DEFAULT 'LOCAL', -- DXF coordinate system
    target_crs VARCHAR(50) DEFAULT 'EPSG:4326', -- WGS84 by default

    -- Transformation parameters (6-parameter affine)
    transform_a DOUBLE PRECISION DEFAULT 1.0,  -- Scale X
    transform_b DOUBLE PRECISION DEFAULT 0.0,  -- Skew X
    transform_c DOUBLE PRECISION DEFAULT 0.0,  -- Translate X
    transform_d DOUBLE PRECISION DEFAULT 0.0,  -- Skew Y
    transform_e DOUBLE PRECISION DEFAULT 1.0,  -- Scale Y
    transform_f DOUBLE PRECISION DEFAULT 0.0,  -- Translate Y

    -- Quality metrics
    rms_error DOUBLE PRECISION,                -- Root Mean Square error
    max_error DOUBLE PRECISION,                -- Maximum error
    confidence_score DOUBLE PRECISION,         -- 0-1 confidence

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    version INTEGER DEFAULT 1
);

-- ============================================================================
-- 2. UNIVERSAL POLYGONS TABLE - Polygon Storage με Universal System Integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS universal_polygons (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES geo_projects(id) ON DELETE CASCADE,

    -- Universal Polygon System fields
    polygon_type VARCHAR(50) NOT NULL DEFAULT 'simple', -- 'simple', 'georeferencing', 'alert-zone', etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Geometry - stores the actual polygon
    geometry GEOMETRY(POLYGON, 4326) NOT NULL, -- WGS84 coordinates

    -- DXF source coordinates (if applicable)
    dxf_geometry GEOMETRY(POLYGON) NULL, -- Local DXF coordinates

    -- Style information (από Universal Polygon System)
    stroke_color VARCHAR(7) DEFAULT '#3b82f6',   -- Hex color
    fill_color VARCHAR(7) DEFAULT '#3b82f6',     -- Hex color
    stroke_width DOUBLE PRECISION DEFAULT 2.0,
    fill_opacity DOUBLE PRECISION DEFAULT 0.2,
    stroke_opacity DOUBLE PRECISION DEFAULT 1.0,
    stroke_dash TEXT NULL, -- JSON array για dash pattern

    -- Metadata
    is_closed BOOLEAN DEFAULT TRUE,
    point_count INTEGER NOT NULL,
    area_sqm DOUBLE PRECISION, -- Calculated area in square meters
    perimeter_m DOUBLE PRECISION, -- Calculated perimeter in meters

    -- Quality metrics (από Universal System validation)
    quality_score DOUBLE PRECISION, -- 0-1 quality score
    validation_errors TEXT, -- JSON array of validation errors

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    version INTEGER DEFAULT 1
);

-- ============================================================================
-- 3. POLYGON POINTS TABLE - Individual Points με Universal System Integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS polygon_points (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    polygon_id UUID REFERENCES universal_polygons(id) ON DELETE CASCADE,

    -- Point position και ordering
    point_order INTEGER NOT NULL, -- 0-based ordering

    -- Coordinates
    geo_point GEOMETRY(POINT, 4326) NOT NULL, -- WGS84 coordinates
    dxf_point GEOMETRY(POINT) NULL, -- Original DXF coordinates

    -- Universal Polygon System fields
    point_id VARCHAR(100) NOT NULL, -- από Universal System
    label VARCHAR(255), -- Human readable label

    -- Control point specific (για georeferencing)
    is_control_point BOOLEAN DEFAULT FALSE,
    geo_accuracy DOUBLE PRECISION, -- ±meters accuracy
    source_type VARCHAR(50), -- 'manual', 'gps', 'survey'

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- ============================================================================
-- 4. ALERT ZONES TABLE - Spatial Alert Monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_zones (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    polygon_id UUID REFERENCES universal_polygons(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- από authentication system

    -- Alert configuration
    zone_name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL, -- 'property_alert', 'construction_alert', etc.
    is_active BOOLEAN DEFAULT TRUE,

    -- Alert rules (simplified JSON for now)
    alert_rules JSONB NOT NULL, -- Alert conditions in JSON format

    -- Notification preferences
    notification_channels TEXT[], -- ['email', 'sms', 'push', 'webhook']
    notification_frequency VARCHAR(50) DEFAULT 'immediate', -- 'immediate', 'daily', 'weekly'

    -- Statistics
    alerts_triggered INTEGER DEFAULT 0,
    last_alert_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- ============================================================================
-- 5. ALERT EVENTS TABLE - Alert History και Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_events (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_zone_id UUID REFERENCES alert_zones(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL, -- Event specific data

    -- Geographic context
    trigger_location GEOMETRY(POINT, 4326), -- Where the alert was triggered
    trigger_polygon GEOMETRY(POLYGON, 4326), -- Related polygon if applicable

    -- Alert processing
    alert_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'dismissed'
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,

    -- Delivery tracking
    notification_results JSONB, -- Delivery results per channel

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- ============================================================================
-- INDEXES για Performance
-- ============================================================================

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_universal_polygons_geometry ON universal_polygons USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_universal_polygons_dxf_geometry ON universal_polygons USING GIST(dxf_geometry);
CREATE INDEX IF NOT EXISTS idx_polygon_points_geo_point ON polygon_points USING GIST(geo_point);
CREATE INDEX IF NOT EXISTS idx_polygon_points_dxf_point ON polygon_points USING GIST(dxf_point);
CREATE INDEX IF NOT EXISTS idx_alert_events_trigger_location ON alert_events USING GIST(trigger_location);
CREATE INDEX IF NOT EXISTS idx_alert_events_trigger_polygon ON alert_events USING GIST(trigger_polygon);

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_universal_polygons_project_id ON universal_polygons(project_id);
CREATE INDEX IF NOT EXISTS idx_universal_polygons_type ON universal_polygons(polygon_type);
CREATE INDEX IF NOT EXISTS idx_polygon_points_polygon_id ON polygon_points(polygon_id);
CREATE INDEX IF NOT EXISTS idx_polygon_points_order ON polygon_points(polygon_id, point_order);
CREATE INDEX IF NOT EXISTS idx_alert_zones_user_id ON alert_zones(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_zones_active ON alert_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_events_zone_id ON alert_events(alert_zone_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(alert_status);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at);

-- Composite indexes για common queries
CREATE INDEX IF NOT EXISTS idx_universal_polygons_project_type ON universal_polygons(project_id, polygon_type);
CREATE INDEX IF NOT EXISTS idx_alert_zones_user_active ON alert_zones(user_id, is_active);

-- ============================================================================
-- VIEWS για Common Queries
-- ============================================================================

-- Complete polygon με points
CREATE OR REPLACE VIEW polygon_with_points AS
SELECT
    p.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', pt.id,
                'point_order', pt.point_order,
                'geo_point', ST_AsGeoJSON(pt.geo_point)::json,
                'dxf_point', CASE WHEN pt.dxf_point IS NOT NULL THEN ST_AsGeoJSON(pt.dxf_point)::json END,
                'point_id', pt.point_id,
                'label', pt.label,
                'is_control_point', pt.is_control_point,
                'geo_accuracy', pt.geo_accuracy,
                'source_type', pt.source_type
            ) ORDER BY pt.point_order
        ) FILTER (WHERE pt.id IS NOT NULL),
        '[]'::json
    ) AS points
FROM universal_polygons p
LEFT JOIN polygon_points pt ON p.id = pt.polygon_id
GROUP BY p.id;

-- Active alert zones με statistics
CREATE OR REPLACE VIEW active_alert_zones AS
SELECT
    az.*,
    p.name AS polygon_name,
    p.polygon_type,
    ST_AsGeoJSON(p.geometry)::json AS zone_geometry,
    COALESCE(recent_events.event_count, 0) AS recent_events_count
FROM alert_zones az
JOIN universal_polygons p ON az.polygon_id = p.id
LEFT JOIN (
    SELECT
        alert_zone_id,
        COUNT(*) AS event_count
    FROM alert_events
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY alert_zone_id
) recent_events ON az.id = recent_events.alert_zone_id
WHERE az.is_active = TRUE;

-- ============================================================================
-- FUNCTIONS για Spatial Operations
-- ============================================================================

-- Function για testing point-in-polygon
CREATE OR REPLACE FUNCTION test_point_in_alert_zones(
    test_point GEOMETRY(POINT, 4326),
    user_filter VARCHAR(255) DEFAULT NULL
) RETURNS TABLE(
    zone_id UUID,
    zone_name VARCHAR(255),
    alert_type VARCHAR(100),
    distance_m DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        az.id,
        az.zone_name,
        az.alert_type,
        ST_Distance(p.geometry::geography, test_point::geography) AS distance_m
    FROM alert_zones az
    JOIN universal_polygons p ON az.polygon_id = p.id
    WHERE az.is_active = TRUE
    AND (user_filter IS NULL OR az.user_id = user_filter)
    AND ST_Intersects(p.geometry, test_point)
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- Function για bulk alert zone testing
CREATE OR REPLACE FUNCTION test_multiple_points_in_zones(
    test_points GEOMETRY(POINT, 4326)[],
    user_filter VARCHAR(255) DEFAULT NULL
) RETURNS TABLE(
    point_index INTEGER,
    zone_id UUID,
    zone_name VARCHAR(255),
    alert_type VARCHAR(100)
) AS $$
DECLARE
    i INTEGER;
    point_geom GEOMETRY(POINT, 4326);
BEGIN
    FOR i IN 1..array_length(test_points, 1) LOOP
        point_geom := test_points[i];

        RETURN QUERY
        SELECT
            i,
            az.id,
            az.zone_name,
            az.alert_type
        FROM alert_zones az
        JOIN universal_polygons p ON az.polygon_id = p.id
        WHERE az.is_active = TRUE
        AND (user_filter IS NULL OR az.user_id = user_filter)
        AND ST_Intersects(p.geometry, point_geom);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS για Documentation
-- ============================================================================

COMMENT ON TABLE geo_projects IS 'DXF project management με transformation parameters';
COMMENT ON TABLE universal_polygons IS 'Universal Polygon System integration με PostGIS storage';
COMMENT ON TABLE polygon_points IS 'Individual polygon points με control point support';
COMMENT ON TABLE alert_zones IS 'Spatial alert monitoring configuration';
COMMENT ON TABLE alert_events IS 'Alert event history και delivery tracking';

COMMENT ON VIEW polygon_with_points IS 'Complete polygon data με embedded points array';
COMMENT ON VIEW active_alert_zones IS 'Active alert zones με recent activity statistics';

COMMENT ON FUNCTION test_point_in_alert_zones IS 'Test single point against all active alert zones';
COMMENT ON FUNCTION test_multiple_points_in_zones IS 'Bulk test multiple points against alert zones';