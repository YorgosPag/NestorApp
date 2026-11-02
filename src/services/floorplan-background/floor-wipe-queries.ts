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
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { isPropertyViewLevel } from '@/lib/dxf-viewer/level-view-kind';

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

/**
 * Μια εγγραφή `files` του ορόφου — **ολόκληρη**: την κρίνουν ο κριτής δέσμευσης (`isFileHeld`), ο κριτής του κάδου
 * (`isInTrash`) και ο φρουρός των συνοδευτικών (`isCompanionPathOf`). Ως τις 2026-11-02 κρατούσε μόνο `storagePath` +
 * `storagePlacement` ⇒ κανείς δεν μπορούσε να ρωτήσει «κρατείται;» (ADR-899 §2.2.1).
 */
export interface FileRow {
  ref: FirebaseFirestore.DocumentReference;
  data: Readonly<FirebaseFirestore.DocumentData>;
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

/**
 * Το επίπεδο (ή τα επίπεδα) που είναι **η κάτοψη του ορόφου**.
 *
 * 🔴 ADR-914 §2.17 — οι κατόψεις **ακινήτων** του ορόφου μοιράζονται το `floorId` του (ADR-420)
 * χωρίς να είναι ο όροφος. Το `floorId ==` τις έφερνε όλες, και το wipe αντικατάστασης έσβηνε
 * οριστικά το σχέδιο κάθε διαμερίσματος του ορόφου. Το φίλτρο γίνεται στη μνήμη: τα παλιά
 * επίπεδα δεν έχουν καν το πεδίο `propertyId`, και το Firestore δεν ρωτά «απόν Ή null».
 */
export async function listStoreyDxfLevels(
  db: Firestore,
  companyId: string,
  floorId: string,
): Promise<DxfLevelRow[]> {
  const snap = await db
    .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  const storeyDocs = snap.docs.filter(
    (d) => !isPropertyViewLevel(d.data() as { propertyId?: string | null }),
  );
  return storeyDocs.map((d) => {
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
      const data = snap.data() ?? {};
      // ADR-742 §4 — αρχείο **χωρίς** μισθωτή δεν ανήκει σε κανέναν, άρα δεν
      // σβήνεται από κανέναν. Σε **wipe** η κατεύθυνση του σφάλματος έχει
      // σημασία: fail-closed είναι παράλειψη, fail-open είναι απώλεια δεδομένων.
      if (!isPayloadOwnedByCompany(data, companyId)) {
        logger.warn('Cross-tenant file skipped during wipe', { fileId: id });
        return null;
      }
      return { ref: snap.ref, data } satisfies FileRow;
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
  return snap.docs.map((d) => ({ ref: d.ref, data: d.data() }) satisfies FileRow);
}

/**
 * ADR-351: **κάθε** εγγραφή του ορόφου — όσες δείχνουν υπόβαθρα/επίπεδα **∪** όσες έχουν τον όροφο ως οντότητα,
 * χωρίς διπλότυπα. Η ΜΙΑ συλλογή που μοιράζονται η προεπισκόπηση και το wipe, ώστε ο αριθμός του διαλόγου να είναι
 * ακριβώς ό,τι θα γίνει.
 */
export async function gatherFloorFileRows(
  db: Firestore,
  companyId: string,
  floorId: string,
  backgrounds: BackgroundRow[],
  dxfLevels: DxfLevelRow[],
): Promise<FileRow[]> {
  const [referenced, entityRows] = await Promise.all([
    loadFileRows(db, companyId, collectFileIds(backgrounds, dxfLevels)),
    listAllFloorFileRows(db, companyId, floorId),
  ]);
  const byId = new Map<string, FileRow>();
  for (const row of [...referenced, ...entityRows]) byId.set(row.ref.id, row);
  return [...byId.values()];
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
    // 🔴 ADR-742 §4 — ρητή παγίδα κενού (`data.companyId && …`): όροφος χωρίς
    // μισθωτή περνούσε για **οποιονδήποτε**, και το `projectId` του διέρρεε.
    if (!isPayloadOwnedByCompany(data, companyId)) {
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
