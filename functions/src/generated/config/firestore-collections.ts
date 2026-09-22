// ⚠️ GENERATED — DO NOT EDIT. Key projection of src/config/firestore-collections.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// Keys: 24 — computed from every `COLLECTIONS.KEY` read under functions/src.
// 24 keys have an app-side env override that a Cloud Function cannot see — marked inline.
// sha256:c34a79d966f41ea989bdfbd2a41d3490cd448fba7a8817f4bf3f161dfa1abde1

export const COLLECTIONS = {
  CONTACTS: 'contacts', // app override: process.env.NEXT_PUBLIC_CONTACTS_COLLECTION
  PROJECTS: 'projects', // app override: process.env.NEXT_PUBLIC_PROJECTS_COLLECTION
  BUILDINGS: 'buildings', // app override: process.env.NEXT_PUBLIC_BUILDINGS_COLLECTION
  PROPERTIES: 'properties', // app override: process.env.NEXT_PUBLIC_PROPERTIES_COLLECTION
  FLOORS: 'floors', // app override: process.env.NEXT_PUBLIC_FLOORS_COLLECTION
  COMMUNICATIONS: 'communications', // app override: process.env.NEXT_PUBLIC_COMMUNICATIONS_COLLECTION
  OPPORTUNITIES: 'opportunities', // app override: process.env.NEXT_PUBLIC_OPPORTUNITIES_COLLECTION
  TASKS: 'tasks', // app override: process.env.NEXT_PUBLIC_TASKS_COLLECTION
  USERS: 'users', // app override: process.env.NEXT_PUBLIC_USERS_COLLECTION
  FILES: 'files', // app override: process.env.NEXT_PUBLIC_FILES_COLLECTION
  FLOORPLAN_BACKGROUNDS: 'floorplan_backgrounds', // app override: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION
  PARKING_SPACES: 'parking_spots', // app override: process.env.NEXT_PUBLIC_PARKING_SPACES_COLLECTION
  STORAGE: 'storage_units', // app override: process.env.NEXT_PUBLIC_STORAGE_COLLECTION
  SEARCH_DOCUMENTS: 'search_documents', // app override: process.env.NEXT_PUBLIC_SEARCH_DOCUMENTS_COLLECTION
  CLOUD_FUNCTION_AUDIT_LOG: 'audit_log', // app override: process.env.NEXT_PUBLIC_CLOUD_FUNCTION_AUDIT_LOG_COLLECTION
  STORAGE_ORPHAN_CANDIDATES: 'storage_orphan_candidates', // app override: process.env.NEXT_PUBLIC_STORAGE_ORPHAN_CANDIDATES_COLLECTION
  FILE_SHARES: 'file_shares', // app override: process.env.NEXT_PUBLIC_FILE_SHARES_COLLECTION
  ENTITY_AUDIT_TRAIL: 'entity_audit_trail', // app override: process.env.NEXT_PUBLIC_ENTITY_AUDIT_TRAIL_COLLECTION
  PURCHASE_ORDERS: 'purchase_orders', // app override: process.env.NEXT_PUBLIC_PURCHASE_ORDERS_COLLECTION
  MATERIALS: 'materials', // app override: process.env.NEXT_PUBLIC_MATERIALS_COLLECTION
  FLOORPLAN_IMPORTED_MESHES: 'floorplan_imported_meshes', // app override: process.env.NEXT_PUBLIC_FLOORPLAN_IMPORTED_MESHES_COLLECTION
  BIM_MATERIALS: 'bim_materials', // app override: process.env.NEXT_PUBLIC_BIM_MATERIALS_COLLECTION
  BLOCK_LIBRARY: 'block_library', // app override: process.env.NEXT_PUBLIC_BLOCK_LIBRARY_COLLECTION
  BIM_COMMENTS: 'bim_comments', // app override: process.env.NEXT_PUBLIC_BIM_COMMENTS_COLLECTION
} as const;
