/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floor Wipe — Firestore query helpers (server-only)
 * =============================================================================
 *
 * Read-only Firestore queries used exclusively by
 * {@link FloorplanFloorWipeService} during the "gather" phase of a floor wipe.
 * Extracted here so the main service file stays under the 500-line limit while
 * keeping each module at a single responsibility.
 *
 * All queries keep their `companyId` filter for tenant isolation (ADR-298).
 *
 * @module services/floorplan-background/floor-wipe-queries
 */

import 'server-only';

import type { Firestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FloorWipeQueries');

// ============================================================================
// TYPES (internal row shapes used by the wipe service)
// ============================================================================

export interface BackgroundRow {
  ref: FirebaseFirestore.DocumentReference;
  fileId: string;
}

export interface DxfLevelRow {
  ref: FirebaseFirestore.DocumentReference;
  sceneFileId: string | null;
}

export interface FileRow {
  ref: FirebaseFirestore.DocumentReference;
  storagePath: string | null;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

export async function listBackgrounds(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<BackgroundRow[]> {
  const snap = await db
    .collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return snap.docs.map((d) => ({
    ref: d.ref,
    fileId: String((d.data() as { fileId?: string }).fileId ?? ''),
  }));
}

export async function listDxfLevels(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<DxfLevelRow[]> {
  const snap = await db
    .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as { sceneFileId?: string | null };
    return {
      ref: d.ref,
      sceneFileId:
        typeof data.sceneFileId === 'string' && data.sceneFileId.length > 0
          ? data.sceneFileId
          : null,
    };
  });
}

export async function loadFileRows(
  db: Firestore,
  companyId: string,
  fileIds: string[],
): Promise<FileRow[]> {
  if (fileIds.length === 0) return [];
  const rows = await Promise.all(
    fileIds.map(async (id) => {
      const snap = await db.collection(COLLECTIONS.FILES).doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() as { companyId?: string; storagePath?: string };
      if (data.companyId !== companyId) {
        logger.warn('Cross-tenant file skipped during wipe', { fileId: id });
        return null;
      }
      return {
        ref: snap.ref,
        storagePath:
          typeof data.storagePath === 'string' ? data.storagePath : null,
      } satisfies FileRow;
    }),
  );
  return rows.filter((r): r is FileRow => r !== null);
}

/**
 * ADR-351: List every FileRecord whose entity is this floor, regardless of
 * whether it is referenced from a floorplan_backgrounds or dxf_viewer_levels
 * doc. Without this, FileRecords created but never linked (e.g. upload races,
 * partial wizard exits) are left orphan in Firestore — and surface later as
 * "ghost" floorplans with no Storage binary (incident 2026-05-15).
 */
export async function listAllFloorFileRows(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<FileRow[]> {
  const snap = await db
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', companyId)
    .where('entityType', '==', 'floor')
    .where('entityId', '==', floorId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as { storagePath?: string };
    return {
      ref: d.ref,
      storagePath:
        typeof data.storagePath === 'string' ? data.storagePath : null,
    } satisfies FileRow;
  });
}

export async function loadFloorProjectId(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<string | null> {
  try {
    const snap = await db.collection(COLLECTIONS.FLOORS).doc(floorId).get();
    if (!snap.exists) return null;
    const data = snap.data() as { companyId?: string; projectId?: string };
    if (data.companyId && data.companyId !== companyId) {
      logger.warn('Cross-tenant floor doc skipped during wipe', { floorId });
      return null;
    }
    return typeof data.projectId === 'string' && data.projectId.length > 0
      ? data.projectId
      : null;
  } catch (err) {
    logger.warn('Floor projectId lookup failed (non-blocking)', {
      floorId,
      error: getErrorMessage(err),
    });
    return null;
  }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Collect the union of fileIds referenced by background docs and dxf level
 * docs. De-duplicated via a Set so each fileId appears at most once.
 */
export function collectFileIds(
  backgrounds: BackgroundRow[],
  dxfLevels: DxfLevelRow[],
): string[] {
  const ids = new Set<string>();
  for (const b of backgrounds) {
    if (b.fileId) ids.add(b.fileId);
  }
  for (const l of dxfLevels) {
    if (l.sceneFileId) ids.add(l.sceneFileId);
  }
  return [...ids];
}
