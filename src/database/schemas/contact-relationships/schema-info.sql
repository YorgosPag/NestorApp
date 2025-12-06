-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - SCHEMA INFORMATION & MIGRATIONS
-- ============================================================================
--
-- 📋 Schema versioning, migration tracking, and metadata management
-- Enterprise-grade schema evolution and documentation system
--
-- Features:
-- - Schema version tracking
-- - Migration history and rollback support
-- - Database metadata documentation
-- - Deployment validation
-- - Environment management
--
-- ============================================================================

-- ============================================================================
-- SCHEMA MIGRATIONS TABLE
-- ============================================================================

-- Table to track schema versions and migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    migration_type VARCHAR(20) DEFAULT 'schema', -- 'schema', 'data', 'index', 'procedure'
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(100) NOT NULL,
    execution_time INTERVAL,
    rollback_script TEXT,
    checksum VARCHAR(64),
    environment VARCHAR(20) DEFAULT 'development', -- 'development', 'staging', 'production'

    -- Migration metadata
    requires_downtime BOOLEAN DEFAULT FALSE,
    affects_tables TEXT[],
    breaking_changes BOOLEAN DEFAULT FALSE,
    migration_notes TEXT,

    -- Validation
    pre_migration_validation TEXT,
    post_migration_validation TEXT,
    validation_status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'passed', 'failed'
);

-- ============================================================================
-- SCHEMA VERSION INFORMATION
-- ============================================================================

-- Current schema version and information
CREATE TABLE IF NOT EXISTS schema_info (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(100) NOT NULL DEFAULT 'contact_relationships',
    current_version VARCHAR(50) NOT NULL,
    release_date DATE NOT NULL,
    database_engine VARCHAR(50),
    min_engine_version VARCHAR(20),

    -- Schema statistics
    tables_count INTEGER,
    indexes_count INTEGER,
    triggers_count INTEGER,
    procedures_count INTEGER,
    views_count INTEGER,

    -- Documentation
    description TEXT,
    changelog TEXT,
    documentation_url TEXT,

    -- Maintenance
    last_maintenance_date TIMESTAMP WITH TIME ZONE,
    next_maintenance_due TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MIGRATION HISTORY TRACKING
-- ============================================================================

-- Initial schema migration record
INSERT INTO schema_migrations (
    version,
    description,
    migration_type,
    applied_by,
    affects_tables,
    migration_notes
) VALUES (
    '001_initial_schema',
    'Initial Contact Relationships schema with full enterprise features',
    'schema',
    'system',
    ARRAY['contact_relationships', 'relationship_change_history', 'relationship_documents', 'organization_hierarchy_cache'],
    'Complete enterprise relationship management schema with tables, indexes, triggers, views, and procedures'
);

-- Modular structure migration
INSERT INTO schema_migrations (
    version,
    description,
    migration_type,
    applied_by,
    affects_tables,
    breaking_changes,
    migration_notes
) VALUES (
    '002_modular_structure',
    'Refactored schema into modular Enterprise structure',
    'schema',
    'system',
    ARRAY['contact_relationships', 'relationship_change_history', 'relationship_documents', 'organization_hierarchy_cache'],
    FALSE,
    'Split monolithic schema file into separate modules: tables, indexes, triggers, views, procedures, seed-data, maintenance, and schema-info'
);

-- ============================================================================
-- CURRENT SCHEMA INFORMATION
-- ============================================================================

-- Insert current schema information
INSERT INTO schema_info (
    schema_name,
    current_version,
    release_date,
    database_engine,
    min_engine_version,
    tables_count,
    indexes_count,
    triggers_count,
    procedures_count,
    views_count,
    description,
    changelog
) VALUES (
    'contact_relationships',
    '002_modular_structure',
    CURRENT_DATE,
    'PostgreSQL',
    '13.0',
    4, -- contact_relationships, relationship_change_history, relationship_documents, organization_hierarchy_cache
    25, -- Estimated index count
    6,  -- Estimated trigger count
    8,  -- Estimated procedure count
    6,  -- Estimated view count
    'Enterprise Contact Relationship Management System - Comprehensive schema for managing professional relationships, organizational hierarchies, and business connections',
    '
    Version 002_modular_structure (Current):
    - Refactored into modular Enterprise structure
    - Separated concerns: tables, indexes, triggers, views, procedures
    - Added comprehensive maintenance procedures
    - Enhanced documentation and migration tracking

    Version 001_initial_schema:
    - Initial implementation with all core features
    - Complete table structure with enterprise fields
    - Performance-optimized indexes
    - Audit trail and hierarchy cache systems
    '
);

-- ============================================================================
-- SCHEMA VALIDATION FUNCTIONS
-- ============================================================================

-- Validate schema integrity
CREATE OR REPLACE FUNCTION validate_schema_integrity()
RETURNS TABLE (
    validation_item TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check if all required tables exist
    SELECT
        'required_tables'::TEXT,
        CASE WHEN COUNT(*) = 4 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'Found ' || COUNT(*)::TEXT || ' of 4 required tables'::TEXT
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('contact_relationships', 'relationship_change_history', 'relationship_documents', 'organization_hierarchy_cache')

    UNION ALL

    -- Check if primary indexes exist
    SELECT
        'primary_indexes'::TEXT,
        CASE WHEN COUNT(*) >= 10 THEN 'PASS'::TEXT ELSE 'WARNING'::TEXT END,
        'Found ' || COUNT(*)::TEXT || ' relationship-related indexes'::TEXT
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE '%relationship%'

    UNION ALL

    -- Check if triggers are installed
    SELECT
        'triggers'::TEXT,
        CASE WHEN COUNT(*) >= 4 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        'Found ' || COUNT(*)::TEXT || ' triggers on relationship tables'::TEXT
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND event_object_table IN ('contact_relationships', 'relationship_documents')

    UNION ALL

    -- Check if views exist
    SELECT
        'views'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS'::TEXT ELSE 'WARNING'::TEXT END,
        'Found ' || COUNT(*)::TEXT || ' relationship views'::TEXT
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name LIKE 'v_%relationship%'

    UNION ALL

    -- Check if stored procedures exist
    SELECT
        'procedures'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS'::TEXT ELSE 'WARNING'::TEXT END,
        'Found ' || COUNT(*)::TEXT || ' relationship-related procedures'::TEXT
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE '%relationship%';
END;
$$ LANGUAGE plpgsql;

-- Get current schema version
CREATE OR REPLACE FUNCTION get_schema_version()
RETURNS TABLE (
    current_version TEXT,
    release_date DATE,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.current_version::TEXT,
        si.release_date,
        si.description
    FROM schema_info si
    WHERE si.schema_name = 'contact_relationships'
    ORDER BY si.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION UTILITIES
-- ============================================================================

-- Check if a migration has been applied
CREATE OR REPLACE FUNCTION is_migration_applied(migration_version TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM schema_migrations
        WHERE version = migration_version
    ) INTO migration_exists;

    RETURN migration_exists;
END;
$$ LANGUAGE plpgsql;

-- Record a new migration
CREATE OR REPLACE FUNCTION record_migration(
    migration_version TEXT,
    migration_description TEXT,
    migration_type_param TEXT DEFAULT 'schema',
    applied_by_param TEXT DEFAULT 'system',
    execution_time_param INTERVAL DEFAULT NULL,
    migration_notes_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO schema_migrations (
        version,
        description,
        migration_type,
        applied_by,
        execution_time,
        migration_notes
    ) VALUES (
        migration_version,
        migration_description,
        migration_type_param,
        applied_by_param,
        execution_time_param,
        migration_notes_param
    );

    RAISE NOTICE 'Migration % recorded successfully', migration_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA STATISTICS AND MONITORING
-- ============================================================================

-- Get comprehensive schema statistics
CREATE OR REPLACE FUNCTION get_schema_statistics()
RETURNS TABLE (
    metric_name TEXT,
    metric_value BIGINT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'total_relationships'::TEXT,
        COUNT(*)::BIGINT,
        MAX(updated_at)
    FROM contact_relationships

    UNION ALL

    SELECT
        'active_relationships'::TEXT,
        COUNT(*)::BIGINT,
        MAX(updated_at)
    FROM contact_relationships
    WHERE status = 'active'

    UNION ALL

    SELECT
        'total_audit_records'::TEXT,
        COUNT(*)::BIGINT,
        MAX(created_at)
    FROM relationship_change_history

    UNION ALL

    SELECT
        'total_documents'::TEXT,
        COUNT(*)::BIGINT,
        MAX(created_at)
    FROM relationship_documents

    UNION ALL

    SELECT
        'cache_entries'::TEXT,
        COUNT(*)::BIGINT,
        MAX(last_updated)
    FROM organization_hierarchy_cache

    UNION ALL

    SELECT
        'schema_migrations'::TEXT,
        COUNT(*)::BIGINT,
        MAX(applied_at)
    FROM schema_migrations;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEPLOYMENT VALIDATION
-- ============================================================================

-- Comprehensive deployment validation
CREATE OR REPLACE FUNCTION validate_deployment()
RETURNS TABLE (
    check_category TEXT,
    check_name TEXT,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    -- Schema integrity checks
    RETURN QUERY
    SELECT
        'Schema'::TEXT,
        vi.validation_item,
        vi.status,
        vi.details
    FROM validate_schema_integrity() vi;

    -- Data integrity checks
    RETURN QUERY
    SELECT
        'Data'::TEXT,
        di.check_name,
        di.status,
        di.description
    FROM check_relationship_data_integrity() di;

    -- Performance checks
    RETURN QUERY
    SELECT
        'Performance'::TEXT,
        'table_sizes'::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'INFO'::TEXT ELSE 'WARNING'::TEXT END,
        'Main table contains ' || COUNT(*)::TEXT || ' relationships'
    FROM contact_relationships;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENVIRONMENT MANAGEMENT
-- ============================================================================

-- Set environment for migrations
CREATE OR REPLACE FUNCTION set_migration_environment(env_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF env_name NOT IN ('development', 'staging', 'production') THEN
        RAISE EXCEPTION 'Invalid environment name. Must be: development, staging, or production';
    END IF;

    -- Update future migrations to use this environment
    CREATE TEMP TABLE IF NOT EXISTS migration_config (
        environment TEXT
    );

    DELETE FROM migration_config;
    INSERT INTO migration_config VALUES (env_name);

    RAISE NOTICE 'Migration environment set to: %', env_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DOCUMENTATION HELPERS
-- ============================================================================

-- Generate schema documentation
CREATE OR REPLACE FUNCTION generate_schema_documentation()
RETURNS TEXT AS $$
DECLARE
    doc_text TEXT;
    table_count INTEGER;
    index_count INTEGER;
    procedure_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE '%relationship%';

    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE '%relationship%';

    SELECT COUNT(*) INTO procedure_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE '%relationship%';

    doc_text := format(
        E'# Contact Relationships Schema Documentation\n\n' ||
        '## Overview\n' ||
        'Enterprise Contact Relationship Management System\n\n' ||
        '## Schema Statistics\n' ||
        '- Tables: %s\n' ||
        '- Indexes: %s\n' ||
        '- Procedures: %s\n\n' ||
        '## Current Version\n' ||
        'Version: %s\n' ||
        'Last Updated: %s\n\n' ||
        '## Components\n' ||
        '- **01-tables.sql**: Core table definitions\n' ||
        '- **02-indexes.sql**: Performance optimization indexes\n' ||
        '- **03-triggers.sql**: Automated triggers and functions\n' ||
        '- **04-views.sql**: Business intelligence views\n' ||
        '- **05-procedures.sql**: Stored procedures for complex operations\n' ||
        '- **06-seed-data.sql**: Sample data for testing\n' ||
        '- **07-maintenance.sql**: Database maintenance procedures\n' ||
        '- **schema-info.sql**: Version tracking and metadata\n',
        table_count,
        index_count,
        procedure_count,
        (SELECT current_version FROM schema_info WHERE schema_name = 'contact_relationships' LIMIT 1),
        (SELECT updated_at FROM schema_info WHERE schema_name = 'contact_relationships' LIMIT 1)
    );

    RETURN doc_text;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC SCHEMA VERSION UPDATE
-- ============================================================================

-- Update schema info timestamp
UPDATE schema_info
SET updated_at = NOW()
WHERE schema_name = 'contact_relationships';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE schema_migrations IS 'Tracks all schema migrations applied to the database';
COMMENT ON TABLE schema_info IS 'Contains current schema version and metadata information';

COMMENT ON FUNCTION validate_schema_integrity() IS 'Validates that all required schema components are properly installed';
COMMENT ON FUNCTION get_schema_version() IS 'Returns current schema version information';
COMMENT ON FUNCTION validate_deployment() IS 'Comprehensive validation for deployment verification';
COMMENT ON FUNCTION generate_schema_documentation() IS 'Generates markdown documentation for the schema';

-- Log schema info initialization
DO $$
BEGIN
    RAISE NOTICE 'Contact Relationships schema information and migration tracking initialized';
    RAISE NOTICE 'Current schema version: %', (SELECT current_version FROM schema_info WHERE schema_name = 'contact_relationships' LIMIT 1);
END $$;

-- End of Schema Information