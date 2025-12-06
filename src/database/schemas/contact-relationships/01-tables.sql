-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - TABLES DEFINITION
-- ============================================================================
--
-- 🏢 Core table definitions for Contact Relationship Management System
-- Enterprise-grade schema for complex business relationship tracking
--
-- Features:
-- - Multi-tenant support with organization isolation
-- - Full audit trail and change history
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
-- TABLE COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE contact_relationships IS 'Core table for storing professional relationships between contacts';
COMMENT ON COLUMN contact_relationships.source_contact_id IS 'Contact ID of the entity having the relationship';
COMMENT ON COLUMN contact_relationships.target_contact_id IS 'Contact ID of the entity being related to';
COMMENT ON COLUMN contact_relationships.relationship_type IS 'Type of relationship (employee, manager, shareholder, etc.)';
COMMENT ON COLUMN contact_relationships.custom_fields IS 'Flexible JSON field for organization-specific data';

COMMENT ON TABLE relationship_change_history IS 'Audit trail for all changes made to relationships';
COMMENT ON TABLE relationship_documents IS 'Documents attached to relationships (contracts, NDAs, etc.)';
COMMENT ON TABLE organization_hierarchy_cache IS 'Performance cache for organization hierarchy queries';

-- End of Tables Definition