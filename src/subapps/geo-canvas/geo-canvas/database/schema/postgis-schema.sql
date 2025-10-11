-- ============================================================================
-- POSTGIS SPATIAL DATABASE SCHEMA
-- Geo-Alert System - Phase 4: Enterprise Spatial Data Management
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
    transform_a DOUBLE PRECISION, -- Scale/rotation X
    transform_b DOUBLE PRECISION, -- Skew/rotation
    transform_c DOUBLE PRECISION, -- Translation X
    transform_d DOUBLE PRECISION, -- Skew/rotation
    transform_e DOUBLE PRECISION, -- Scale/rotation Y
    transform_f DOUBLE PRECISION, -- Translation Y

    -- Transformation quality metrics
    rms_error DOUBLE PRECISION,
    transformation_method VARCHAR(50) DEFAULT 'affine',
    is_calibrated BOOLEAN DEFAULT FALSE,

    -- Spatial bounds (in target CRS)
    spatial_bounds GEOMETRY(POLYGON, 4326),

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),

    -- Constraints
    CONSTRAINT geo_projects_name_unique UNIQUE(name),
    CONSTRAINT geo_projects_transform_check CHECK (
        (is_calibrated = FALSE) OR
        (is_calibrated = TRUE AND transform_a IS NOT NULL AND transform_e IS NOT NULL)
    )
);

-- Spatial index για bounds
CREATE INDEX IF NOT EXISTS idx_geo_projects_spatial_bounds
ON geo_projects USING GIST (spatial_bounds);

-- Index για project lookup
CREATE INDEX IF NOT EXISTS idx_geo_projects_name
ON geo_projects (name);

-- ============================================================================
-- 2. CONTROL POINTS TABLE - Ground Control Points
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_control_points (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES geo_projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    description TEXT,

    -- DXF local coordinates
    dxf_x DOUBLE PRECISION NOT NULL,
    dxf_y DOUBLE PRECISION NOT NULL,
    dxf_z DOUBLE PRECISION,

    -- Geographic coordinates (WGS84)
    geo_point GEOMETRY(POINTZ, 4326) NOT NULL,

    -- Accuracy and quality
    accuracy_meters DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    accuracy_source VARCHAR(100), -- GPS, Survey, Estimate, etc.

    -- Point classification
    point_type VARCHAR(50) DEFAULT 'control', -- control, check, tie
    is_active BOOLEAN DEFAULT TRUE,

    -- Usage statistics
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT geo_control_points_accuracy_positive CHECK (accuracy_meters > 0),
    CONSTRAINT geo_control_points_project_name_unique
        UNIQUE(project_id, name)
);

-- Spatial index για geographic points
CREATE INDEX IF NOT EXISTS idx_geo_control_points_geo_point
ON geo_control_points USING GIST (geo_point);

-- Index για project queries
CREATE INDEX IF NOT EXISTS idx_geo_control_points_project_id
ON geo_control_points (project_id);

-- Index για accuracy-based queries
CREATE INDEX IF NOT EXISTS idx_geo_control_points_accuracy
ON geo_control_points (accuracy_meters);

-- ============================================================================
-- 3. SPATIAL ENTITIES TABLE - Transformed DXF Geometries
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_spatial_entities (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES geo_projects(id) ON DELETE CASCADE,

    -- DXF entity metadata
    dxf_entity_id VARCHAR(100), -- Original DXF entity ID
    dxf_entity_type VARCHAR(50) NOT NULL, -- LINE, CIRCLE, POLYLINE, TEXT, etc.
    dxf_layer VARCHAR(255),
    dxf_color VARCHAR(50),

    -- Original DXF geometry (in local coordinates)
    dxf_geometry GEOMETRY, -- Local coordinate system

    -- Transformed geographic geometry (WGS84)
    geo_geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,

    -- Geometry properties
    length_meters DOUBLE PRECISION, -- For linear features
    area_square_meters DOUBLE PRECISION, -- For polygonal features
    perimeter_meters DOUBLE PRECISION, -- For polygonal features

    -- Transformation quality
    transformation_error DOUBLE PRECISION,
    is_valid_geometry BOOLEAN DEFAULT TRUE,

    -- Entity properties (JSON for flexible attributes)
    properties JSONB,

    -- Spatial bounds
    bbox GEOMETRY(POLYGON, 4326),

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT geo_spatial_entities_geometry_valid CHECK (ST_IsValid(geo_geometry))
);

-- Spatial index για geographic geometries
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_geo_geometry
ON geo_spatial_entities USING GIST (geo_geometry);

-- Spatial index για bounding boxes
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_bbox
ON geo_spatial_entities USING GIST (bbox);

-- Index για project queries
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_project_id
ON geo_spatial_entities (project_id);

-- Index για entity type queries
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_type
ON geo_spatial_entities (dxf_entity_type);

-- Index για layer queries
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_layer
ON geo_spatial_entities (dxf_layer);

-- GIN index για properties JSON queries
CREATE INDEX IF NOT EXISTS idx_geo_spatial_entities_properties
ON geo_spatial_entities USING GIN (properties);

-- ============================================================================
-- 4. ACCURACY METRICS TABLE - Quality Assurance Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_accuracy_metrics (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES geo_projects(id) ON DELETE CASCADE,

    -- Metric type and calculation
    metric_type VARCHAR(50) NOT NULL, -- RMS, CE90, CE95, LE90, LE95, GDOP
    metric_value DOUBLE PRECISION NOT NULL,
    metric_unit VARCHAR(20) DEFAULT 'meters',

    -- Calculation metadata
    calculation_method VARCHAR(100),
    sample_size INTEGER,
    confidence_level DOUBLE PRECISION, -- For circular/linear error metrics

    -- Spatial distribution analysis
    gdop_value DOUBLE PRECISION, -- Geometric Dilution of Precision
    spatial_distribution_score DOUBLE PRECISION, -- 0-100 quality score

    -- Quality classification
    quality_level VARCHAR(20), -- EXCELLENT, GOOD, FAIR, POOR, UNACCEPTABLE
    meets_standards BOOLEAN,
    standard_reference VARCHAR(100), -- ASPRS, ISO, etc.

    -- Calculation context
    control_points_used INTEGER,
    calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index για project queries
CREATE INDEX IF NOT EXISTS idx_geo_accuracy_metrics_project_id
ON geo_accuracy_metrics (project_id);

-- Index για metric type queries
CREATE INDEX IF NOT EXISTS idx_geo_accuracy_metrics_type
ON geo_accuracy_metrics (metric_type);

-- Index για quality level queries
CREATE INDEX IF NOT EXISTS idx_geo_accuracy_metrics_quality
ON geo_accuracy_metrics (quality_level);

-- ============================================================================
-- 5. AUDIT LOG TABLE - Change Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_audit_log (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to affected record
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    project_id UUID REFERENCES geo_projects(id) ON DELETE CASCADE,

    -- Operation details
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- User and session context
    user_id VARCHAR(255),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT geo_audit_log_operation_check
        CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Index για audit queries
CREATE INDEX IF NOT EXISTS idx_geo_audit_log_table_record
ON geo_audit_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_geo_audit_log_project_id
ON geo_audit_log (project_id);

CREATE INDEX IF NOT EXISTS idx_geo_audit_log_created_at
ON geo_audit_log (created_at);

-- ============================================================================
-- 6. SPATIAL ANALYSIS VIEWS - Predefined Analytical Queries
-- ============================================================================

-- View: Project summary με accuracy statistics
CREATE OR REPLACE VIEW geo_project_summary AS
SELECT
    p.id,
    p.name,
    p.description,
    p.is_calibrated,
    p.rms_error,
    p.target_crs,

    -- Control points statistics
    COUNT(cp.id) as control_points_count,
    AVG(cp.accuracy_meters) as avg_accuracy,
    MIN(cp.accuracy_meters) as best_accuracy,
    MAX(cp.accuracy_meters) as worst_accuracy,

    -- Spatial entities statistics
    COUNT(se.id) as entities_count,
    COUNT(DISTINCT se.dxf_layer) as layers_count,
    COUNT(DISTINCT se.dxf_entity_type) as entity_types_count,

    -- Spatial extent
    ST_Envelope(ST_Collect(cp.geo_point)) as control_points_envelope,
    ST_Envelope(ST_Collect(se.geo_geometry)) as entities_envelope,

    p.created_at,
    p.updated_at

FROM geo_projects p
LEFT JOIN geo_control_points cp ON p.id = cp.project_id AND cp.is_active = TRUE
LEFT JOIN geo_spatial_entities se ON p.id = se.project_id
GROUP BY p.id, p.name, p.description, p.is_calibrated, p.rms_error,
         p.target_crs, p.created_at, p.updated_at;

-- View: Accuracy quality classification
CREATE OR REPLACE VIEW geo_accuracy_classification AS
SELECT
    cp.id,
    cp.project_id,
    cp.name,
    cp.accuracy_meters,

    CASE
        WHEN cp.accuracy_meters <= 0.5 THEN 'EXCELLENT'
        WHEN cp.accuracy_meters <= 1.0 THEN 'GOOD'
        WHEN cp.accuracy_meters <= 2.0 THEN 'FAIR'
        WHEN cp.accuracy_meters <= 5.0 THEN 'POOR'
        ELSE 'UNACCEPTABLE'
    END as accuracy_class,

    CASE
        WHEN cp.accuracy_meters <= 0.5 THEN '#10B981'
        WHEN cp.accuracy_meters <= 1.0 THEN '#3B82F6'
        WHEN cp.accuracy_meters <= 2.0 THEN '#F59E0B'
        WHEN cp.accuracy_meters <= 5.0 THEN '#EF4444'
        ELSE '#9333EA'
    END as color_code,

    cp.geo_point,
    cp.created_at

FROM geo_control_points cp
WHERE cp.is_active = TRUE;

-- ============================================================================
-- 7. TRIGGERS - Automatic Updates και Audit Logging
-- ============================================================================

-- Function για automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers για updated_at
CREATE TRIGGER update_geo_projects_updated_at
    BEFORE UPDATE ON geo_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_control_points_updated_at
    BEFORE UPDATE ON geo_control_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_spatial_entities_updated_at
    BEFORE UPDATE ON geo_spatial_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function για audit logging
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    project_uuid UUID;
BEGIN
    -- Extract project_id from the record
    IF TG_TABLE_NAME = 'geo_projects' THEN
        project_uuid := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'geo_control_points' THEN
        project_uuid := COALESCE(NEW.project_id, OLD.project_id);
    ELSIF TG_TABLE_NAME = 'geo_spatial_entities' THEN
        project_uuid := COALESCE(NEW.project_id, OLD.project_id);
    END IF;

    INSERT INTO geo_audit_log (
        table_name,
        record_id,
        project_id,
        operation,
        old_values,
        new_values
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        project_uuid,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Audit triggers
CREATE TRIGGER audit_geo_projects
    AFTER INSERT OR UPDATE OR DELETE ON geo_projects
    FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_geo_control_points
    AFTER INSERT OR UPDATE OR DELETE ON geo_control_points
    FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_geo_spatial_entities
    AFTER INSERT OR UPDATE OR DELETE ON geo_spatial_entities
    FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- ============================================================================
-- 8. INITIAL DATA SETUP
-- ============================================================================

-- Create a default project για testing
INSERT INTO geo_projects (
    name,
    description,
    target_crs,
    created_by
) VALUES (
    'Default Test Project',
    'Initial project για testing PostGIS integration',
    'EPSG:4326',
    'system'
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================

-- Verify PostGIS version
SELECT PostGIS_Version();

-- Show all created tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'geo_%';