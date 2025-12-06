-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - MAINTENANCE PROCEDURES
-- ============================================================================
--
-- 🔧 Database maintenance and optimization procedures
-- Enterprise-grade maintenance functions for Contact Relationship Management System
--
-- Features:
-- - Hierarchy cache maintenance
-- - Performance optimization
-- - Data cleanup procedures
-- - Analytics and reporting utilities
-- - System health monitoring
--
-- ============================================================================

-- ============================================================================
-- HIERARCHY CACHE MAINTENANCE
-- ============================================================================

-- Refresh hierarchy cache for all organizations
CREATE OR REPLACE FUNCTION refresh_hierarchy_cache()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER := 0;
    org_record RECORD;
    cache_record RECORD;
BEGIN
    RAISE NOTICE 'Starting hierarchy cache refresh...';

    -- Delete all stale cache entries
    DELETE FROM organization_hierarchy_cache WHERE is_stale = TRUE;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Deleted % stale cache entries', affected_rows;

    -- Rebuild cache for organizations with employment relationships
    FOR org_record IN
        SELECT DISTINCT target_contact_id AS org_id
        FROM contact_relationships
        WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
        AND status = 'active'
    LOOP
        -- Clear existing cache for this organization
        DELETE FROM organization_hierarchy_cache
        WHERE organization_id = org_record.org_id;

        -- Rebuild cache entries for this organization
        INSERT INTO organization_hierarchy_cache (
            organization_id,
            employee_id,
            relationship_id,
            hierarchy_level,
            hierarchy_path,
            parent_id,
            department_name,
            department_size,
            is_stale
        )
        SELECT
            cr.target_contact_id,
            cr.source_contact_id,
            cr.id,
            COALESCE(cr.reporting_level, 0),
            ARRAY[cr.source_contact_id], -- Simplified path for now
            mgr_rel.source_contact_id,
            cr.department,
            (SELECT COUNT(*)
             FROM contact_relationships dept_count
             WHERE dept_count.target_contact_id = cr.target_contact_id
             AND dept_count.department = cr.department
             AND dept_count.status = 'active'),
            FALSE
        FROM contact_relationships cr
        LEFT JOIN contact_relationships mgr_rel ON cr.direct_manager_relationship_id = mgr_rel.id
        WHERE cr.target_contact_id = org_record.org_id
        AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
        AND cr.status = 'active';

    END LOOP;

    -- Calculate total affected rows
    SELECT COUNT(*) INTO affected_rows FROM organization_hierarchy_cache WHERE is_stale = FALSE;

    RAISE NOTICE 'Hierarchy cache refresh completed. % entries rebuilt.', affected_rows;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA CLEANUP PROCEDURES
-- ============================================================================

-- Cleanup old audit records (retain for compliance period)
CREATE OR REPLACE FUNCTION cleanup_old_audit_records(
    retention_months INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date TIMESTAMP;
    deleted_rows INTEGER := 0;
BEGIN
    cutoff_date := NOW() - INTERVAL '1 month' * retention_months;

    RAISE NOTICE 'Cleaning up audit records older than % months (before %)', retention_months, cutoff_date;

    -- Delete old change history records
    DELETE FROM relationship_change_history
    WHERE change_date < cutoff_date;

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % old audit records', deleted_rows;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql;

-- Cleanup orphaned relationship documents
CREATE OR REPLACE FUNCTION cleanup_orphaned_documents()
RETURNS INTEGER AS $$
DECLARE
    deleted_rows INTEGER := 0;
BEGIN
    RAISE NOTICE 'Cleaning up orphaned relationship documents...';

    -- Delete documents for non-existent relationships
    DELETE FROM relationship_documents
    WHERE relationship_id NOT IN (
        SELECT id FROM contact_relationships
    );

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % orphaned documents', deleted_rows;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql;

-- Archive terminated relationships older than specified period
CREATE OR REPLACE FUNCTION archive_old_terminated_relationships(
    archive_months INTEGER DEFAULT 60
)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date DATE;
    archived_rows INTEGER := 0;
    temp_table_name TEXT;
BEGIN
    cutoff_date := CURRENT_DATE - INTERVAL '1 month' * archive_months;
    temp_table_name := 'archived_relationships_' || TO_CHAR(NOW(), 'YYYY_MM_DD');

    RAISE NOTICE 'Archiving terminated relationships older than % months (before %)', archive_months, cutoff_date;

    -- Create archive table if it doesn't exist
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I AS
        SELECT * FROM contact_relationships
        WHERE FALSE', temp_table_name);

    -- Move old terminated relationships to archive
    EXECUTE format('
        INSERT INTO %I
        SELECT * FROM contact_relationships
        WHERE status = ''terminated''
        AND end_date < %L', temp_table_name, cutoff_date);

    GET DIAGNOSTICS archived_rows = ROW_COUNT;

    -- Delete archived records from main table
    DELETE FROM contact_relationships
    WHERE status = 'terminated'
    AND end_date < cutoff_date;

    RAISE NOTICE 'Archived % terminated relationships to table %', archived_rows, temp_table_name;
    RETURN archived_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze and update table statistics
CREATE OR REPLACE FUNCTION update_relationship_statistics()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Updating table statistics for relationship tables...';

    -- Update statistics for better query planning
    ANALYZE contact_relationships;
    ANALYZE relationship_change_history;
    ANALYZE relationship_documents;
    ANALYZE organization_hierarchy_cache;

    RAISE NOTICE 'Table statistics updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Reindex relationship tables for optimal performance
CREATE OR REPLACE FUNCTION reindex_relationship_tables()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Reindexing relationship tables...';

    -- Reindex main table
    REINDEX TABLE contact_relationships;
    REINDEX TABLE relationship_change_history;
    REINDEX TABLE relationship_documents;
    REINDEX TABLE organization_hierarchy_cache;

    RAISE NOTICE 'Reindexing completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Vacuum and cleanup table bloat
CREATE OR REPLACE FUNCTION vacuum_relationship_tables()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Vacuuming relationship tables...';

    -- Vacuum tables to reclaim space
    VACUUM ANALYZE contact_relationships;
    VACUUM ANALYZE relationship_change_history;
    VACUUM ANALYZE relationship_documents;
    VACUUM ANALYZE organization_hierarchy_cache;

    RAISE NOTICE 'Vacuum completed successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANALYTICS AND REPORTING UTILITIES
-- ============================================================================

-- Generate relationship analytics report
CREATE OR REPLACE FUNCTION generate_relationship_analytics_report()
RETURNS TABLE (
    metric_name TEXT,
    metric_value BIGINT,
    metric_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'total_relationships'::TEXT,
        COUNT(*)::BIGINT,
        'Total number of relationships in the system'::TEXT
    FROM contact_relationships
    UNION ALL
    SELECT
        'active_relationships'::TEXT,
        COUNT(*)::BIGINT,
        'Number of active relationships'::TEXT
    FROM contact_relationships
    WHERE status = 'active'
    UNION ALL
    SELECT
        'employment_relationships'::TEXT,
        COUNT(*)::BIGINT,
        'Number of employment-type relationships'::TEXT
    FROM contact_relationships
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    UNION ALL
    SELECT
        'shareholder_relationships'::TEXT,
        COUNT(*)::BIGINT,
        'Number of shareholder relationships'::TEXT
    FROM contact_relationships
    WHERE relationship_type = 'shareholder'
    UNION ALL
    SELECT
        'organizations_with_employees'::TEXT,
        COUNT(DISTINCT target_contact_id)::BIGINT,
        'Number of organizations with employees'::TEXT
    FROM contact_relationships
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND status = 'active'
    UNION ALL
    SELECT
        'audit_records'::TEXT,
        COUNT(*)::BIGINT,
        'Number of audit trail records'::TEXT
    FROM relationship_change_history
    UNION ALL
    SELECT
        'relationship_documents'::TEXT,
        COUNT(*)::BIGINT,
        'Number of attached documents'::TEXT
    FROM relationship_documents
    UNION ALL
    SELECT
        'hierarchy_cache_entries'::TEXT,
        COUNT(*)::BIGINT,
        'Number of hierarchy cache entries'::TEXT
    FROM organization_hierarchy_cache;
END;
$$ LANGUAGE plpgsql;

-- Check data integrity and consistency
CREATE OR REPLACE FUNCTION check_relationship_data_integrity()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    issue_count BIGINT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check for orphaned manager relationships
    SELECT
        'orphaned_manager_refs'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        COUNT(*)::BIGINT,
        'Relationships with invalid manager reference'::TEXT
    FROM contact_relationships cr
    WHERE cr.direct_manager_relationship_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM contact_relationships mgr
        WHERE mgr.id = cr.direct_manager_relationship_id
    )
    UNION ALL
    -- Check for invalid ownership percentages
    SELECT
        'invalid_ownership'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        COUNT(*)::BIGINT,
        'Shareholder relationships with invalid ownership percentage'::TEXT
    FROM contact_relationships
    WHERE relationship_type = 'shareholder'
    AND (ownership_percentage IS NULL OR ownership_percentage < 0 OR ownership_percentage > 100)
    UNION ALL
    -- Check for date logic violations
    SELECT
        'invalid_date_logic'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
        COUNT(*)::BIGINT,
        'Relationships with end_date before start_date'::TEXT
    FROM contact_relationships
    WHERE end_date IS NOT NULL
    AND start_date IS NOT NULL
    AND end_date < start_date
    UNION ALL
    -- Check for stale hierarchy cache
    SELECT
        'stale_hierarchy_cache'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS'::TEXT ELSE 'WARNING'::TEXT END,
        COUNT(*)::BIGINT,
        'Stale hierarchy cache entries that need refresh'::TEXT
    FROM organization_hierarchy_cache
    WHERE is_stale = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BACKUP AND RESTORE UTILITIES
-- ============================================================================

-- Create backup of relationship data
CREATE OR REPLACE FUNCTION backup_relationship_data(
    backup_suffix TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    backup_timestamp TEXT;
    backup_name TEXT;
BEGIN
    backup_timestamp := TO_CHAR(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
    backup_name := 'backup_contact_relationships_' ||
                   backup_timestamp ||
                   COALESCE('_' || backup_suffix, '');

    RAISE NOTICE 'Creating relationship data backup: %', backup_name;

    -- Create backup tables
    EXECUTE format('CREATE TABLE %I AS SELECT * FROM contact_relationships', backup_name);
    EXECUTE format('CREATE TABLE %I AS SELECT * FROM relationship_change_history', backup_name || '_history');
    EXECUTE format('CREATE TABLE %I AS SELECT * FROM relationship_documents', backup_name || '_documents');

    RAISE NOTICE 'Backup created successfully: %', backup_name;
    RETURN backup_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPREHENSIVE MAINTENANCE PROCEDURE
-- ============================================================================

-- Run all maintenance procedures in sequence
CREATE OR REPLACE FUNCTION run_comprehensive_maintenance(
    cleanup_audit_months INTEGER DEFAULT 24,
    archive_terminated_months INTEGER DEFAULT 60
)
RETURNS TABLE (
    procedure_name TEXT,
    status TEXT,
    records_affected INTEGER,
    execution_time INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    affected_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting comprehensive maintenance procedures...';

    -- 1. Update statistics
    start_time := clock_timestamp();
    PERFORM update_relationship_statistics();
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'update_statistics'::TEXT,
        'SUCCESS'::TEXT,
        0::INTEGER,
        (end_time - start_time)::INTERVAL;

    -- 2. Refresh hierarchy cache
    start_time := clock_timestamp();
    SELECT refresh_hierarchy_cache() INTO affected_count;
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'refresh_hierarchy_cache'::TEXT,
        'SUCCESS'::TEXT,
        affected_count,
        (end_time - start_time)::INTERVAL;

    -- 3. Cleanup old audit records
    start_time := clock_timestamp();
    SELECT cleanup_old_audit_records(cleanup_audit_months) INTO affected_count;
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'cleanup_audit_records'::TEXT,
        'SUCCESS'::TEXT,
        affected_count,
        (end_time - start_time)::INTERVAL;

    -- 4. Cleanup orphaned documents
    start_time := clock_timestamp();
    SELECT cleanup_orphaned_documents() INTO affected_count;
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'cleanup_orphaned_documents'::TEXT,
        'SUCCESS'::TEXT,
        affected_count,
        (end_time - start_time)::INTERVAL;

    -- 5. Archive old terminated relationships
    start_time := clock_timestamp();
    SELECT archive_old_terminated_relationships(archive_terminated_months) INTO affected_count;
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'archive_terminated_relationships'::TEXT,
        'SUCCESS'::TEXT,
        affected_count,
        (end_time - start_time)::INTERVAL;

    -- 6. Vacuum tables
    start_time := clock_timestamp();
    PERFORM vacuum_relationship_tables();
    end_time := clock_timestamp();
    RETURN QUERY SELECT
        'vacuum_tables'::TEXT,
        'SUCCESS'::TEXT,
        0::INTEGER,
        (end_time - start_time)::INTERVAL;

    RAISE NOTICE 'Comprehensive maintenance completed successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED MAINTENANCE HELPERS
-- ============================================================================

-- Daily maintenance procedure
CREATE OR REPLACE FUNCTION daily_relationship_maintenance()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Running daily relationship maintenance...';

    -- Update statistics
    PERFORM update_relationship_statistics();

    -- Check for stale cache and refresh if needed
    IF EXISTS (SELECT 1 FROM organization_hierarchy_cache WHERE is_stale = TRUE LIMIT 1) THEN
        PERFORM refresh_hierarchy_cache();
    END IF;

    RAISE NOTICE 'Daily maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Weekly maintenance procedure
CREATE OR REPLACE FUNCTION weekly_relationship_maintenance()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Running weekly relationship maintenance...';

    -- Run daily maintenance first
    PERFORM daily_relationship_maintenance();

    -- Cleanup orphaned documents
    PERFORM cleanup_orphaned_documents();

    -- Vacuum tables
    PERFORM vacuum_relationship_tables();

    RAISE NOTICE 'Weekly maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Monthly maintenance procedure
CREATE OR REPLACE FUNCTION monthly_relationship_maintenance()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Running monthly relationship maintenance...';

    -- Run weekly maintenance first
    PERFORM weekly_relationship_maintenance();

    -- Cleanup old audit records (keep 24 months)
    PERFORM cleanup_old_audit_records(24);

    -- Reindex tables
    PERFORM reindex_relationship_tables();

    -- Run data integrity checks
    PERFORM check_relationship_data_integrity();

    RAISE NOTICE 'Monthly maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAINTENANCE COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION refresh_hierarchy_cache() IS 'Rebuilds organization hierarchy cache for optimal performance';
COMMENT ON FUNCTION cleanup_old_audit_records(INTEGER) IS 'Removes audit records older than specified months for compliance';
COMMENT ON FUNCTION cleanup_orphaned_documents() IS 'Removes documents for non-existent relationships';
COMMENT ON FUNCTION generate_relationship_analytics_report() IS 'Generates comprehensive analytics report for relationship data';
COMMENT ON FUNCTION check_relationship_data_integrity() IS 'Validates data integrity and identifies potential issues';
COMMENT ON FUNCTION run_comprehensive_maintenance(INTEGER, INTEGER) IS 'Executes all maintenance procedures in optimal sequence';

-- End of Maintenance Procedures