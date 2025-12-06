-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - SEED DATA
-- ============================================================================
--
-- 🌱 Sample data for Contact Relationship Management System testing
-- Enterprise-grade test data for development and QA environments
--
-- Features:
-- - Realistic employment hierarchies
-- - Sample shareholder relationships
-- - Test data for organizational structures
-- - Performance testing datasets
-- - Development environment examples
--
-- WARNING: This file contains sample data for testing purposes only
-- DO NOT RUN IN PRODUCTION ENVIRONMENTS
-- ============================================================================

-- ============================================================================
-- ENVIRONMENT CHECK
-- ============================================================================

-- Ensure we're not running in production
DO $$
BEGIN
    IF current_setting('application_name', true) = 'production' THEN
        RAISE EXCEPTION 'Cannot load seed data in production environment';
    END IF;

    -- Log seed data insertion
    RAISE NOTICE 'Loading Contact Relationships seed data for development/testing';
END $$;

-- ============================================================================
-- SAMPLE EMPLOYMENT RELATIONSHIPS
-- ============================================================================

-- Note: These UUIDs are fictional and should be replaced with actual contact IDs
-- when integrating with real contact data

-- Sample: Software Engineer at Tech Company
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    team,
    seniority_level,
    reporting_level,
    employment_status,
    employment_type,
    start_date,
    business_email,
    business_phone,
    office_location,
    annual_compensation,
    performance_rating,
    last_review_date,
    next_review_date,
    priority,
    relationship_strength,
    communication_frequency,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    '123e4567-e89b-12d3-a456-426614174001'::UUID, -- John Doe (Individual)
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc (Company)
    'employee',
    'active',
    'Senior Software Engineer',
    'Engineering',
    'Backend Development',
    'senior',
    2,
    'full_time',
    'permanent',
    '2023-01-15',
    'john.doe@techcorp.com',
    '+1-555-0123',
    'Building A, Floor 3, Desk 301',
    85000.00,
    'excellent',
    '2024-01-15',
    '2025-01-15',
    'high',
    'strong',
    'daily',
    'system'::UUID,
    'system'::UUID
);

-- Sample: IT Manager
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    team,
    seniority_level,
    reporting_level,
    employment_status,
    employment_type,
    start_date,
    business_email,
    business_phone,
    office_location,
    annual_compensation,
    performance_rating,
    direct_manager_relationship_id,
    priority,
    relationship_strength,
    communication_frequency,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002'::UUID,
    '123e4567-e89b-12d3-a456-426614174002'::UUID, -- Jane Smith (Individual)
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc (Company)
    'manager',
    'active',
    'Engineering Manager',
    'Engineering',
    'Backend Development',
    'senior',
    1,
    'full_time',
    'permanent',
    '2022-06-10',
    'jane.smith@techcorp.com',
    '+1-555-0124',
    'Building A, Floor 3, Office 305',
    110000.00,
    'excellent',
    NULL, -- No manager (top level)
    'critical',
    'very_strong',
    'daily',
    'system'::UUID,
    'system'::UUID
);

-- Update the first employee to report to the manager
UPDATE contact_relationships
SET direct_manager_relationship_id = '550e8400-e29b-41d4-a716-446655440002'::UUID
WHERE id = '550e8400-e29b-41d4-a716-446655440001'::UUID;

-- Sample: Company Executive
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    seniority_level,
    reporting_level,
    employment_status,
    employment_type,
    start_date,
    business_email,
    business_phone,
    office_location,
    annual_compensation,
    authority_level,
    signing_authority_limit,
    priority,
    relationship_strength,
    communication_frequency,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003'::UUID,
    '123e4567-e89b-12d3-a456-426614174003'::UUID, -- Michael Johnson (Individual)
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc (Company)
    'executive',
    'active',
    'Chief Technology Officer',
    'Executive',
    'c_level',
    0,
    'full_time',
    'permanent',
    '2020-03-01',
    'michael.johnson@techcorp.com',
    '+1-555-0125',
    'Building A, Floor 10, Suite 1001',
    250000.00,
    'executive',
    500000.00,
    'critical',
    'very_strong',
    'weekly',
    'system'::UUID,
    'system'::UUID
);

-- ============================================================================
-- SAMPLE SHAREHOLDER RELATIONSHIPS
-- ============================================================================

-- Sample: Individual Shareholder
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    ownership_percentage,
    start_date,
    business_email,
    priority,
    relationship_strength,
    communication_frequency,
    relationship_notes,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440011'::UUID,
    '123e4567-e89b-12d3-a456-426614174011'::UUID, -- Sarah Wilson (Individual Investor)
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc (Company)
    'shareholder',
    'active',
    15.50,
    '2019-12-01',
    'sarah.wilson.investor@email.com',
    'high',
    'strong',
    'monthly',
    'Angel investor, early supporter of the company',
    'system'::UUID,
    'system'::UUID
);

-- Sample: Corporate Shareholder
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    ownership_percentage,
    start_date,
    contract_value,
    business_email,
    priority,
    relationship_strength,
    communication_frequency,
    relationship_notes,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440012'::UUID,
    '123e4567-e89b-12d3-a456-426614174102'::UUID, -- VentureCapital Partners (Company)
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc (Company)
    'shareholder',
    'active',
    25.00,
    '2021-03-15',
    2500000.00,
    'investments@vcpartners.com',
    'critical',
    'very_strong',
    'monthly',
    'Series A lead investor with board seat',
    'system'::UUID,
    'system'::UUID
);

-- ============================================================================
-- SAMPLE SERVICE-INDIVIDUAL RELATIONSHIPS
-- ============================================================================

-- Sample: Government Employee
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    seniority_level,
    employment_status,
    employment_type,
    start_date,
    business_email,
    business_phone,
    office_location,
    priority,
    relationship_strength,
    communication_frequency,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440021'::UUID,
    '123e4567-e89b-12d3-a456-426614174021'::UUID, -- Robert Davis (Individual)
    '123e4567-e89b-12d3-a456-426614174201'::UUID, -- Ministry of Technology (Service)
    'civil_servant',
    'active',
    'Digital Transformation Specialist',
    'Digital Innovation',
    'mid',
    'permanent',
    'permanent',
    '2021-09-01',
    'robert.davis@ministry.gov',
    '+1-555-0200',
    'Government Building, Room 456',
    'medium',
    'moderate',
    'weekly',
    'system'::UUID,
    'system'::UUID
);

-- Sample: Department Head
INSERT INTO contact_relationships (
    id,
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    seniority_level,
    reporting_level,
    employment_status,
    employment_type,
    start_date,
    business_email,
    business_phone,
    authority_level,
    priority,
    relationship_strength,
    communication_frequency,
    created_by,
    last_modified_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440022'::UUID,
    '123e4567-e89b-12d3-a456-426614174022'::UUID, -- Lisa Anderson (Individual)
    '123e4567-e89b-12d3-a456-426614174201'::UUID, -- Ministry of Technology (Service)
    'department_head',
    'active',
    'Director of Digital Innovation',
    'Digital Innovation',
    'executive',
    0,
    'permanent',
    'permanent',
    '2018-04-15',
    'lisa.anderson@ministry.gov',
    '+1-555-0201',
    'high',
    'high',
    'strong',
    'daily',
    'system'::UUID,
    'system'::UUID
);

-- ============================================================================
-- SAMPLE CHANGE HISTORY DATA
-- ============================================================================

-- Sample change history entries for testing audit trails
INSERT INTO relationship_change_history (
    relationship_id,
    change_type,
    changed_by,
    old_value,
    new_value,
    change_notes
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    'created',
    'system'::UUID,
    NULL,
    '{"position": "Senior Software Engineer", "department": "Engineering"}',
    'Initial relationship creation'
);

INSERT INTO relationship_change_history (
    relationship_id,
    change_type,
    changed_by,
    old_value,
    new_value,
    change_notes
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    'updated',
    'system'::UUID,
    '{"annual_compensation": 80000.00}',
    '{"annual_compensation": 85000.00}',
    'Annual salary increase following performance review'
);

-- ============================================================================
-- SAMPLE DOCUMENT ATTACHMENTS
-- ============================================================================

-- Sample relationship documents
INSERT INTO relationship_documents (
    relationship_id,
    document_name,
    document_type,
    file_url,
    file_size,
    mime_type,
    uploaded_by,
    is_confidential
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    'Employment_Contract_John_Doe_2023.pdf',
    'contract',
    '/documents/contracts/john_doe_2023.pdf',
    256000,
    'application/pdf',
    'system'::UUID,
    true
);

INSERT INTO relationship_documents (
    relationship_id,
    document_name,
    document_type,
    file_url,
    file_size,
    mime_type,
    uploaded_by,
    expiry_date
) VALUES (
    '550e8400-e29b-41d4-a716-446655440012'::UUID,
    'Investment_Agreement_VCP_2021.pdf',
    'contract',
    '/documents/investments/vcp_agreement_2021.pdf',
    512000,
    'application/pdf',
    'system'::UUID,
    '2031-03-15'
);

-- ============================================================================
-- PERFORMANCE TEST DATA
-- ============================================================================

-- Generate additional test relationships for performance testing
-- (Uncomment for load testing scenarios)

/*
-- Generate 1000 sample employee relationships for performance testing
INSERT INTO contact_relationships (
    source_contact_id,
    target_contact_id,
    relationship_type,
    status,
    position,
    department,
    seniority_level,
    employment_status,
    start_date,
    business_email,
    created_by,
    last_modified_by
)
SELECT
    ('123e4567-e89b-12d3-a456-' || LPAD((426614174000 + generate_series)::text, 12, '0'))::UUID,
    '123e4567-e89b-12d3-a456-426614174101'::UUID, -- TechCorp Inc
    'employee',
    'active',
    'Software Engineer ' || generate_series,
    CASE (generate_series % 4)
        WHEN 0 THEN 'Engineering'
        WHEN 1 THEN 'Product'
        WHEN 2 THEN 'Sales'
        ELSE 'Operations'
    END,
    CASE (generate_series % 3)
        WHEN 0 THEN 'entry'
        WHEN 1 THEN 'mid'
        ELSE 'senior'
    END,
    'full_time',
    CURRENT_DATE - INTERVAL '1 year' * RANDOM(),
    'employee' || generate_series || '@techcorp.com',
    'system'::UUID,
    'system'::UUID
FROM generate_series(1000, 2000) AS generate_series;
*/

-- ============================================================================
-- SEED DATA VALIDATION
-- ============================================================================

-- Validate that seed data was inserted correctly
DO $$
DECLARE
    relationship_count INTEGER;
    document_count INTEGER;
    history_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO relationship_count FROM contact_relationships WHERE created_by = 'system'::UUID;
    SELECT COUNT(*) INTO document_count FROM relationship_documents WHERE uploaded_by = 'system'::UUID;
    SELECT COUNT(*) INTO history_count FROM relationship_change_history WHERE changed_by = 'system'::UUID;

    RAISE NOTICE 'Seed data validation:';
    RAISE NOTICE '- Relationships created: %', relationship_count;
    RAISE NOTICE '- Documents attached: %', document_count;
    RAISE NOTICE '- History entries: %', history_count;

    IF relationship_count < 6 THEN
        RAISE WARNING 'Expected at least 6 sample relationships, found %', relationship_count;
    END IF;
END $$;

-- ============================================================================
-- CLEANUP PROCEDURES FOR TESTING
-- ============================================================================

-- Function to clean up seed data (for test environments)
CREATE OR REPLACE FUNCTION cleanup_seed_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete seed data (identified by 'system' user)
    DELETE FROM relationship_documents WHERE uploaded_by = 'system'::UUID;
    DELETE FROM relationship_change_history WHERE changed_by = 'system'::UUID;
    DELETE FROM contact_relationships WHERE created_by = 'system'::UUID;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % seed data records', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cleanup_seed_data() IS 'Removes all seed data created for testing purposes';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Contact Relationships seed data loading completed successfully';
END $$;

-- End of Seed Data