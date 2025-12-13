-- ============================================================================
-- 🏢 ENTERPRISE UNIFIED DATABASE SCHEMA
-- ============================================================================
--
-- 🎯 ΣΤΟΧΟΣ: Single Source of Truth για όλα τα δεδομένα της εφαρμογής
-- 🔄 ΑΝΤΙΚΑΘΙΣΤΑ: Firebase + διάσπαρτες PostgreSQL βάσεις
--
-- ARCHITECTURE:
-- - PostgreSQL για ACID transactions, performance, reliability
-- - PostGIS για spatial data (locations, zones, maps)
-- - Optimized indexes για fast queries
-- - Foreign keys για referential integrity
-- - Audit trails για enterprise compliance
--
-- ============================================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 🏗️ CORE BUSINESS ENTITIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANIES TABLE - Εταιρείες/Οργανισμοί
-- ----------------------------------------------------------------------------

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255), -- Επίσημη επωνυμία
    vat_number VARCHAR(50) UNIQUE,
    tax_office VARCHAR(100),

    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),

    -- Address & Location
    address JSONB, -- Structured address
    location GEOMETRY(POINT, 4326), -- PostGIS location

    -- Business Information
    business_type VARCHAR(100), -- developer, contractor, service, etc.
    description TEXT,
    registration_number VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

    -- Metadata
    metadata JSONB DEFAULT '{}', -- Flexible for additional fields

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 2. PROJECTS TABLE - Έργα/Projects
-- ----------------------------------------------------------------------------

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_code VARCHAR(50) UNIQUE, -- Κωδικός έργου

    -- Developer Information
    developer_company_id UUID REFERENCES companies(id),

    -- Location & Spatial
    address JSONB,
    location GEOMETRY(POINT, 4326),
    project_area GEOMETRY(POLYGON, 4326), -- Περιοχή έργου

    -- Project Details
    project_type VARCHAR(50), -- residential, commercial, mixed, etc.
    total_area_sqm DECIMAL(12,2),
    building_permit VARCHAR(100),
    permit_date DATE,

    -- Timeline
    start_date DATE,
    completion_date DATE,
    delivery_date DATE,

    -- Status & Phase
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN (
        'planning', 'approved', 'construction', 'completed', 'delivered', 'archived'
    )),
    phase VARCHAR(50), -- foundation, structure, finishing, etc.

    -- Financial (optional summary data)
    estimated_budget DECIMAL(15,2),
    current_cost DECIMAL(15,2),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 3. BUILDINGS TABLE - Κτίρια
-- ----------------------------------------------------------------------------

CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Project Relationship
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Building Information
    name VARCHAR(255) NOT NULL, -- Building A, Tower 1, etc.
    building_code VARCHAR(50),

    -- Physical Characteristics
    floors_above_ground INTEGER DEFAULT 0,
    floors_below_ground INTEGER DEFAULT 0,
    total_area_sqm DECIMAL(12,2),

    -- Location within Project
    location GEOMETRY(POINT, 4326), -- Building specific location
    building_footprint GEOMETRY(POLYGON, 4326), -- Building outline

    -- Construction Details
    construction_type VARCHAR(100), -- concrete, steel, mixed, etc.
    building_use VARCHAR(100), -- residential, commercial, parking, etc.

    -- Status
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN (
        'planned', 'foundation', 'structure', 'finishing', 'completed'
    )),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 4. UNITS TABLE - Μονάδες (Διαμερίσματα, Γραφεία, κλπ)
-- ----------------------------------------------------------------------------

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Building Relationship
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

    -- Unit Identification
    unit_number VARCHAR(50) NOT NULL, -- A1, B205, P-12, etc.
    unit_code VARCHAR(100), -- Unique identifier

    -- Physical Characteristics
    floor INTEGER,
    unit_type VARCHAR(50), -- apartment, office, parking, storage, etc.
    area_sqm DECIMAL(10,2),
    rooms INTEGER, -- Δωμάτια
    bathrooms INTEGER,
    balconies INTEGER,

    -- Location & Layout
    location GEOMETRY(POINT, 4326), -- Unit centroid
    unit_polygon GEOMETRY(POLYGON, 4326), -- Unit outline

    -- Pricing & Sales
    list_price DECIMAL(12,2),
    sale_price DECIMAL(12,2),
    price_per_sqm DECIMAL(10,2),

    -- Status & Ownership
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
        'available', 'reserved', 'sold', 'delivered', 'rented'
    )),

    -- Customer Relationship
    sold_to UUID, -- References contacts(id) - πελάτης που αγόρασε
    reserved_by UUID, -- References contacts(id) - πελάτης που κράτησε
    sale_date DATE,
    delivery_date DATE,

    -- Technical Details
    energy_certificate VARCHAR(10), -- A+, A, B, C, etc.
    heating_type VARCHAR(50),
    cooling_type VARCHAR(50),

    -- Metadata
    metadata JSONB DEFAULT '{}', -- For flexible additional data

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    UNIQUE(building_id, unit_number)
);

-- ============================================================================
-- 👥 CONTACTS & RELATIONSHIPS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. CONTACTS TABLE - Επαφές (Unified: Individuals + Companies + Services)
-- ----------------------------------------------------------------------------

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Contact Type & Category
    contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('individual', 'company', 'service')),
    category VARCHAR(50), -- customer, supplier, contractor, agent, etc.

    -- Universal Fields
    display_name VARCHAR(255) NOT NULL, -- Computed display name
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),

    -- Address & Location
    address JSONB,
    location GEOMETRY(POINT, 4326),

    -- Individual-specific Fields (NULL for companies)
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    father_name VARCHAR(100),
    birth_date DATE,
    personal_vat VARCHAR(50), -- ΑΦΜ φυσικού προσώπου
    amka VARCHAR(50),
    id_number VARCHAR(50), -- Ταυτότητα/Διαβατήριο

    -- Company-specific Fields (NULL for individuals)
    company_name VARCHAR(255),
    legal_form VARCHAR(50), -- ΑΕ, ΕΠΕ, ΟΕ, etc.
    company_vat VARCHAR(50), -- ΑΦΜ εταιρείας
    doy VARCHAR(100), -- ΔΟΥ

    -- Service-specific Fields
    service_name VARCHAR(255),
    department VARCHAR(100),

    -- Communication Preferences
    preferred_contact_method VARCHAR(20) DEFAULT 'email',
    communication_preferences JSONB DEFAULT '{}',

    -- Status & Classification
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    is_vip BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- Metadata & Custom Fields
    tags TEXT[], -- Array of tags
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- ----------------------------------------------------------------------------
-- 6. CONTACT_RELATIONSHIPS TABLE - Σχέσεις μεταξύ επαφών
-- ----------------------------------------------------------------------------

CREATE TABLE contact_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationship Participants
    source_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    target_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Relationship Definition
    relationship_type VARCHAR(50) NOT NULL, -- employee, partner, contractor, etc.
    relationship_subtype VARCHAR(50), -- manager, ceo, architect, etc.

    -- Relationship Details
    position VARCHAR(100), -- Job title or role
    department VARCHAR(100),
    hierarchy_level INTEGER, -- For organizational structure

    -- Status & Validity
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    start_date DATE,
    end_date DATE,

    -- Permissions & Access (for business relationships)
    permissions JSONB DEFAULT '{}',

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Prevent self-relationships
    CHECK (source_contact_id != target_contact_id),

    -- Unique relationship per pair
    UNIQUE(source_contact_id, target_contact_id, relationship_type)
);

-- ============================================================================
-- 🗓️ BUSINESS PROCESSES & EVENTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7. TRANSACTIONS TABLE - Πωλήσεις, Κρατήσεις, Συμβόλαια
-- ----------------------------------------------------------------------------

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Transaction Participants
    unit_id UUID NOT NULL REFERENCES units(id),
    customer_contact_id UUID NOT NULL REFERENCES contacts(id),
    agent_contact_id UUID REFERENCES contacts(id), -- Sales agent

    -- Transaction Type
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'reservation', 'sale', 'contract', 'delivery', 'cancellation'
    )),

    -- Financial Details
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50), -- cash, transfer, loan, etc.
    payment_status VARCHAR(20) DEFAULT 'pending',

    -- Timeline
    transaction_date DATE NOT NULL,
    expected_completion_date DATE,
    actual_completion_date DATE,

    -- Legal Documents
    contract_number VARCHAR(100),
    contract_date DATE,
    notary_contact_id UUID REFERENCES contacts(id),

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'completed', 'cancelled'
    )),

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- ============================================================================
-- 📄 DOCUMENT MANAGEMENT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8. DOCUMENTS TABLE - Αρχεία & Έγγραφα
-- ----------------------------------------------------------------------------

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Document Classification
    document_type VARCHAR(50) NOT NULL, -- contract, permit, plan, photo, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- File Information
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- Storage path
    file_size BIGINT,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64), -- SHA-256 for integrity

    -- Related Entities (polymorphic relationships)
    related_entity_type VARCHAR(20), -- project, building, unit, contact, transaction
    related_entity_id UUID,

    -- Access Control
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('public', 'internal', 'private')),
    access_permissions JSONB DEFAULT '{}',

    -- Document Metadata
    version INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT TRUE,
    tags TEXT[],

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID,

    -- Indexes for polymorphic queries
    INDEX (related_entity_type, related_entity_id)
);

-- ============================================================================
-- 🚨 SPATIAL ALERTS & NOTIFICATIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 9. ALERT_ZONES TABLE - Ζώνες ειδοποιήσεων
-- ----------------------------------------------------------------------------

CREATE TABLE alert_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Zone Definition
    zone_name VARCHAR(255) NOT NULL,
    zone_geometry GEOMETRY(POLYGON, 4326) NOT NULL,

    -- Alert Configuration
    alert_type VARCHAR(50) NOT NULL, -- property_change, new_project, etc.
    conditions JSONB NOT NULL, -- Alert trigger conditions

    -- User & Permissions
    owner_contact_id UUID NOT NULL REFERENCES contacts(id),
    is_active BOOLEAN DEFAULT TRUE,

    -- Notification Settings
    notification_channels TEXT[] DEFAULT ARRAY['email'], -- email, sms, push, webhook
    notification_frequency VARCHAR(20) DEFAULT 'immediate',

    -- Statistics
    alerts_triggered INTEGER DEFAULT 0,
    last_alert_at TIMESTAMP WITH TIME ZONE,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- ----------------------------------------------------------------------------
-- 10. ALERT_EVENTS TABLE - Ιστορικό ειδοποιήσεων
-- ----------------------------------------------------------------------------

CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Alert Zone Reference
    alert_zone_id UUID NOT NULL REFERENCES alert_zones(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    trigger_location GEOMETRY(POINT, 4326),

    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dismissed')),
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Notification Results
    notification_results JSONB,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 📊 ANALYTICS & REPORTING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 11. ANALYTICS_EVENTS TABLE - Tracking user actions
-- ----------------------------------------------------------------------------

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Event Classification
    event_type VARCHAR(50) NOT NULL, -- page_view, unit_inquiry, contact_form, etc.
    event_category VARCHAR(50), -- marketing, sales, support, etc.

    -- User Information
    user_contact_id UUID REFERENCES contacts(id),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,

    -- Event Data
    event_data JSONB DEFAULT '{}',
    page_url TEXT,
    referrer TEXT,

    -- Location Context
    location GEOMETRY(POINT, 4326),

    -- Related Entities
    related_project_id UUID REFERENCES projects(id),
    related_building_id UUID REFERENCES buildings(id),
    related_unit_id UUID REFERENCES units(id),

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 🔧 SYSTEM TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 12. SCHEMA_MIGRATIONS TABLE - Version tracking
-- ----------------------------------------------------------------------------

CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64)
);

-- ============================================================================
-- 🚀 INDEXES FOR PERFORMANCE
-- ============================================================================

-- Spatial Indexes (PostGIS)
CREATE INDEX idx_companies_location ON companies USING GIST(location);
CREATE INDEX idx_projects_location ON projects USING GIST(location);
CREATE INDEX idx_projects_area ON projects USING GIST(project_area);
CREATE INDEX idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX idx_buildings_footprint ON buildings USING GIST(building_footprint);
CREATE INDEX idx_units_location ON units USING GIST(location);
CREATE INDEX idx_units_polygon ON units USING GIST(unit_polygon);
CREATE INDEX idx_contacts_location ON contacts USING GIST(location);
CREATE INDEX idx_alert_zones_geometry ON alert_zones USING GIST(zone_geometry);
CREATE INDEX idx_alert_events_trigger_location ON alert_events USING GIST(trigger_location);
CREATE INDEX idx_analytics_location ON analytics_events USING GIST(location);

-- Business Logic Indexes
CREATE INDEX idx_units_status_sold_to ON units(status, sold_to) WHERE status IN ('sold', 'reserved');
CREATE INDEX idx_units_building_status ON units(building_id, status);
CREATE INDEX idx_buildings_project_id ON buildings(project_id);
CREATE INDEX idx_contacts_type_status ON contacts(contact_type, status);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contact_relationships_source ON contact_relationships(source_contact_id);
CREATE INDEX idx_contact_relationships_target ON contact_relationships(target_contact_id);
CREATE INDEX idx_transactions_unit_customer ON transactions(unit_id, customer_contact_id);
CREATE INDEX idx_transactions_date_type ON transactions(transaction_date, transaction_type);

-- Full-text Search Indexes
CREATE INDEX idx_contacts_display_name_search ON contacts USING gin(to_tsvector('greek', display_name));
CREATE INDEX idx_projects_name_search ON projects USING gin(to_tsvector('greek', name));

-- JSONB Indexes
CREATE INDEX idx_companies_metadata ON companies USING gin(metadata);
CREATE INDEX idx_projects_metadata ON projects USING gin(metadata);
CREATE INDEX idx_units_metadata ON units USING gin(metadata);
CREATE INDEX idx_contacts_metadata ON contacts USING gin(metadata);
CREATE INDEX idx_contacts_address ON contacts USING gin(address);

-- Time-based Indexes
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX idx_alert_events_created_at ON alert_events(created_at);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);

-- ============================================================================
-- 🔄 TRIGGERS FOR AUTO-UPDATES
-- ============================================================================

-- Function για automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers σε όλα τα tables με updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_relationships_updated_at BEFORE UPDATE ON contact_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 📝 COMMENTS για DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Εταιρείες και οργανισμοί - developers, contractors, services';
COMMENT ON TABLE projects IS 'Έργα/Projects - κτιριακά έργα με χωρική αναφορά';
COMMENT ON TABLE buildings IS 'Κτίρια εντός έργων με γεωγραφικό προσδιορισμό';
COMMENT ON TABLE units IS 'Μονάδες (διαμερίσματα, γραφεία, parking) με spatial data';
COMMENT ON TABLE contacts IS 'Unified επαφές - φυσικά πρόσωπα, εταιρείες, υπηρεσίες';
COMMENT ON TABLE contact_relationships IS 'Σχέσεις μεταξύ επαφών - organizational structure';
COMMENT ON TABLE transactions IS 'Πωλήσεις, κρατήσεις, συμβόλαια με audit trail';
COMMENT ON TABLE documents IS 'Διαχείριση εγγράφων με polymorphic relationships';
COMMENT ON TABLE alert_zones IS 'Γεωγραφικές ζώνες για spatial alerts';
COMMENT ON TABLE alert_events IS 'Ιστορικό ειδοποιήσεων και events';
COMMENT ON TABLE analytics_events IS 'Tracking user behavior και analytics';

-- ============================================================================
-- ✅ SCHEMA CREATION COMPLETE
-- ============================================================================

-- Log completion
INSERT INTO schema_migrations (version, description, checksum) VALUES (
    '001_enterprise_unified_schema',
    'Complete enterprise schema with spatial support - Single Source of Truth',
    'enterprise_v1.0.0'
);

-- Verify PostGIS
SELECT PostGIS_Version();

-- Show created tables
SELECT
    table_name,
    table_type,
    table_comment.description
FROM information_schema.tables
LEFT JOIN (
    SELECT
        table_name,
        obj_description(c.oid) as description
    FROM information_schema.tables t
    JOIN pg_class c ON c.relname = t.table_name
    WHERE t.table_schema = 'public'
) table_comment ON table_comment.table_name = information_schema.tables.table_name
WHERE table_schema = 'public'
ORDER BY table_name;