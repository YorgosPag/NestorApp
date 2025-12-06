-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - STORED PROCEDURES
-- ============================================================================
--
-- 🔧 High-performance stored procedures for Contact Relationship Management System
-- Enterprise-grade functions for complex business operations
--
-- Features:
-- - Optimized organization queries
-- - Employment history tracking
-- - Hierarchy analysis functions
-- - Bulk operations support
-- - Performance analytics
--
-- ============================================================================

-- ============================================================================
-- ORGANIZATION EMPLOYEE QUERIES
-- ============================================================================

-- Get organization employees with complete hierarchy information
CREATE OR REPLACE FUNCTION get_organization_employees(
    org_id UUID,
    include_inactive BOOLEAN DEFAULT FALSE,
    department_filter VARCHAR(200) DEFAULT NULL
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_email TEXT,
    position VARCHAR(200),
    department VARCHAR(200),
    team VARCHAR(200),
    hierarchy_level INTEGER,
    seniority_level VARCHAR(20),
    employment_status VARCHAR(30),
    employment_type VARCHAR(20),
    manager_id UUID,
    manager_name TEXT,
    start_date DATE,
    end_date DATE,
    business_email VARCHAR(255),
    business_phone VARCHAR(20),
    office_location VARCHAR(200),
    direct_reports_count INTEGER,
    annual_compensation DECIMAL(15,2),
    performance_rating VARCHAR(30),
    last_review_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.source_contact_id AS employee_id,
        (sc.first_name || ' ' || sc.last_name) AS employee_name,
        sc.email AS employee_email,
        cr.position,
        cr.department,
        cr.team,
        cr.reporting_level AS hierarchy_level,
        cr.seniority_level,
        cr.employment_status,
        cr.employment_type,
        mgr_rel.source_contact_id AS manager_id,
        (mgr_contact.first_name || ' ' || mgr_contact.last_name) AS manager_name,
        cr.start_date,
        cr.end_date,
        cr.business_email,
        cr.business_phone,
        cr.office_location,
        (SELECT COUNT(*)::INTEGER FROM contact_relationships subordinates
         WHERE subordinates.direct_manager_relationship_id = cr.id
         AND subordinates.status = 'active') AS direct_reports_count,
        cr.annual_compensation,
        cr.performance_rating,
        cr.last_review_date
    FROM contact_relationships cr
    LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
    LEFT JOIN contact_relationships mgr_rel ON cr.direct_manager_relationship_id = mgr_rel.id
    LEFT JOIN contacts mgr_contact ON mgr_rel.source_contact_id = mgr_contact.id
    WHERE cr.target_contact_id = org_id
    AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND (include_inactive OR cr.status = 'active')
    AND (department_filter IS NULL OR cr.department = department_filter)
    ORDER BY cr.reporting_level, cr.department, cr.position;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EMPLOYMENT HISTORY FUNCTIONS
-- ============================================================================

-- Get complete employment history for a person
CREATE OR REPLACE FUNCTION get_person_employment_history(
    person_id UUID,
    include_current BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    relationship_id UUID,
    employer_id UUID,
    employer_name TEXT,
    employer_type VARCHAR(20),
    position VARCHAR(200),
    department VARCHAR(200),
    start_date DATE,
    end_date DATE,
    employment_duration INTERVAL,
    is_current BOOLEAN,
    employment_status VARCHAR(30),
    annual_compensation DECIMAL(15,2),
    business_email VARCHAR(255),
    reason_for_leaving TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id AS relationship_id,
        cr.target_contact_id AS employer_id,
        CASE
            WHEN tc.contact_type = 'company' THEN tc.company_name
            WHEN tc.contact_type = 'service' THEN tc.service_name
            ELSE tc.first_name || ' ' || tc.last_name
        END AS employer_name,
        tc.contact_type AS employer_type,
        cr.position,
        cr.department,
        cr.start_date,
        cr.end_date,
        CASE
            WHEN cr.end_date IS NOT NULL THEN (cr.end_date - cr.start_date)
            WHEN cr.start_date IS NOT NULL THEN (CURRENT_DATE - cr.start_date)
            ELSE NULL
        END AS employment_duration,
        (cr.status = 'active' AND cr.end_date IS NULL) AS is_current,
        cr.employment_status,
        cr.annual_compensation,
        cr.business_email,
        cr.relationship_notes AS reason_for_leaving
    FROM contact_relationships cr
    LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
    WHERE cr.source_contact_id = person_id
    AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND (include_current OR cr.status != 'active')
    ORDER BY
        CASE WHEN cr.status = 'active' THEN 0 ELSE 1 END,
        cr.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HIERARCHY ANALYSIS FUNCTIONS
-- ============================================================================

-- Get organization hierarchy tree with all levels
CREATE OR REPLACE FUNCTION get_organization_hierarchy_tree(
    org_id UUID,
    max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    position VARCHAR(200),
    department VARCHAR(200),
    level_depth INTEGER,
    manager_id UUID,
    manager_name TEXT,
    subordinates_count INTEGER,
    hierarchy_path TEXT
) AS $$
WITH RECURSIVE hierarchy_tree AS (
    -- Base case: top-level employees (no manager or reporting_level = 0)
    SELECT
        cr.source_contact_id AS employee_id,
        (sc.first_name || ' ' || sc.last_name) AS employee_name,
        cr.position,
        cr.department,
        0 AS level_depth,
        NULL::UUID AS manager_id,
        NULL::TEXT AS manager_name,
        0 AS subordinates_count,
        (sc.first_name || ' ' || sc.last_name) AS hierarchy_path
    FROM contact_relationships cr
    LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
    WHERE cr.target_contact_id = org_id
    AND cr.relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant')
    AND cr.status = 'active'
    AND (cr.direct_manager_relationship_id IS NULL OR cr.reporting_level = 0)

    UNION ALL

    -- Recursive case: employees with managers
    SELECT
        cr.source_contact_id AS employee_id,
        (sc.first_name || ' ' || sc.last_name) AS employee_name,
        cr.position,
        cr.department,
        ht.level_depth + 1,
        mgr_rel.source_contact_id AS manager_id,
        (mgr_contact.first_name || ' ' || mgr_contact.last_name) AS manager_name,
        0 AS subordinates_count,
        ht.hierarchy_path || ' -> ' || (sc.first_name || ' ' || sc.last_name) AS hierarchy_path
    FROM hierarchy_tree ht
    JOIN contact_relationships mgr_rel ON mgr_rel.source_contact_id = ht.employee_id
    JOIN contact_relationships cr ON cr.direct_manager_relationship_id = mgr_rel.id
    LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
    LEFT JOIN contacts mgr_contact ON mgr_rel.source_contact_id = mgr_contact.id
    WHERE cr.target_contact_id = org_id
    AND cr.status = 'active'
    AND ht.level_depth < max_depth
)
SELECT
    ht.employee_id,
    ht.employee_name,
    ht.position,
    ht.department,
    ht.level_depth,
    ht.manager_id,
    ht.manager_name,
    (SELECT COUNT(*)::INTEGER FROM contact_relationships subordinates
     WHERE subordinates.direct_manager_relationship_id IN (
         SELECT rel.id FROM contact_relationships rel
         WHERE rel.source_contact_id = ht.employee_id
         AND rel.target_contact_id = org_id
     )
     AND subordinates.status = 'active') AS subordinates_count,
    ht.hierarchy_path
FROM hierarchy_tree ht
ORDER BY ht.level_depth, ht.department, ht.position;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RELATIONSHIP ANALYTICS FUNCTIONS
-- ============================================================================

-- Get relationship statistics for an organization
CREATE OR REPLACE FUNCTION get_organization_relationship_stats(
    org_id UUID
)
RETURNS TABLE (
    total_relationships INTEGER,
    active_employees INTEGER,
    management_count INTEGER,
    departments_count INTEGER,
    average_tenure_months DECIMAL(10,2),
    high_performers_count INTEGER,
    recent_hires_30_days INTEGER,
    upcoming_reviews_30_days INTEGER,
    total_compensation DECIMAL(15,2),
    turnover_last_year INTEGER
) AS $$
DECLARE
    stats RECORD;
BEGIN
    SELECT
        COUNT(*) AS total_rels,
        COUNT(*) FILTER (WHERE relationship_type = 'employee' AND status = 'active') AS active_emp,
        COUNT(*) FILTER (WHERE relationship_type IN ('manager', 'director', 'executive') AND status = 'active') AS mgmt_count,
        COUNT(DISTINCT department) FILTER (WHERE status = 'active') AS dept_count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(end_date, CURRENT_DATE) - start_date)) / 2628000) AS avg_tenure, -- months
        COUNT(*) FILTER (WHERE performance_rating IN ('excellent', 'good') AND status = 'active') AS high_perf,
        COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE - INTERVAL '30 days' AND status = 'active') AS recent_hires,
        COUNT(*) FILTER (WHERE next_review_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'active') AS upcoming_reviews,
        SUM(annual_compensation) FILTER (WHERE status = 'active') AS total_comp,
        COUNT(*) FILTER (WHERE end_date >= CURRENT_DATE - INTERVAL '1 year' AND status = 'terminated') AS turnover_count
    INTO stats
    FROM contact_relationships
    WHERE target_contact_id = org_id
    AND relationship_type IN ('employee', 'manager', 'director', 'executive', 'civil_servant');

    RETURN QUERY
    SELECT
        stats.total_rels::INTEGER,
        stats.active_emp::INTEGER,
        stats.mgmt_count::INTEGER,
        stats.dept_count::INTEGER,
        stats.avg_tenure::DECIMAL(10,2),
        stats.high_perf::INTEGER,
        stats.recent_hires::INTEGER,
        stats.upcoming_reviews::INTEGER,
        stats.total_comp::DECIMAL(15,2),
        stats.turnover_count::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BULK OPERATIONS FUNCTIONS
-- ============================================================================

-- Update multiple relationships in bulk
CREATE OR REPLACE FUNCTION bulk_update_relationships(
    relationship_ids UUID[],
    update_fields JSONB,
    updated_by UUID
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    rel_id UUID;
BEGIN
    -- Loop through each relationship ID and apply updates
    FOREACH rel_id IN ARRAY relationship_ids
    LOOP
        UPDATE contact_relationships
        SET
            last_modified_by = updated_by,
            updated_at = NOW(),
            -- Apply dynamic updates based on JSON fields
            department = COALESCE((update_fields->>'department')::VARCHAR(200), department),
            position = COALESCE((update_fields->>'position')::VARCHAR(200), position),
            seniority_level = COALESCE((update_fields->>'seniority_level')::VARCHAR(20), seniority_level),
            employment_status = COALESCE((update_fields->>'employment_status')::VARCHAR(30), employment_status),
            annual_compensation = COALESCE((update_fields->>'annual_compensation')::DECIMAL(15,2), annual_compensation),
            performance_rating = COALESCE((update_fields->>'performance_rating')::VARCHAR(30), performance_rating),
            priority = COALESCE((update_fields->>'priority')::VARCHAR(20), priority),
            relationship_strength = COALESCE((update_fields->>'relationship_strength')::VARCHAR(20), relationship_strength),
            status = COALESCE((update_fields->>'status')::VARCHAR(20), status)
        WHERE id = rel_id;

        IF FOUND THEN
            updated_count := updated_count + 1;
        END IF;
    END LOOP;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEARCH AND FILTER FUNCTIONS
-- ============================================================================

-- Advanced relationship search function
CREATE OR REPLACE FUNCTION search_relationships(
    search_term TEXT DEFAULT NULL,
    relationship_types VARCHAR(50)[] DEFAULT NULL,
    organization_id UUID DEFAULT NULL,
    department_filter VARCHAR(200) DEFAULT NULL,
    status_filter VARCHAR(20) DEFAULT 'active',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    relationship_id UUID,
    source_name TEXT,
    target_name TEXT,
    relationship_type VARCHAR(50),
    position VARCHAR(200),
    department VARCHAR(200),
    status VARCHAR(20),
    start_date DATE,
    business_email VARCHAR(255),
    last_interaction_date DATE,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id AS relationship_id,
        CASE
            WHEN sc.contact_type = 'individual' THEN sc.first_name || ' ' || sc.last_name
            WHEN sc.contact_type = 'company' THEN sc.company_name
            ELSE sc.service_name
        END AS source_name,
        CASE
            WHEN tc.contact_type = 'individual' THEN tc.first_name || ' ' || tc.last_name
            WHEN tc.contact_type = 'company' THEN tc.company_name
            ELSE tc.service_name
        END AS target_name,
        cr.relationship_type,
        cr.position,
        cr.department,
        cr.status,
        cr.start_date,
        cr.business_email,
        cr.last_interaction_date,
        -- Simple relevance scoring
        CASE
            WHEN search_term IS NULL THEN 1.0
            ELSE (
                CASE WHEN cr.position ILIKE '%' || search_term || '%' THEN 0.3 ELSE 0.0 END +
                CASE WHEN cr.department ILIKE '%' || search_term || '%' THEN 0.2 ELSE 0.0 END +
                CASE WHEN cr.relationship_notes ILIKE '%' || search_term || '%' THEN 0.1 ELSE 0.0 END +
                CASE WHEN sc.first_name ILIKE '%' || search_term || '%' OR sc.last_name ILIKE '%' || search_term || '%' THEN 0.4 ELSE 0.0 END
            )
        END AS relevance_score
    FROM contact_relationships cr
    LEFT JOIN contacts sc ON cr.source_contact_id = sc.id
    LEFT JOIN contacts tc ON cr.target_contact_id = tc.id
    WHERE
        (search_term IS NULL OR
         cr.position ILIKE '%' || search_term || '%' OR
         cr.department ILIKE '%' || search_term || '%' OR
         cr.relationship_notes ILIKE '%' || search_term || '%' OR
         sc.first_name ILIKE '%' || search_term || '%' OR
         sc.last_name ILIKE '%' || search_term || '%' OR
         tc.company_name ILIKE '%' || search_term || '%' OR
         tc.service_name ILIKE '%' || search_term || '%')
    AND (relationship_types IS NULL OR cr.relationship_type = ANY(relationship_types))
    AND (organization_id IS NULL OR cr.target_contact_id = organization_id)
    AND (department_filter IS NULL OR cr.department = department_filter)
    AND (status_filter IS NULL OR cr.status = status_filter)
    ORDER BY relevance_score DESC, cr.last_interaction_date DESC NULLS LAST
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCEDURE COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_organization_employees(UUID, BOOLEAN, VARCHAR) IS 'Get complete employee list with hierarchy for an organization';
COMMENT ON FUNCTION get_person_employment_history(UUID, BOOLEAN) IS 'Get complete employment history for a person';
COMMENT ON FUNCTION get_organization_hierarchy_tree(UUID, INTEGER) IS 'Get complete organizational hierarchy tree with recursive structure';
COMMENT ON FUNCTION get_organization_relationship_stats(UUID) IS 'Get comprehensive relationship statistics for an organization';
COMMENT ON FUNCTION bulk_update_relationships(UUID[], JSONB, UUID) IS 'Bulk update multiple relationships with dynamic field updates';
COMMENT ON FUNCTION search_relationships(TEXT, VARCHAR[], UUID, VARCHAR, VARCHAR, INTEGER, INTEGER) IS 'Advanced search function with filtering and relevance scoring';

-- End of Stored Procedures Definition