-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - INDEXES DEFINITION
-- ============================================================================
--
-- 🚀 Performance-optimized indexes for Contact Relationship Management System
-- Enterprise-grade indexing strategy for optimal query performance
--
-- Features:
-- - Covering indexes for common query patterns
-- - Partial indexes for active relationships
-- - Composite indexes for complex queries
-- - Search optimization with text indexes
-- - Audit performance optimization
--
-- ============================================================================

-- ============================================================================
-- PRIMARY RELATIONSHIP LOOKUPS
-- ============================================================================

-- Basic relationship lookups (most common queries)
CREATE INDEX idx_contact_relationships_source
    ON contact_relationships(source_contact_id)
    WHERE status != 'terminated';

CREATE INDEX idx_contact_relationships_target
    ON contact_relationships(target_contact_id)
    WHERE status != 'terminated';

CREATE INDEX idx_contact_relationships_type
    ON contact_relationships(relationship_type)
    WHERE status != 'terminated';

CREATE INDEX idx_contact_relationships_status
    ON contact_relationships(status);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Source + Type combination (very common pattern)
CREATE INDEX idx_relationships_source_type
    ON contact_relationships(source_contact_id, relationship_type)
    WHERE status != 'terminated';

-- Target + Type combination (organization employee lookups)
CREATE INDEX idx_relationships_target_type
    ON contact_relationships(target_contact_id, relationship_type)
    WHERE status != 'terminated';

-- Organization employees query optimization
CREATE INDEX idx_relationships_org_employees
    ON contact_relationships(target_contact_id, relationship_type, status)
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant');

-- ============================================================================
-- EMPLOYMENT RELATIONSHIPS
-- ============================================================================

-- Employment relationships with organizational details
CREATE INDEX idx_relationships_employment
    ON contact_relationships(target_contact_id, department, position)
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive')
    AND status = 'active';

-- Hierarchy and reporting structure
CREATE INDEX idx_relationships_manager
    ON contact_relationships(direct_manager_relationship_id)
    WHERE direct_manager_relationship_id IS NOT NULL;

CREATE INDEX idx_relationships_hierarchy
    ON contact_relationships(target_contact_id, seniority_level, reporting_level)
    WHERE status = 'active';

-- ============================================================================
-- DATE-BASED QUERIES
-- ============================================================================

-- Active relationships by start date
CREATE INDEX idx_relationships_start_date
    ON contact_relationships(start_date)
    WHERE status = 'active';

-- Terminated relationships by end date
CREATE INDEX idx_relationships_end_date
    ON contact_relationships(end_date)
    WHERE end_date IS NOT NULL;

-- ============================================================================
-- SEARCH OPTIMIZATION
-- ============================================================================

-- Full-text search on relationship content
CREATE INDEX idx_relationships_search_text
    ON contact_relationships
    USING gin(to_tsvector('english',
        COALESCE(position, '') || ' ' ||
        COALESCE(relationship_notes, '') || ' ' ||
        COALESCE(department, '')
    ));

-- ============================================================================
-- PRIORITY AND COMMUNICATION
-- ============================================================================

-- Priority-based queries with last interaction
CREATE INDEX idx_relationships_priority
    ON contact_relationships(priority, last_interaction_date)
    WHERE status = 'active';

-- Communication frequency analysis
CREATE INDEX idx_relationships_communication
    ON contact_relationships(communication_frequency, last_interaction_date)
    WHERE status = 'active';

-- ============================================================================
-- FINANCIAL INFORMATION
-- ============================================================================

-- Shareholders and ownership queries
CREATE INDEX idx_relationships_ownership
    ON contact_relationships(target_contact_id, ownership_percentage)
    WHERE ownership_percentage IS NOT NULL
    AND status = 'active';

-- ============================================================================
-- AUDIT AND COMPLIANCE INDEXES
-- ============================================================================

-- Audit trail performance
CREATE INDEX idx_relationships_created_at
    ON contact_relationships(created_at);

CREATE INDEX idx_relationships_updated_at
    ON contact_relationships(updated_at);

CREATE INDEX idx_relationships_created_by
    ON contact_relationships(created_by);

-- Verification status queries
CREATE INDEX idx_relationships_verification
    ON contact_relationships(verification_status, verified_at)
    WHERE verification_status != 'unverified';

-- ============================================================================
-- CHANGE HISTORY INDEXES
-- ============================================================================

-- Change history by relationship (most common audit query)
CREATE INDEX idx_change_history_relationship
    ON relationship_change_history(relationship_id, change_date DESC);

-- Change history by date (chronological queries)
CREATE INDEX idx_change_history_date
    ON relationship_change_history(change_date DESC);

-- Change history by user (user activity tracking)
CREATE INDEX idx_change_history_user
    ON relationship_change_history(changed_by, change_date DESC);

-- Change type analysis
CREATE INDEX idx_change_history_type
    ON relationship_change_history(change_type, change_date DESC);

-- ============================================================================
-- DOCUMENT INDEXES
-- ============================================================================

-- Documents by relationship (most common document query)
CREATE INDEX idx_relationship_docs_relationship
    ON relationship_documents(relationship_id, upload_date DESC);

-- Documents by type
CREATE INDEX idx_relationship_docs_type
    ON relationship_documents(document_type, upload_date DESC);

-- Confidential documents
CREATE INDEX idx_relationship_docs_confidential
    ON relationship_documents(is_confidential, upload_date DESC)
    WHERE is_confidential = TRUE;

-- Document expiry tracking
CREATE INDEX idx_relationship_docs_expiry
    ON relationship_documents(expiry_date)
    WHERE expiry_date IS NOT NULL;

-- ============================================================================
-- HIERARCHY CACHE INDEXES
-- ============================================================================

-- Organization hierarchy queries
CREATE INDEX idx_hierarchy_cache_org
    ON organization_hierarchy_cache(organization_id, hierarchy_level);

-- Employee lookup in cache
CREATE INDEX idx_hierarchy_cache_employee
    ON organization_hierarchy_cache(employee_id);

-- Manager/parent relationships
CREATE INDEX idx_hierarchy_cache_parent
    ON organization_hierarchy_cache(parent_id)
    WHERE parent_id IS NOT NULL;

-- Department-based queries
CREATE INDEX idx_hierarchy_cache_department
    ON organization_hierarchy_cache(organization_id, department_name);

-- Cache maintenance
CREATE INDEX idx_hierarchy_cache_stale
    ON organization_hierarchy_cache(is_stale, last_updated)
    WHERE is_stale = TRUE;

-- ============================================================================
-- ADVANCED PERFORMANCE INDEXES
-- ============================================================================

-- Multi-column covering index for employment dashboard
CREATE INDEX idx_relationships_employment_dashboard
    ON contact_relationships(target_contact_id, relationship_type, status, position, department, start_date)
    WHERE relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant');

-- Complex relationship analysis
CREATE INDEX idx_relationships_analysis
    ON contact_relationships(relationship_type, priority, relationship_strength, communication_frequency)
    WHERE status = 'active';

-- Performance review tracking
CREATE INDEX idx_relationships_reviews
    ON contact_relationships(last_review_date, next_review_date, performance_rating)
    WHERE last_review_date IS NOT NULL
    AND status = 'active';

-- Contract management
CREATE INDEX idx_relationships_contracts
    ON contact_relationships(contract_value, renewal_date, employment_type)
    WHERE contract_value IS NOT NULL
    OR renewal_date IS NOT NULL;

-- ============================================================================
-- INDEX COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_contact_relationships_source IS 'Primary lookup for relationships by source contact';
COMMENT ON INDEX idx_relationships_org_employees IS 'Optimized for organization employee queries';
COMMENT ON INDEX idx_relationships_search_text IS 'Full-text search on relationship content';
COMMENT ON INDEX idx_hierarchy_cache_org IS 'Organization hierarchy performance cache';

-- End of Indexes Definition