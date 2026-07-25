/**
 * =============================================================================
 * CLOUD FUNCTIONS: Firestore Collection Names (SSoT Mirror)
 * =============================================================================
 *
 * Single Source of Truth for collection names used by Cloud Functions.
 * Mirrors the main app's src/config/firestore-collections.ts.
 *
 * WHY A SEPARATE FILE:
 * Cloud Functions run in a separate deployment environment and cannot
 * import from the Next.js app's src/ directory. This file mirrors only
 * the collections that Cloud Functions actually use.
 *
 * RULE: When adding a collection here, ensure it matches the main app's
 * COLLECTIONS constant in src/config/firestore-collections.ts.
 *
 * @module functions/config/firestore-collections
 * @enterprise SSoT — Centralized collection names for Cloud Functions
 */

export const COLLECTIONS = {
  // 📄 FILES
  FILES: 'files',

  // 🔗 FILE SHARES — showcase PDFs, external shares (ADR-312)
  // Mirrors src/config/firestore-collections.ts FILE_SHARES constant.
  FILE_SHARES: 'file_shares',

  // 📋 AUDIT (Cloud Function system events)
  CLOUD_FUNCTION_AUDIT_LOG: 'audit_log',

  // 📜 ENTITY AUDIT TRAIL (ADR-195 — CDC-sourced entries written by triggers)
  ENTITY_AUDIT_TRAIL: 'entity_audit_trail',

  // 🏢 CORE ENTITIES — indexed for Global Search (ADR-029)
  PROJECTS: 'projects',
  BUILDINGS: 'buildings',
  FLOORS: 'floors',
  PROPERTIES: 'properties',
  CONTACTS: 'contacts',
  PARKING_SPACES: 'parking_spots',
  STORAGE: 'storage_units',
  // 🤝 CRM ENTITIES — indexed for Global Search (ADR-029 Phase 2)
  OPPORTUNITIES: 'opportunities',
  COMMUNICATIONS: 'communications',
  TASKS: 'tasks',
  // 🔍 SEARCH INDEX OUTPUT
  SEARCH_DOCUMENTS: 'search_documents',

  // 👤 USERS — looked up by CDC audit trigger to resolve performer display name
  USERS: 'users',

  // 🧱 PROCUREMENT — Material catalog (ADR-330 Phase 4); written by
  // materialPriceSyncOnPODelivery trigger when a PO transitions to delivered.
  MATERIALS: 'materials',

  // 🖼️ FLOORPLAN BACKGROUND SYSTEM (ADR-340 Phase 7) — read by
  // onDeleteFloorplanBackground trigger for fileId reference counting.
  FLOORPLAN_BACKGROUNDS: 'floorplan_backgrounds',
  FLOORPLAN_OVERLAYS: 'floorplan_overlays',

  // 🪑 IMPORTED MESHES (ADR-683 Φ3) — read by onStorageFinalize orphan-cleanup to
  // recognise a `.glb` claim. Ownership is by `params.uploadId` (many entities → one
  // file), NOT by doc-id → needs a QUERY provider (see file-ownership-resolver).
  FLOORPLAN_IMPORTED_MESHES: 'floorplan_imported_meshes',

  // 🎨 BIM MATERIALS (ADR-413 §2D) — owner of `bim-material-textures/{materialId}/{map}.{ext}`
  // and `bim-material-thumbnails/{materialId}.{ext}`. Added by ADR-694 Α2: the texture path
  // keys custody on the FOLDER (materialId), not the basename (which is the map channel).
  BIM_MATERIALS: 'bim_materials',

  // 💬 BIM COMMENTS (ADR-366 Φ9/C.2) — owner of
  // `bim-comment-attachments/{commentId}/{attachmentId}[-thumb].{ext}`. Custody keys on the
  // FOLDER (commentId): one comment holds up to 5 attachments × 2 objects, so the basename is
  // the attachment, never the owner — the exact distinction ADR-694 was written for.
  BIM_COMMENTS: 'bim_comments',

  // 🧱 BLOCK LIBRARY (ADR-652) — owner of `block-library/{blockId}.json` geometry blobs.
  // Added by ADR-694 Α2 after 10 legitimate blobs were deleted 18–21/07 (§2.3).
  BLOCK_LIBRARY: 'block_library',

  // 🗂️ ORPHAN CANDIDATES (ADR-694 Α1/Α3) — the mark side of mark-and-sweep. `onStorageFinalize`
  // records here instead of deleting; `orphanSweeper` reclaims only entries that still prove
  // orphanhood after the retention window. Doc id = base64url of the storage path.
  STORAGE_ORPHAN_CANDIDATES: 'storage_orphan_candidates',
} as const;
