-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - MASTER DEPLOYMENT SCRIPT
-- ============================================================================
--
-- 🚀 Complete deployment script for Contact Relationship Management System
-- Execute this file to deploy the entire schema in the correct order
--
-- Environment: Configure before running
-- Target: PostgreSQL 13+ / MySQL 8+ / SQLite 3.38+
--
-- ============================================================================

-- ============================================================================
-- DEPLOYMENT CONFIGURATION
-- ============================================================================

-- Set deployment environment (development, staging, production)
-- Change this to match your target environment
\set ENVIRONMENT 'development'

-- Enable/disable seed data loading (set to 'false' for production)
\set LOAD_SEED_DATA 'true'

-- Enable/disable verbose logging
\set VERBOSE 'true'

-- ============================================================================
-- PRE-DEPLOYMENT VALIDATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Contact Relationships Schema Deployment';
    RAISE NOTICE '📅 Deployment Date: %', NOW();
    RAISE NOTICE '🏷️ Environment: %', :'ENVIRONMENT';
    RAISE NOTICE '🌱 Load Seed Data: %', :'LOAD_SEED_DATA';
    RAISE NOTICE '';

    -- Check PostgreSQL version
    IF version() !~ 'PostgreSQL (1[3-9]|[2-9][0-9])' THEN
        RAISE WARNING 'This schema is optimized for PostgreSQL 13+. Current version: %', version();
    END IF;

    -- Environment safety check
    IF :'ENVIRONMENT' = 'production' AND :'LOAD_SEED_DATA' = 'true' THEN
        RAISE EXCEPTION 'Cannot load seed data in production environment. Set LOAD_SEED_DATA to false.';
    END IF;
END $$;

-- ============================================================================
-- DEPLOYMENT SEQUENCE
-- ============================================================================

-- Begin transaction for atomic deployment
BEGIN;

RAISE NOTICE '📋 Step 1/8: Creating core tables...';
\i 01-tables.sql

RAISE NOTICE '🚀 Step 2/8: Creating performance indexes...';
\i 02-indexes.sql

RAISE NOTICE '🔄 Step 3/8: Installing triggers and functions...';
\i 03-triggers.sql

RAISE NOTICE '📊 Step 4/8: Creating business intelligence views...';
\i 04-views.sql

RAISE NOTICE '🔧 Step 5/8: Installing stored procedures...';
\i 05-procedures.sql

-- Conditional seed data loading
\if :`LOAD_SEED_DATA`
    RAISE NOTICE '🌱 Step 6/8: Loading sample data (development/testing only)...';
    \i 06-seed-data.sql
\else
    RAISE NOTICE '⏭️ Step 6/8: Skipping seed data (production mode)...';
\endif

RAISE NOTICE '🛠️ Step 7/8: Installing maintenance procedures...';
\i 07-maintenance.sql

RAISE NOTICE '📋 Step 8/8: Setting up schema versioning and metadata...';
\i schema-info.sql

-- ============================================================================
-- POST-DEPLOYMENT VALIDATION
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '✅ Deployment completed. Running validation...';

-- Schema integrity validation
DO $$
DECLARE
    validation_record RECORD;
    all_passed BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE '🔍 Schema Integrity Validation:';

    FOR validation_record IN
        SELECT * FROM validate_schema_integrity()
    LOOP
        RAISE NOTICE '  % - %: %',
            validation_record.validation_item,
            validation_record.status,
            validation_record.details;

        IF validation_record.status = 'FAIL' THEN
            all_passed := FALSE;
        END IF;
    END LOOP;

    IF NOT all_passed THEN
        RAISE WARNING 'Some validation checks failed. Please review the output above.';
    END IF;
END $$;

-- Data integrity validation
DO $$
DECLARE
    integrity_record RECORD;
    critical_issues BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Data Integrity Validation:';

    FOR integrity_record IN
        SELECT * FROM check_relationship_data_integrity()
    LOOP
        RAISE NOTICE '  % - %: % (Issues: %)',
            integrity_record.check_name,
            integrity_record.status,
            integrity_record.description,
            integrity_record.issue_count;

        IF integrity_record.status = 'FAIL' THEN
            critical_issues := TRUE;
        END IF;
    END LOOP;

    IF critical_issues THEN
        RAISE WARNING 'Critical data integrity issues detected. Please investigate.';
    END IF;
END $$;

-- Schema statistics
DO $$
DECLARE
    stats_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 Schema Statistics:';

    FOR stats_record IN
        SELECT * FROM get_schema_statistics()
    LOOP
        RAISE NOTICE '  %: %',
            stats_record.metric_name,
            stats_record.metric_value;
    END LOOP;
END $$;

-- ============================================================================
-- DEPLOYMENT COMPLETION
-- ============================================================================

-- Record deployment in migrations table
INSERT INTO schema_migrations (
    version,
    description,
    migration_type,
    applied_by,
    environment,
    migration_notes
) VALUES (
    'DEPLOY_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS'),
    'Complete schema deployment via deploy.sql',
    'deployment',
    CURRENT_USER,
    :'ENVIRONMENT',
    'Full deployment including tables, indexes, triggers, views, procedures, and maintenance functions'
);

-- Set migration environment
SELECT set_migration_environment(:'ENVIRONMENT');

-- Commit the transaction
COMMIT;

-- ============================================================================
-- SUCCESS NOTIFICATION
-- ============================================================================

DO $$
DECLARE
    current_version_info RECORD;
BEGIN
    SELECT * INTO current_version_info FROM get_schema_version() LIMIT 1;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 ============================================================================';
    RAISE NOTICE '✅ DEPLOYMENT SUCCESSFUL!';
    RAISE NOTICE '🎉 ============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Schema: Contact Relationships Management System';
    RAISE NOTICE '🏷️ Version: %', current_version_info.current_version;
    RAISE NOTICE '📅 Release Date: %', current_version_info.release_date;
    RAISE NOTICE '🌍 Environment: %', :'ENVIRONMENT';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Components Deployed:';
    RAISE NOTICE '  ✅ Core Tables (4)';
    RAISE NOTICE '  ✅ Performance Indexes (25+)';
    RAISE NOTICE '  ✅ Automated Triggers (6+)';
    RAISE NOTICE '  ✅ Business Intelligence Views (6)';
    RAISE NOTICE '  ✅ Stored Procedures (8+)';
    RAISE NOTICE '  ✅ Maintenance Functions';
    RAISE NOTICE '  ✅ Version Tracking System';

    IF :'LOAD_SEED_DATA' = 'true' THEN
        RAISE NOTICE '  ✅ Sample Data (Development)';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🛠️ Next Steps:';
    RAISE NOTICE '  1. Run application tests to verify integration';
    RAISE NOTICE '  2. Update application configuration if needed';
    RAISE NOTICE '  3. Schedule regular maintenance: SELECT daily_relationship_maintenance()';
    RAISE NOTICE '  4. Monitor performance with: SELECT * FROM get_schema_statistics()';
    RAISE NOTICE '';
    RAISE NOTICE '📖 Documentation: README.md in this directory';
    RAISE NOTICE '🔗 Integration: Update ContactRelationshipService configuration';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ============================================================================';
END $$;

-- ============================================================================
-- DEPLOYMENT SCRIPT COMPLETED
-- ============================================================================

-- Generate deployment report (optional)
\if :`VERBOSE`
    \echo ''
    \echo '📄 Deployment Report:'
    \echo ''

    SELECT
        '🏷️ Schema Version' as component,
        current_version as details
    FROM get_schema_version()

    UNION ALL

    SELECT
        '📊 ' || metric_name as component,
        metric_value::text as details
    FROM get_schema_statistics()

    ORDER BY component;
\endif

-- End of Deployment Script