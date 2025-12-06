-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - VIEWS DEFINITION
-- ============================================================================
--
-- 📊 Optimized views for Contact Relationship Management System
-- Enterprise-grade materialized views for complex business queries
--
-- Features:
-- - Pre-joined relationship data
-- - Organizational hierarchy views
-- - Performance-optimized queries
-- - Business intelligence ready
-- - Reporting-friendly structures
--
-- ============================================================================

-- ============================================================================
-- ACTIVE RELATIONSHIPS VIEW
-- ============================================================================

-- Comprehensive view of all active relationships with contact details
CREATE VIEW v_active_relationships AS
SELECT
    cr.id,
    cr.source_contact_id,
    cr.target_contact_id,
    cr.relationship_type,
    cr.status,
    cr.position,
    cr.department,
    cr.team,
    cr.seniority_level,
    cr.reporting_level,
    cr.employment_status,
    cr.employment_type,
    cr.start_date,
    cr.end_date,
    cr.business_email,
    cr.business_phone,
    cr.office_location,
    cr.priority,
    cr.relationship_strength,
    cr.communication_frequency,
    cr.last_interaction_date,
    cr.ownership_percentage,
    cr.annual_compensation,
    cr.performance_rating,
    cr.created_at,
    cr.updated_at,

    -- Source contact details (joined)
    sc.first_name || ' ' || sc.last_name AS source_name,
    sc.email AS source_email,
    sc.phone AS source_phone,
    sc.contact_type AS source_type,

    -- Target contact details (joined)
    CASE
        WHEN tc.contact_type = 'company' THEN tc.company_name
        WHEN tc.contact_type = 'service' THEN tc.service_name
        ELSE tc.first_name || ' ' || tc.last_name
    END AS target_name,
    tc.email AS target_email,
    tc.phone AS target_phone,
    tc.contact_type AS target_type,
    tc.company_name AS target_company_name,
    tc.service_name AS target_service_name

FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
WHERE cr.status = 'active';

-- ============================================================================
-- EMPLOYMENT RELATIONSHIPS VIEW
-- ============================================================================

-- Detailed view of employment relationships with full contact information
CREATE VIEW v_employment_relationships AS
SELECT
    cr.id,
    cr.source_contact_id AS employee_id,
    cr.target_contact_id AS employer_id,
    cr.relationship_type,
    cr.position,
    cr.department,
    cr.team,
    cr.seniority_level,
    cr.reporting_level,
    cr.employment_status,
    cr.employment_type,
    cr.start_date,
    cr.end_date,
    cr.business_email,
    cr.business_phone,
    cr.business_mobile,
    cr.extension,
    cr.office_number,
    cr.office_location,
    cr.annual_compensation,
    cr.performance_rating,
    cr.last_review_date,
    cr.next_review_date,
    cr.direct_manager_relationship_id,

    -- Employee details
    sc.first_name || ' ' || sc.last_name AS employee_name,
    sc.email AS employee_personal_email,
    sc.phone AS employee_personal_phone,
    sc.date_of_birth AS employee_birth_date,

    -- Employer details
    CASE
        WHEN tc.contact_type = 'company' THEN tc.company_name
        WHEN tc.contact_type = 'service' THEN tc.service_name
        ELSE tc.first_name || ' ' || tc.last_name
    END AS employer_name,
    tc.email AS employer_email,
    tc.phone AS employer_phone,
    tc.address AS employer_address,
    tc.contact_type AS employer_type,

    -- Manager information (if available)
    mgr_rel.source_contact_id AS manager_id,
    mgr_contact.first_name || ' ' || mgr_contact.last_name AS manager_name,
    mgr_rel.business_email AS manager_email

FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
LEFT JOIN contact_relationships mgr_rel ON cr.direct_manager_relationship_id = mgr_rel.id
LEFT JOIN contacts mgr_contact ON mgr_rel.source_contact_id = mgr_contact.id
WHERE cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
AND cr.status = 'active';

-- ============================================================================
-- ORGANIZATION HIERARCHY VIEW
-- ============================================================================

-- Complete organizational hierarchy with management chains
CREATE VIEW v_organization_hierarchy AS
SELECT
    cr.id AS relationship_id,
    cr.target_contact_id AS organization_id,
    cr.source_contact_id AS employee_id,
    cr.position,
    cr.department,
    cr.team,
    cr.seniority_level,
    cr.reporting_level,
    cr.employment_status,
    cr.start_date,
    cr.business_email,
    cr.business_phone,
    cr.office_location,

    -- Employee information
    sc.first_name || ' ' || sc.last_name AS employee_name,
    sc.email AS employee_personal_email,

    -- Organization information
    CASE
        WHEN tc.contact_type = 'company' THEN tc.company_name
        WHEN tc.contact_type = 'service' THEN tc.service_name
        ELSE tc.first_name || ' ' || tc.last_name
    END AS organization_name,

    -- Direct manager information
    cr.direct_manager_relationship_id,
    mgr_rel.source_contact_id AS direct_manager_id,
    mgr_contact.first_name || ' ' || mgr_contact.last_name AS direct_manager_name,
    mgr_rel.position AS manager_position,

    -- Hierarchy metrics
    (SELECT COUNT(*) FROM contact_relationships subordinates
     WHERE subordinates.direct_manager_relationship_id = cr.id
     AND subordinates.status = 'active') AS direct_reports_count,

    -- Department statistics
    (SELECT COUNT(*) FROM contact_relationships dept_colleagues
     WHERE dept_colleagues.target_contact_id = cr.target_contact_id
     AND dept_colleagues.department = cr.department
     AND dept_colleagues.status = 'active') AS department_size

FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
LEFT JOIN contact_relationships mgr_rel ON cr.direct_manager_relationship_id = mgr_rel.id
LEFT JOIN contacts mgr_contact ON mgr_rel.source_contact_id = mgr_contact.id
WHERE cr.relationship_type IN ('employee', 'manager', 'director', 'executive')
AND cr.status = 'active'
ORDER BY cr.target_contact_id, cr.reporting_level, cr.department, cr.position;

-- ============================================================================
-- SHAREHOLDER RELATIONSHIPS VIEW
-- ============================================================================

-- Detailed view of ownership and shareholder relationships
CREATE VIEW v_shareholder_relationships AS
SELECT
    cr.id,
    cr.source_contact_id AS shareholder_id,
    cr.target_contact_id AS company_id,
    cr.ownership_percentage,
    cr.start_date AS investment_date,
    cr.status AS investment_status,
    cr.priority,
    cr.relationship_notes,

    -- Shareholder details
    CASE
        WHEN sc.contact_type = 'individual' THEN sc.first_name || ' ' || sc.last_name
        WHEN sc.contact_type = 'company' THEN sc.company_name
        ELSE sc.service_name
    END AS shareholder_name,
    sc.contact_type AS shareholder_type,
    sc.email AS shareholder_email,
    sc.phone AS shareholder_phone,

    -- Company details
    tc.company_name,
    tc.email AS company_email,
    tc.phone AS company_phone,
    tc.address AS company_address,

    -- Financial information
    cr.annual_compensation AS dividends_annual,
    cr.contract_value AS investment_value,
    cr.equity_grants,

    -- Communication
    cr.business_email AS investor_relations_email,
    cr.last_interaction_date,
    cr.communication_frequency

FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
WHERE cr.relationship_type = 'shareholder'
AND cr.status = 'active'
ORDER BY cr.target_contact_id, cr.ownership_percentage DESC;

-- ============================================================================
-- RELATIONSHIP SUMMARY VIEW
-- ============================================================================

-- High-level summary of relationships for dashboard and reporting
CREATE VIEW v_relationship_summary AS
SELECT
    tc.id AS entity_id,
    CASE
        WHEN tc.contact_type = 'company' THEN tc.company_name
        WHEN tc.contact_type = 'service' THEN tc.service_name
        ELSE tc.first_name || ' ' || tc.last_name
    END AS entity_name,
    tc.contact_type AS entity_type,

    -- Employee counts
    (SELECT COUNT(*) FROM contact_relationships employees
     WHERE employees.target_contact_id = tc.id
     AND employees.relationship_type = 'employee'
     AND employees.status = 'active') AS employees_count,

    (SELECT COUNT(*) FROM contact_relationships managers
     WHERE managers.target_contact_id = tc.id
     AND managers.relationship_type IN ('manager', 'director', 'executive')
     AND managers.status = 'active') AS management_count,

    -- Shareholder information
    (SELECT COUNT(*) FROM contact_relationships shareholders
     WHERE shareholders.target_contact_id = tc.id
     AND shareholders.relationship_type = 'shareholder'
     AND shareholders.status = 'active') AS shareholders_count,

    (SELECT SUM(ownership_percentage) FROM contact_relationships ownership
     WHERE ownership.target_contact_id = tc.id
     AND ownership.relationship_type = 'shareholder'
     AND ownership.status = 'active') AS total_ownership_tracked,

    -- Department diversity
    (SELECT COUNT(DISTINCT department) FROM contact_relationships departments
     WHERE departments.target_contact_id = tc.id
     AND departments.status = 'active'
     AND departments.department IS NOT NULL) AS departments_count,

    -- Latest activity
    (SELECT MAX(last_interaction_date) FROM contact_relationships activity
     WHERE activity.target_contact_id = tc.id
     AND activity.status = 'active') AS last_relationship_activity,

    -- Relationship strength metrics
    (SELECT COUNT(*) FROM contact_relationships strong
     WHERE strong.target_contact_id = tc.id
     AND strong.relationship_strength IN ('strong', 'very_strong')
     AND strong.status = 'active') AS strong_relationships_count,

    (SELECT COUNT(*) FROM contact_relationships priority
     WHERE priority.target_contact_id = tc.id
     AND priority.priority IN ('high', 'critical')
     AND priority.status = 'active') AS high_priority_relationships_count

FROM contacts tc
WHERE tc.contact_type IN ('company', 'service')
ORDER BY entity_name;

-- ============================================================================
-- CONTACT NETWORK VIEW
-- ============================================================================

-- Network analysis view for relationship mapping
CREATE VIEW v_contact_network AS
SELECT
    cr.id,
    cr.source_contact_id,
    cr.target_contact_id,
    cr.relationship_type,
    cr.relationship_strength,
    cr.priority,
    cr.communication_frequency,
    cr.last_interaction_date,

    -- Source contact details
    CASE
        WHEN sc.contact_type = 'individual' THEN sc.first_name || ' ' || sc.last_name
        WHEN sc.contact_type = 'company' THEN sc.company_name
        ELSE sc.service_name
    END AS source_name,
    sc.contact_type AS source_type,

    -- Target contact details
    CASE
        WHEN tc.contact_type = 'individual' THEN tc.first_name || ' ' || tc.last_name
        WHEN tc.contact_type = 'company' THEN tc.company_name
        ELSE tc.service_name
    END AS target_name,
    tc.contact_type AS target_type,

    -- Network metrics
    (SELECT COUNT(*) FROM contact_relationships source_rels
     WHERE source_rels.source_contact_id = cr.source_contact_id
     AND source_rels.status = 'active') AS source_total_relationships,

    (SELECT COUNT(*) FROM contact_relationships target_rels
     WHERE target_rels.target_contact_id = cr.target_contact_id
     AND target_rels.status = 'active') AS target_total_relationships,

    -- Bidirectional relationship check
    (SELECT COUNT(*) FROM contact_relationships reverse_rel
     WHERE reverse_rel.source_contact_id = cr.target_contact_id
     AND reverse_rel.target_contact_id = cr.source_contact_id
     AND reverse_rel.status = 'active') AS is_bidirectional

FROM contact_relationships cr
LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
WHERE cr.status = 'active'
ORDER BY cr.priority DESC, cr.relationship_strength DESC;

-- ============================================================================
-- VIEW COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON VIEW v_active_relationships IS 'Complete view of active relationships with joined contact details';
COMMENT ON VIEW v_employment_relationships IS 'Detailed employment relationships with employee and employer information';
COMMENT ON VIEW v_organization_hierarchy IS 'Organizational hierarchy with management chains and reporting structure';
COMMENT ON VIEW v_shareholder_relationships IS 'Ownership and investment relationships with financial details';
COMMENT ON VIEW v_relationship_summary IS 'High-level relationship metrics for dashboard and reporting';
COMMENT ON VIEW v_contact_network IS 'Network analysis view for relationship mapping and visualization';

-- End of Views Definition