-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - TRIGGERS & FUNCTIONS
-- ============================================================================
--
-- 🔄 Automated triggers and functions for Contact Relationship Management System
-- Enterprise-grade automation for data integrity and audit trails
--
-- Features:
-- - Automatic timestamp updates
-- - Complete audit trail logging
-- - Hierarchy cache invalidation
-- - Data integrity enforcement
-- - Performance optimization automation
--
-- ============================================================================

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- AUDIT TRAIL FUNCTIONS
-- ============================================================================

-- Comprehensive audit logging function
CREATE OR REPLACE FUNCTION log_relationship_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log all changes to change history table
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO relationship_change_history (
            relationship_id,
            change_type,
            changed_by,
            old_value,
            new_value,
            change_notes
        ) VALUES (
            NEW.id,
            'updated',
            NEW.last_modified_by,
            row_to_json(OLD),
            row_to_json(NEW),
            CASE
                WHEN OLD.status != NEW.status THEN
                    'Status changed from ' || OLD.status || ' to ' || NEW.status
                WHEN OLD.position != NEW.position THEN
                    'Position changed from ' || COALESCE(OLD.position, 'NULL') || ' to ' || COALESCE(NEW.position, 'NULL')
                WHEN OLD.department != NEW.department THEN
                    'Department changed from ' || COALESCE(OLD.department, 'NULL') || ' to ' || COALESCE(NEW.department, 'NULL')
                WHEN OLD.relationship_type != NEW.relationship_type THEN
                    'Relationship type changed from ' || OLD.relationship_type || ' to ' || NEW.relationship_type
                WHEN OLD.priority != NEW.priority THEN
                    'Priority changed from ' || OLD.priority || ' to ' || NEW.priority
                WHEN OLD.relationship_strength != NEW.relationship_strength THEN
                    'Relationship strength changed from ' || OLD.relationship_strength || ' to ' || NEW.relationship_strength
                WHEN OLD.seniority_level != NEW.seniority_level THEN
                    'Seniority level changed from ' || COALESCE(OLD.seniority_level, 'NULL') || ' to ' || COALESCE(NEW.seniority_level, 'NULL')
                WHEN OLD.employment_status != NEW.employment_status THEN
                    'Employment status changed from ' || COALESCE(OLD.employment_status, 'NULL') || ' to ' || COALESCE(NEW.employment_status, 'NULL')
                WHEN OLD.ownership_percentage != NEW.ownership_percentage THEN
                    'Ownership percentage changed from ' || COALESCE(OLD.ownership_percentage::text, 'NULL') || ' to ' || COALESCE(NEW.ownership_percentage::text, 'NULL')
                WHEN OLD.business_email != NEW.business_email THEN
                    'Business email changed from ' || COALESCE(OLD.business_email, 'NULL') || ' to ' || COALESCE(NEW.business_email, 'NULL')
                WHEN OLD.direct_manager_relationship_id != NEW.direct_manager_relationship_id THEN
                    'Manager changed from ' || COALESCE(OLD.direct_manager_relationship_id::text, 'NULL') || ' to ' || COALESCE(NEW.direct_manager_relationship_id::text, 'NULL')
                ELSE 'General update'
            END
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO relationship_change_history (
            relationship_id,
            change_type,
            changed_by,
            new_value,
            change_notes
        ) VALUES (
            NEW.id,
            'created',
            NEW.created_by,
            row_to_json(NEW),
            'Relationship created: ' || NEW.relationship_type || ' between ' ||
            NEW.source_contact_id::text || ' and ' || NEW.target_contact_id::text
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO relationship_change_history (
            relationship_id,
            change_type,
            changed_by,
            old_value,
            change_notes
        ) VALUES (
            OLD.id,
            'deleted',
            OLD.last_modified_by,
            row_to_json(OLD),
            'Relationship deleted: ' || OLD.relationship_type || ' between ' ||
            OLD.source_contact_id::text || ' and ' || OLD.target_contact_id::text
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- ============================================================================
-- HIERARCHY CACHE MANAGEMENT
-- ============================================================================

-- Hierarchy cache invalidation function
CREATE OR REPLACE FUNCTION invalidate_hierarchy_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark hierarchy cache as stale when employment relationships change
    IF TG_OP = 'INSERT' THEN
        -- New employment relationship - invalidate cache for the organization
        IF NEW.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant') THEN
            UPDATE organization_hierarchy_cache
            SET is_stale = TRUE, last_updated = NOW()
            WHERE organization_id = NEW.target_contact_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Updated employment relationship - check if hierarchy-affecting fields changed
        IF NEW.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant') THEN
            IF (OLD.position != NEW.position OR
                OLD.department != NEW.department OR
                OLD.seniority_level != NEW.seniority_level OR
                OLD.reporting_level != NEW.reporting_level OR
                OLD.direct_manager_relationship_id != NEW.direct_manager_relationship_id OR
                OLD.status != NEW.status) THEN

                UPDATE organization_hierarchy_cache
                SET is_stale = TRUE, last_updated = NOW()
                WHERE organization_id IN (OLD.target_contact_id, NEW.target_contact_id);
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Deleted employment relationship - invalidate cache for the organization
        IF OLD.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant') THEN
            UPDATE organization_hierarchy_cache
            SET is_stale = TRUE, last_updated = NOW()
            WHERE organization_id = OLD.target_contact_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- ============================================================================
-- DATA INTEGRITY FUNCTIONS
-- ============================================================================

-- Validate relationship data function
CREATE OR REPLACE FUNCTION validate_relationship_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate ownership percentage for shareholders
    IF NEW.relationship_type = 'shareholder' AND NEW.ownership_percentage IS NULL THEN
        RAISE EXCEPTION 'Ownership percentage is required for shareholder relationships';
    END IF;

    -- Validate business email format
    IF NEW.business_email IS NOT NULL AND NEW.business_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid business email format: %', NEW.business_email;
    END IF;

    -- Validate date logic
    IF NEW.end_date IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'End date cannot be before start date';
    END IF;

    -- Validate probation logic
    IF NEW.probation_end_date IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.probation_end_date < NEW.start_date THEN
        RAISE EXCEPTION 'Probation end date cannot be before start date';
    END IF;

    -- Validate employment status for employment relationships
    IF NEW.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant') AND
       NEW.employment_status IS NULL THEN
        NEW.employment_status := 'full_time'; -- Default value
    END IF;

    -- Validate seniority level consistency
    IF NEW.relationship_type = 'executive' AND NEW.seniority_level NOT IN ('executive', 'c_level') THEN
        NEW.seniority_level := 'executive';
    END IF;

    IF NEW.relationship_type = 'director' AND NEW.seniority_level NOT IN ('senior', 'executive') THEN
        NEW.seniority_level := 'senior';
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- DOCUMENT TRIGGERS
-- ============================================================================

-- Update document timestamp function
CREATE OR REPLACE FUNCTION update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGER DEFINITIONS
-- ============================================================================

-- Auto-update timestamp trigger for contact_relationships
CREATE TRIGGER tr_contact_relationships_updated_at
    BEFORE UPDATE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comprehensive audit trail trigger
CREATE TRIGGER tr_relationship_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_changes();

-- Hierarchy cache invalidation trigger
CREATE TRIGGER tr_hierarchy_cache_invalidation
    AFTER INSERT OR UPDATE OR DELETE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_hierarchy_cache();

-- Data validation trigger
CREATE TRIGGER tr_relationship_data_validation
    BEFORE INSERT OR UPDATE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION validate_relationship_data();

-- Document timestamp trigger
CREATE TRIGGER tr_relationship_documents_updated_at
    BEFORE UPDATE ON relationship_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_timestamp();

-- ============================================================================
-- ADVANCED TRIGGERS FOR BUSINESS LOGIC
-- ============================================================================

-- Auto-populate reporting level based on manager hierarchy
CREATE OR REPLACE FUNCTION auto_populate_reporting_level()
RETURNS TRIGGER AS $$
DECLARE
    manager_level INTEGER;
BEGIN
    -- If a manager relationship is set, automatically calculate reporting level
    IF NEW.direct_manager_relationship_id IS NOT NULL AND NEW.reporting_level IS NULL THEN
        SELECT reporting_level + 1 INTO manager_level
        FROM contact_relationships
        WHERE id = NEW.direct_manager_relationship_id;

        IF manager_level IS NOT NULL THEN
            NEW.reporting_level := manager_level;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_auto_populate_reporting_level
    BEFORE INSERT OR UPDATE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION auto_populate_reporting_level();

-- ============================================================================
-- TRIGGER COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row changes';
COMMENT ON FUNCTION log_relationship_changes() IS 'Comprehensive audit logging for all relationship changes';
COMMENT ON FUNCTION invalidate_hierarchy_cache() IS 'Invalidates hierarchy cache when organizational structure changes';
COMMENT ON FUNCTION validate_relationship_data() IS 'Validates business rules and data integrity for relationships';

-- End of Triggers & Functions Definition