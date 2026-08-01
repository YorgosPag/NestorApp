/**
 * @module services/saved-reports/saved-reports-service
 * @enterprise ADR-268 Phase 7 — Saved Reports CRUD Service
 *
 * Server-side Firestore CRUD for saved report configurations.
 * Pattern: Direct Firestore (same as report-query-executor.ts)
 * Uses Admin SDK for server-side operations.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { loadOwnedDocOrRefusal, type OwnedDoc } from '@/lib/auth/owned-doc-loader';
import { EnterpriseIdService } from '@/services/enterprise-id.service';
import type {
  SavedReport,
  CreateSavedReportInput,
  UpdateSavedReportInput,
  SavedReportVisibility,
} from '@/types/reports/saved-report';
import { nowISO } from '@/lib/date-local';

const idService = new EnterpriseIdService();

/**
 * 🔴 **Η αλυσίδα «φόρτωσε → υπάρχει; → δικό μου;», μία φορά** (N.18 · CHECK 3.28)
 *
 * Πέντε διαδρομές αυτού του αρχείου την έγραφαν χωριστά. Μόλις η σύγκριση
 * ενοποιήθηκε στον SSoT (ADR-742 §4), οι δύο από αυτές έγιναν **κειμενικά
 * ταυτόσημες** και το `jscpd` τις μέτρησε ως κλώνο **μέσα στο ίδιο diff** —
 * *η κεντρικοποίηση γεννάει τον κλώνο*, πέμπτη μετρημένη φορά στην εκστρατεία
 * (μάθημα #2). Η απάντηση είναι **πραγματική μείωση ευθύνης**, όχι χαλάρωση
 * του gate.
 *
 * ⚠️ Χρησιμοποιεί τον **υπάρχοντα** SSoT ({@link loadOwnedDocOrRefusal}) και
 * **όχι** δικό του αντίγραφο: ένας τοπικός φορτωτής θα ήταν ακριβώς το
 * «δίδυμο κεντρικοποιητή» που ο ίδιος ο SSoT υπάρχει για να αποτρέψει.
 *
 * 🔑 **Γιατί ΟΧΙ `createOwnershipDecision`**: η υπογραφή αυτής της υπηρεσίας
 * φέρει `companyId`, **όχι καλούντα** — δεν υπάρχει `globalRole` να κριθεί.
 * *Ρόλος που δεν υπάρχει στην υπογραφή δεν κρίνεται* (ADR-742 §7undecies.3):
 * κατασκευασμένος καλών θα έμοιαζε με απόφαση ενώ θα ήταν μαντεψιά. Άρα η
 * ετυμηγορία εδώ έχει **δύο** καταστάσεις — ποτέ `'cross-tenant-bypass'`.
 *
 * Επιστρέφει `null` και για τις δύο αρνήσεις (ανύπαρκτο **και** ξένο): αυτή
 * είναι η σιωπηλή πολιτική που το αρχείο είχε ήδη, και **δεν μαρτυρά ύπαρξη**.
 */
async function loadOwnedReport(
  companyId: string,
  reportId: string,
  action: string,
): Promise<OwnedDoc | null> {
  const outcome = await loadOwnedDocOrRefusal<null>({
    collection: COLLECTIONS.SAVED_REPORTS,
    docId: reportId,
    action,
    resourceLabel: 'Saved report',
    decide: (data) => (isPayloadOwnedByCompany(data, companyId) ? 'owned' : 'denied'),
    refusal: () => null,
  });

  return outcome.doc ?? null;
}

// ============================================================================
// CREATE
// ============================================================================

/** Create a new saved report */
export async function createSavedReport(
  companyId: string,
  userId: string,
  input: CreateSavedReportInput,
): Promise<SavedReport> {
  const db = getAdminFirestore();
  const id = idService.generateSavedReportId();
  const now = nowISO();

  const report: SavedReport = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    category: input.category ?? 'general',
    visibility: input.visibility ?? 'personal',
    createdBy: userId,
    favoritedBy: [],
    config: input.config,
    lastRunAt: null,
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .collection(COLLECTIONS.SAVED_REPORTS)
    .doc(id)
    .set({ ...report, companyId });

  return report;
}

// ============================================================================
// READ
// ============================================================================

/** Get a single saved report by ID */
export async function getSavedReport(
  companyId: string,
  reportId: string,
): Promise<SavedReport | null> {
  // 🔴 ADR-742 §4 — **η παγίδα του κενού**. Μέχρι τις 2026-08-01 η σύγκριση ήταν
  // σκέτο `!==`: αναφορά **χωρίς** μισθωτή (ή με κενό) και καλών με χαλασμένο
  // token **ταίριαζαν**. Το κενό δεν είναι μισθωτής, είναι **απουσία** μισθωτή.
  const doc = await loadOwnedReport(companyId, reportId, 'getSavedReport');
  if (doc === null) return null;

  return docToSavedReport(doc.data);
}

/** List saved reports for a user (respecting visibility rules) */
export async function listSavedReports(
  companyId: string,
  userId: string,
  options?: {
    visibility?: SavedReportVisibility;
    category?: string;
    limit?: number;
  },
): Promise<SavedReport[]> {
  const db = getAdminFirestore();
  const col = db.collection(COLLECTIONS.SAVED_REPORTS);

  // Base query: same company
  const snap = await col
    .where('companyId', '==', companyId)
    .orderBy('updatedAt', 'desc')
    .limit(options?.limit ?? 200)
    .get();

  const reports: SavedReport[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const report = docToSavedReport(data);

    // Visibility filter: personal reports only visible to owner
    if (report.visibility === 'personal' && report.createdBy !== userId) {
      continue;
    }

    // Optional category filter
    if (options?.category && report.category !== options.category) {
      continue;
    }

    // Optional visibility filter
    if (options?.visibility && report.visibility !== options.visibility) {
      continue;
    }

    reports.push(report);
  }

  return reports;
}

// ============================================================================
// UPDATE
// ============================================================================

/** Update a saved report (only owner or system reports by admin) */
export async function updateSavedReport(
  companyId: string,
  reportId: string,
  userId: string,
  input: UpdateSavedReportInput,
): Promise<SavedReport | null> {
  const doc = await loadOwnedReport(companyId, reportId, 'updateSavedReport');
  if (doc === null) return null;

  const { ref, data } = doc;
  if (data?.createdBy !== userId && data?.visibility !== 'system') return null;

  const updates: Record<string, unknown> = {
    updatedAt: nowISO(),
  };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() ?? null;
  if (input.category !== undefined) updates.category = input.category;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.config !== undefined) updates.config = input.config;

  await ref.update(updates);

  const updated = await ref.get();
  return docToSavedReport(updated.data());
}

/** Toggle favorite for a user */
export async function toggleFavorite(
  companyId: string,
  reportId: string,
  userId: string,
): Promise<boolean> {
  const doc = await loadOwnedReport(companyId, reportId, 'toggleFavorite');
  if (doc === null) return false;

  const { ref, data } = doc;
  const favoritedBy: string[] = data?.favoritedBy ?? [];
  const isFavorited = favoritedBy.includes(userId);

  if (isFavorited) {
    await ref.update({
      favoritedBy: favoritedBy.filter((id: string) => id !== userId),
    });
  } else {
    await ref.update({
      favoritedBy: [...favoritedBy, userId],
    });
  }

  return !isFavorited;
}

/** Track report execution (increment runCount, update lastRunAt) */
export async function trackReportRun(
  companyId: string,
  reportId: string,
): Promise<void> {
  const doc = await loadOwnedReport(companyId, reportId, 'trackReportRun');
  if (doc === null) return;

  const { ref, data } = doc;
  const currentCount = (data?.runCount as number) ?? 0;
  await ref.update({
    lastRunAt: nowISO(),
    runCount: currentCount + 1,
  });
}

// ============================================================================
// DELETE
// ============================================================================

/** Delete a saved report (only owner can delete personal, admin can delete shared) */
export async function deleteSavedReport(
  companyId: string,
  reportId: string,
  userId: string,
): Promise<boolean> {
  // ⚠️ Boy Scout: η άρνηση ιδιοκτησίας εδώ επέστρεφε `null as unknown as boolean`
  // — **ψέμα στον τύπο** (απαγορευμένο `as`, ενώ η υπογραφή υπόσχεται `boolean`).
  // Ο μόνος καλών ρωτά `if (!success)` και το test ζητούσε ρητά `toBeFalsy()`,
  // οπότε το `false` είναι **ισοδύναμο στη συμπεριφορά** και ειλικρινές στον τύπο.
  const doc = await loadOwnedReport(companyId, reportId, 'deleteSavedReport');
  if (doc === null) return false;

  const { ref, data } = doc;
  if (data?.visibility === 'system') return false; // System reports cannot be deleted
  if (data?.createdBy !== userId) return false; // Only owner can delete

  await ref.delete();
  return true;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert Firestore document data to SavedReport */
function docToSavedReport(
  data: FirebaseFirestore.DocumentData | undefined,
): SavedReport {
  return {
    id: data?.id ?? '',
    name: data?.name ?? '',
    description: data?.description ?? null,
    category: data?.category ?? 'general',
    visibility: data?.visibility ?? 'personal',
    createdBy: data?.createdBy ?? '',
    favoritedBy: data?.favoritedBy ?? [],
    config: data?.config ?? {
      domain: 'projects',
      columns: [],
      filters: [],
      sortField: null,
      sortDirection: 'asc',
      limit: 500,
      groupByConfig: null,
      dateRange: null,
    },
    lastRunAt: data?.lastRunAt ?? null,
    runCount: data?.runCount ?? 0,
    createdAt: data?.createdAt ?? '',
    updatedAt: data?.updatedAt ?? '',
  };
}
