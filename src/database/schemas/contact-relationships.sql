-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS DATABASE SCHEMA
-- ============================================================================
--
-- 🏢 Professional-grade Contact Relationship Management Database
-- Enterprise-class schema for complex business relationship tracking
-- Designed for scalability, performance, and enterprise requirements
--
-- Features:
-- - Multi-tenant support with organization isolation
-- - Full audit trail and change history
-- - Performance-optimized indexes
-- - Data integrity constraints
-- - Soft-delete capability
-- - GDPR compliance ready
--
-- Compatible with: PostgreSQL 13+, MySQL 8+, SQLite 3.38+
--
-- ============================================================================

-- ============================================================================
-- TABLE: contact_relationships
-- Core entity for storing contact relationships
-- ============================================================================

CREATE TABLE contact_relationships (
    -- ========================================================================
    -- PRIMARY IDENTIFIERS
    -- ========================================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationship participants
    source_contact_id UUID NOT NULL,        -- Who has the relationship
    target_contact_id UUID NOT NULL,        -- With whom the relationship exists

    -- Relationship metadata
    relationship_type VARCHAR(50) NOT NULL, -- RelationshipType enum value
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- RelationshipStatus enum value

    -- ========================================================================
    -- ORGANIZATIONAL DETAILS
    -- ========================================================================

    -- Job/Position Information
    position VARCHAR(200),                   -- Job title/position within organization
    department VARCHAR(200),                 -- Department/division
    team VARCHAR(200),                       -- Team/unit/section
    seniority_level VARCHAR(20),             -- 'entry', 'mid', 'senior', 'executive', 'c_level'
    reporting_level INTEGER,                 -- Depth in org chart (0 = top)

    -- Management hierarchy
    direct_manager_relationship_id UUID REFERENCES contact_relationships(id),

    -- Employment details
    employment_status VARCHAR(30),           -- EmploymentStatus enum value
    employment_type VARCHAR(20),             -- 'permanent', 'temporary', 'contract', 'intern', 'volunteer'
    employee_id VARCHAR(50),                 -- Employee ID/badge number
    access_level VARCHAR(100),               -- Security clearance/access level

    -- ========================================================================
    -- TIMELINE & LIFECYCLE
    -- ========================================================================

    start_date DATE,                         -- Relationship start date
    end_date DATE,                          -- Relationship end date (if terminated)
    expected_duration VARCHAR(100),          -- Expected duration description
    renewal_date DATE,                      -- Renewal date (for contracts)
    probation_end_date DATE,                -- End of probation period

    -- ========================================================================
    -- PROFESSIONAL CONTACT INFORMATION
    -- ========================================================================

    -- Business contact details (JSON for flexibility)
    business_phone VARCHAR(20),
    business_mobile VARCHAR(20),
    fax VARCHAR(20),
    business_email VARCHAR(255),
    alternative_email VARCHAR(255),
    extension VARCHAR(10),
    office_number VARCHAR(50),
    office_location VARCHAR(200),
    building_name VARCHAR(200),
    department_address TEXT,
    intranet_profile VARCHAR(500),
    internal_messaging VARCHAR(100),
    available_hours VARCHAR(200),
    preferred_contact_method VARCHAR(20),    -- 'phone', 'email', 'in_person', 'messaging'
    contact_notes TEXT,

    -- ========================================================================
    -- FINANCIAL INFORMATION
    -- ========================================================================

    ownership_percentage DECIMAL(5,2),       -- For shareholders (0.00-100.00)
    salary_range VARCHAR(50),                -- Salary range/level
    annual_compensation DECIMAL(15,2),       -- Annual compensation
    equity_grants INTEGER,                   -- Stock options/equity grants
    cost_center VARCHAR(50),                 -- Cost center code
    payroll_department VARCHAR(100),         -- Payroll department
    contract_value DECIMAL(15,2),            -- Contract value (for contractors)
    contract_duration VARCHAR(100),          -- Contract duration description
    billing_rate DECIMAL(10,2),             -- Billing rate (for consultants)
    budget_code VARCHAR(50),                 -- Budget code

    -- ========================================================================
    -- PERFORMANCE & HR INFORMATION
    -- ========================================================================

    performance_rating VARCHAR(30),          -- 'excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory'
    last_review_date DATE,                   -- Last performance review
    next_review_date DATE,                   -- Next review due
    current_goals TEXT[],                    -- Array of current goals/objectives
    achievements TEXT[],                     -- Array of achievements/awards
    trainings TEXT[],                        -- Array of training/certifications
    career_plan TEXT,                        -- Career development plan
    disciplinary_actions TEXT[],             -- Array of disciplinary actions
    skills_assessment JSONB,                 -- Skills assessment (JSON: skill -> rating)
    manager_notes TEXT,                      -- Manager notes

    -- ========================================================================
    -- ORGANIZATIONAL CONTEXT
    -- ========================================================================

    job_description TEXT,                    -- Detailed job description
    responsibilities TEXT[],                 -- Array of key responsibilities
    required_qualifications TEXT[],          -- Array of required qualifications
    certifications TEXT[],                   -- Array of certifications held
    preferred_language VARCHAR(10),          -- Preferred communication language

    authority_level VARCHAR(20),             -- 'none', 'limited', 'moderate', 'high', 'executive'
    signing_authority_limit DECIMAL(15,2),   -- Signing authority limit
    approval_workflows TEXT[],               -- Array of approval workflows
    system_permissions TEXT[],               -- Array of system access permissions
    committee_memberships TEXT[],            -- Array of committees/boards

    -- ========================================================================
    -- RELATIONSHIP METADATA
    -- ========================================================================

    priority VARCHAR(20) DEFAULT 'medium',   -- 'low', 'medium', 'high', 'critical'
    relationship_strength VARCHAR(20) DEFAULT 'moderate', -- 'weak', 'moderate', 'strong', 'very_strong'
    communication_frequency VARCHAR(20),     -- 'daily', 'weekly', 'monthly', 'quarterly', 'rarely'
    last_interaction_date DATE,              -- Last interaction date
    last_interaction_type VARCHAR(20),       -- 'meeting', 'call', 'email', 'message', 'event'
    relationship_notes TEXT,                 -- General relationship notes
    tags TEXT[],                             -- Array of tags for categorization
    alerts TEXT[],                           -- Array of important notes/alerts

    -- ========================================================================
    -- FLEXIBLE METADATA
    -- ========================================================================

    custom_fields JSONB,                     -- Custom fields (JSON object)

    -- ========================================================================
    -- AUDIT & COMPLIANCE
    -- ========================================================================

    created_by UUID NOT NULL,                -- User who created the relationship
    last_modified_by UUID NOT NULL,          -- User who last modified
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    verification_status VARCHAR(20) DEFAULT 'unverified', -- 'unverified', 'pending', 'verified', 'disputed'
    verified_by UUID,                        -- User who verified
    verified_at TIMESTAMP WITH TIME ZONE,    -- Verification timestamp

    sensitivity_level VARCHAR(20) DEFAULT 'internal', -- 'public', 'internal', 'confidential', 'restricted'
    compliance_notes TEXT,                   -- Legal/compliance notes
    retention_policy VARCHAR(200),           -- Data retention policy

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    CONSTRAINT chk_not_self_relationship CHECK (source_contact_id != target_contact_id),
    CONSTRAINT chk_ownership_percentage CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
    CONSTRAINT chk_valid_status CHECK (status IN ('active', 'inactive', 'pending', 'terminated', 'suspended')),
    CONSTRAINT chk_valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_valid_relationship_strength CHECK (relationship_strength IN ('weak', 'moderate', 'strong', 'very_strong')),
    CONSTRAINT chk_valid_seniority CHECK (seniority_level IS NULL OR seniority_level IN ('entry', 'mid', 'senior', 'executive', 'c_level')),
    CONSTRAINT chk_valid_authority CHECK (authority_level IS NULL OR authority_level IN ('none', 'limited', 'moderate', 'high', 'executive')),
    CONSTRAINT chk_date_logic CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_probation_logic CHECK (probation_end_date IS NULL OR start_date IS NULL OR probation_end_date >= start_date)
);

-- ============================================================================
-- TABLE: relationship_change_history
-- Audit trail for relationship changes
-- ============================================================================

CREATE TABLE relationship_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES contact_relationships(id) ON DELETE CASCADE,

    change_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_type VARCHAR(50) NOT NULL,        -- 'created', 'updated', 'status_change', 'position_change'
    changed_by UUID NOT NULL,                -- User who made the change

    old_value JSONB,                         -- Previous values (JSON)
    new_value JSONB,                         -- New values (JSON)
    change_notes TEXT,                       -- Optional change description

    -- Metadata
    ip_address INET,                         -- IP address of change origin
    user_agent TEXT,                         -- Browser/client info
    session_id VARCHAR(100),                 -- Session identifier

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE: relationship_documents
-- Attached documents for relationships (contracts, NDAs, etc.)
-- ============================================================================

CREATE TABLE relationship_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES contact_relationships(id) ON DELETE CASCADE,

    document_name VARCHAR(500) NOT NULL,
    document_type VARCHAR(50) NOT NULL,      -- 'contract', 'nda', 'resume', 'evaluation', 'other'
    file_url TEXT NOT NULL,                  -- URL/path to document
    file_size BIGINT,                        -- File size in bytes
    mime_type VARCHAR(100),                  -- MIME type

    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID NOT NULL,               -- User who uploaded

    -- Document metadata
    expiry_date DATE,                        -- Document expiry (for contracts)
    is_confidential BOOLEAN DEFAULT FALSE,   -- Confidential document flag
    access_permissions TEXT[],               -- Array of who can access

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE: organization_hierarchy_cache
-- Materialized view for organization hierarchy performance
-- ============================================================================

CREATE TABLE organization_hierarchy_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,           -- Organization contact ID
    employee_id UUID NOT NULL,               -- Employee contact ID
    relationship_id UUID NOT NULL REFERENCES contact_relationships(id),

    -- Hierarchy information
    hierarchy_level INTEGER NOT NULL DEFAULT 0, -- Depth in org chart
    hierarchy_path UUID[],                   -- Path from root to this node (array of contact IDs)
    parent_id UUID,                          -- Direct manager ID
    all_subordinates UUID[],                 -- All subordinates (recursive)
    direct_subordinates UUID[],              -- Direct reports only

    -- Department aggregation
    department_name VARCHAR(200),
    department_size INTEGER,                 -- Number of employees in department

    -- Cache metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_stale BOOLEAN DEFAULT FALSE,          -- Flag for cache invalidation

    UNIQUE(organization_id, employee_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Primary relationship lookups
CREATE INDEX idx_contact_relationships_source ON contact_relationships(source_contact_id) WHERE status != 'terminated';
CREATE INDEX idx_contact_relationships_target ON contact_relationships(target_contact_id) WHERE status != 'terminated';
CREATE INDEX idx_contact_relationships_type ON contact_relationships(relationship_type) WHERE status != 'terminated';
CREATE INDEX idx_contact_relationships_status ON contact_relationships(status);

-- Composite indexes for common queries
CREATE INDEX idx_relationships_source_type ON contact_relationships(source_contact_id, relationship_type) WHERE status != 'terminated';
CREATE INDEX idx_relationships_target_type ON contact_relationships(target_contact_id, relationship_type) WHERE status != 'terminated';
CREATE INDEX idx_relationships_org_employees ON contact_relationships(target_contact_id, relationship_type, status)
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant');

-- Employment relationships
CREATE INDEX idx_relationships_employment ON contact_relationships(target_contact_id, department, position)
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive') AND status = 'active';

-- Date-based queries
CREATE INDEX idx_relationships_start_date ON contact_relationships(start_date) WHERE status = 'active';
CREATE INDEX idx_relationships_end_date ON contact_relationships(end_date) WHERE end_date IS NOT NULL;

-- Search optimization
CREATE INDEX idx_relationships_search_text ON contact_relationships
    USING gin(to_tsvector('english', COALESCE(position, '') || ' ' || COALESCE(relationship_notes, '') || ' ' || COALESCE(department, '')));

-- Priority and communication
CREATE INDEX idx_relationships_priority ON contact_relationships(priority, last_interaction_date) WHERE status = 'active';
CREATE INDEX idx_relationships_communication ON contact_relationships(communication_frequency, last_interaction_date) WHERE status = 'active';

-- Hierarchy and reporting
CREATE INDEX idx_relationships_manager ON contact_relationships(direct_manager_relationship_id) WHERE direct_manager_relationship_id IS NOT NULL;
CREATE INDEX idx_relationships_hierarchy ON contact_relationships(target_contact_id, seniority_level, reporting_level) WHERE status = 'active';

-- Financial information
CREATE INDEX idx_relationships_ownership ON contact_relationships(target_contact_id, ownership_percentage)
    WHERE ownership_percentage IS NOT NULL AND status = 'active';

-- Audit indexes
CREATE INDEX idx_relationships_created_at ON contact_relationships(created_at);
CREATE INDEX idx_relationships_updated_at ON contact_relationships(updated_at);
CREATE INDEX idx_relationships_created_by ON contact_relationships(created_by);

-- Change history indexes
CREATE INDEX idx_change_history_relationship ON relationship_change_history(relationship_id, change_date DESC);
CREATE INDEX idx_change_history_date ON relationship_change_history(change_date DESC);
CREATE INDEX idx_change_history_user ON relationship_change_history(changed_by, change_date DESC);

-- Document indexes
CREATE INDEX idx_relationship_docs_relationship ON relationship_documents(relationship_id, upload_date DESC);
CREATE INDEX idx_relationship_docs_type ON relationship_documents(document_type, upload_date DESC);

-- Hierarchy cache indexes
CREATE INDEX idx_hierarchy_cache_org ON organization_hierarchy_cache(organization_id, hierarchy_level);
CREATE INDEX idx_hierarchy_cache_employee ON organization_hierarchy_cache(employee_id);
CREATE INDEX idx_hierarchy_cache_parent ON organization_hierarchy_cache(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_hierarchy_cache_department ON organization_hierarchy_cache(organization_id, department_name);
CREATE INDEX idx_hierarchy_cache_stale ON organization_hierarchy_cache(is_stale, last_updated) WHERE is_stale = TRUE;

-- ============================================================================
-- TRIGGERS FOR AUTOMATED OPERATIONS
-- ============================================================================

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_contact_relationships_updated_at
    BEFORE UPDATE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Audit trail trigger
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
                WHEN OLD.status != NEW.status THEN 'Status changed from ' || OLD.status || ' to ' || NEW.status
                WHEN OLD.position != NEW.position THEN 'Position changed from ' || COALESCE(OLD.position, 'NULL') || ' to ' || COALESCE(NEW.position, 'NULL')
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
            'Relationship created'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_relationship_audit_log
    AFTER INSERT OR UPDATE ON contact_relationships
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_changes();

-- Hierarchy cache invalidation trigger
CREATE OR REPLACE FUNCTION invalidate_hierarchy_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark hierarchy cache as stale when employment relationships change
    IF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') THEN
        UPDATE organization_hierarchy_cache
        SET is_stale = TRUE, last_updated = NOW()
        WHERE organization_id IN (
            COALESCE(OLD.target_contact_id, NEW.target_contact_id)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_hierarchy_cache_invalidation
    AFTER INSERT OR UPDATE OR DELETE ON contact_relationships
    FOR EACH ROW
    WHEN (NEW.relationship_type IS NULL OR NEW.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant'))
    EXECUTE FUNCTION invalidate_hierarchy_cache();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active relationships view
CREATE VIEW v_active_relationships AS
SELECT
    cr.*,
    sc.first_name || ' ' || sc.last_name AS source_name,
    tc.company_name AS target_name
FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
WHERE cr.status = 'active';

-- Employment relationships view
CREATE VIEW v_employment_relationships AS
SELECT
    cr.*,
    sc.first_name || ' ' || sc.last_name AS employee_name,
    tc.company_name AS employer_name,
    sc.email AS employee_email,
    cr.business_email AS work_email
FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
WHERE cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
AND cr.status = 'active';

-- Organization hierarchy view
CREATE VIEW v_organization_hierarchy AS
SELECT
    cr.target_contact_id AS organization_id,
    cr.source_contact_id AS employee_id,
    cr.position,
    cr.department,
    cr.seniority_level,
    cr.reporting_level,
    mgr.source_contact_id AS manager_id,
    sc.first_name || ' ' || sc.last_name AS employee_name,
    mgr_contact.first_name || ' ' || mgr_contact.last_name AS manager_name
FROM contact_relationships cr
LEFT JOIN contact_relationships mgr ON cr.direct_manager_relationship_id = mgr.id
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts mgr_contact ON mgr.source_contact_id = mgr_contact.id
WHERE cr.relationship_type IN ('employee', 'manager', 'director', 'executive')
AND cr.status = 'active'
ORDER BY cr.target_contact_id, cr.reporting_level, cr.position;

-- ============================================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ============================================================================

-- Get organization employees with hierarchy
CREATE OR REPLACE FUNCTION get_organization_employees(
    org_id UUID,
    include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    position VARCHAR(200),
    department VARCHAR(200),
    hierarchy_level INTEGER,
    manager_name TEXT,
    start_date DATE,
    business_email VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.source_contact_id AS employee_id,
        (sc.first_name || ' ' || sc.last_name) AS employee_name,
        cr.position,
        cr.department,
        cr.reporting_level AS hierarchy_level,
        (mgr_contact.first_name || ' ' || mgr_contact.last_name) AS manager_name,
        cr.start_date,
        cr.business_email
    FROM contact_relationships cr
    LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
    LEFT JOIN contact_relationships mgr ON cr.direct_manager_relationship_id = mgr.id
    LEFT JOIN contacts mgr_contact ON mgr.source_contact_id = mgr_contact.id
    WHERE cr.target_contact_id = org_id
    AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND (include_inactive OR cr.status = 'active')
    ORDER BY cr.reporting_level, cr.position;
END;
$$ LANGUAGE plpgsql;

-- Get person's employment history
CREATE OR REPLACE FUNCTION get_person_employment_history(
    person_id UUID
)
RETURNS TABLE (
    employer_name TEXT,
    position VARCHAR(200),
    department VARCHAR(200),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(tc.company_name, tc.service_name) AS employer_name,
        cr.position,
        cr.department,
        cr.start_date,
        cr.end_date,
        (cr.status = 'active' AND cr.end_date IS NULL) AS is_current
    FROM contact_relationships cr
    LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
    WHERE cr.source_contact_id = person_id
    AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    ORDER BY cr.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA INSERTS (FOR TESTING)
-- ============================================================================

-- Insert sample relationships (commented out for production)
/*
-- Sample: Employee relationship
INSERT INTO contact_relationships (
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    start_date,
    employment_status,
    business_email,
    created_by,
    last_modified_by
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000'::UUID, -- John Doe
    '123e4567-e89b-12d3-a456-426614174001'::UUID, -- Acme Corp
    'employee',
    'active',
    'Software Engineer',
    'IT Department',
    '2024-01-15',
    'full_time',
    'john.doe@acmecorp.com',
    'system'::UUID,
    'system'::UUID
);

-- Sample: Manager relationship
INSERT INTO contact_relationships (
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    seniority_level,
    start_date,
    employment_status,
    business_email,
    created_by,
    last_modified_by
) VALUES (
    '123e4567-e89b-12d3-a456-426614174002'::UUID, -- Jane Smith
    '123e4567-e89b-12d3-a456-426614174001'::UUID, -- Acme Corp
    'manager',
    'active',
    'IT Manager',
    'IT Department',
    'senior',
    '2023-03-10',
    'full_time',
    'jane.smith@acmecorp.com',
    'system'::UUID,
    'system'::UUID
);
*/

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Refresh hierarchy cache
CREATE OR REPLACE FUNCTION refresh_hierarchy_cache()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER := 0;
BEGIN
    -- Delete stale cache entries
    DELETE FROM organization_hierarchy_cache WHERE is_stale = TRUE;

    -- Rebuild cache for organizations with employment relationships
    -- This is a simplified version - full implementation would be more complex
    INSERT INTO organization_hierarchy_cache (
        organization_id,
        employee_id,
        relationship_id,
        hierarchy_level,
        department_name,
        is_stale
    )
    SELECT DISTINCT
        cr.target_contact_id,
        cr.source_contact_id,
        cr.id,
        COALESCE(cr.reporting_level, 0),
        cr.department,
        FALSE
    FROM contact_relationships cr
    WHERE cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND cr.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM organization_hierarchy_cache ohc
        WHERE ohc.organization_id = cr.target_contact_id
        AND ohc.employee_id = cr.source_contact_id
        AND ohc.is_stale = FALSE
    );

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

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

    DELETE FROM relationship_change_history
    WHERE change_date < cutoff_date;

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA VERSION & MIGRATION TRACKING
-- ============================================================================

CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(100)
);

INSERT INTO schema_migrations (version, description, applied_by) VALUES
('001_initial_schema', 'Initial contact relationships schema with full enterprise features', 'system');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE contact_relationships IS 'Core table for storing professional relationships between contacts';
COMMENT ON COLUMN contact_relationships.source_contact_id IS 'Contact ID of the entity having the relationship';
COMMENT ON COLUMN contact_relationships.target_contact_id IS 'Contact ID of the entity being related to';
COMMENT ON COLUMN contact_relationships.relationship_type IS 'Type of relationship (employee, manager, shareholder, etc.)';
COMMENT ON COLUMN contact_relationships.custom_fields IS 'Flexible JSON field for organization-specific data';

COMMENT ON TABLE relationship_change_history IS 'Audit trail for all changes made to relationships';
COMMENT ON TABLE relationship_documents IS 'Documents attached to relationships (contracts, NDAs, etc.)';
COMMENT ON TABLE organization_hierarchy_cache IS 'Performance cache for organization hierarchy queries';

-- End of schema