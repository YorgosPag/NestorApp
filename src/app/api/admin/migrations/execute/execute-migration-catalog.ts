/**
 * =============================================================================
 * migrations/execute — migration catalog (ADR-704 split, data-only)
 * =============================================================================
 *
 * Static discovery data for GET (available migrations) + the id list surfaced
 * on an unknown-id 400. No logic → no size limit (N.7.1 data exemption).
 *
 * @module api/admin/migrations/execute/catalog
 */

/** Rich list returned by GET /api/admin/migrations/execute (discovery). */
export const AVAILABLE_MIGRATIONS = [
  {
    id: '001_fix_project_company_relationships',
    name: 'Fix Project-Company Relationships',
    version: '1.0.0',
    description: 'Corrects incorrect companyId values in projects to establish proper relationships with companies',
    author: 'Claude Enterprise Migration System',
    status: 'available',
  },
  {
    id: '002_normalize_floors_collection',
    name: 'Normalize Floors Collection (Enterprise 3NF)',
    version: '1.0.0',
    description: 'Extracts embedded buildingFloors arrays to normalized floors collection with proper foreign key relationships following 3NF principles',
    author: 'Claude Enterprise Migration System',
    status: 'available',
  },
  {
    id: '005_assign_project_codes',
    name: 'Assign Human-Readable Project Codes',
    version: '1.0.0',
    description: 'Assigns sequential human-readable project codes (PRJ-001, PRJ-002, etc.) to existing projects using atomic Firestore transactions',
    author: 'Enterprise Architecture Team',
    status: 'available',
  },
  {
    id: '006_normalize_storage_building_references',
    name: 'Normalize Storage Building References',
    version: '1.0.0',
    description: 'Convert storage.building (name) to storage.buildingId (ID) for enterprise data integrity',
    author: 'Enterprise Architecture Team',
    status: 'available',
  },
] as const;

/** Every dispatchable migration id — surfaced on an unknown-id 400. */
export const KNOWN_MIGRATION_IDS = [
  '001_fix_project_company_relationships',
  '002_normalize_floors_collection',
  '003_enterprise_database_architecture_consolidation',
  '005_assign_project_codes',
  '006_normalize_storage_building_references',
] as const;
