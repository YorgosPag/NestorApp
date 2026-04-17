/**
 * =============================================================================
 * RESTORE HELPERS — ADR-313 Phase 4
 * =============================================================================
 *
 * Extracted from RestoreService for SRP compliance (N.7.1 — max 500 lines).
 * Contains: tier ordering, DocumentReference resolution, nested path utils.
 *
 * @module services/backup/restore-helpers
 * @see adrs/ADR-313-enterprise-backup-restore.md §3.4
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { CollectionManifestEntry } from './backup-manifest.types';

// ---------------------------------------------------------------------------
// Tier ordering — respects collection dependencies (ADR-313 §3.4)
// ---------------------------------------------------------------------------

const COLLECTION_TIERS: readonly string[][] = [
  // Tier 0: System
  ['SYSTEM', 'SETTINGS', 'CONFIG', 'COUNTERS'],
  // Tier 1: Tenants
  ['COMPANIES', 'USERS', 'TEAMS', 'ROLES', 'PERMISSIONS'],
  // Tier 2: Core
  ['PROJECTS', 'CONTACTS', 'WORKSPACES'],
  // Tier 3: Structures
  ['BUILDINGS', 'FLOORS', 'PROPERTIES', 'PARKING_SPACES'],
  // Tier 4: Relations
  ['CONTACT_LINKS', 'CONTACT_RELATIONSHIPS', 'FILE_LINKS'],
  // Tier 5: Content
  ['FILES', 'COMMUNICATIONS', 'MESSAGES', 'TASKS', 'LEADS'],
  // Tier 6: Domain — construction_*, boq_*, accounting_*, legal_*, ownership_*
  [],
  // Tier 7: AI/System — ai_*, bot_*, search_*, attendance_*, audit trails
  [],
];

/**
 * Order collections by tier (system → tenants → core → ... → catch-all).
 * Collections not in any explicit tier go last.
 */
export function orderByTier(
  entries: CollectionManifestEntry[],
  filterKeys?: string[],
): CollectionManifestEntry[] {
  const filtered = filterKeys?.length
    ? entries.filter(e => filterKeys.includes(e.collectionKey))
    : entries;

  const tierIndex = new Map<string, number>();
  for (let tier = 0; tier < COLLECTION_TIERS.length; tier++) {
    for (const key of COLLECTION_TIERS[tier]) {
      tierIndex.set(key, tier);
    }
  }

  const MAX_TIER = COLLECTION_TIERS.length;

  return [...filtered].sort((a, b) => {
    const tierA = tierIndex.get(a.collectionKey) ?? MAX_TIER;
    const tierB = tierIndex.get(b.collectionKey) ?? MAX_TIER;
    return tierA - tierB;
  });
}

// ---------------------------------------------------------------------------
// DocumentReference resolution
// ---------------------------------------------------------------------------

/**
 * Convert serialized reference path strings back to DocumentReference objects.
 * During backup, DocumentReferences are stored as { _path: "collection/docId" }.
 * This resolves them back to actual Firestore DocumentReference instances.
 */
export function resolveReferences(
  db: Firestore,
  data: Record<string, unknown>,
  fieldTypes: Record<string, string>,
): Record<string, unknown> {
  const result = { ...data };

  for (const [fieldPath, fieldType] of Object.entries(fieldTypes)) {
    if (fieldType !== 'reference') continue;

    const value = getNestedValue(result, fieldPath);
    if (typeof value === 'object' && value !== null && '_path' in value) {
      const refPath = (value as { _path: string })._path;
      const ref = db.doc(refPath);
      setNestedValue(result, fieldPath, ref);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Nested path utilities
// ---------------------------------------------------------------------------

/** Get value at a dot-separated path in a nested object */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/** Set value at a dot-separated path in a nested object */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
