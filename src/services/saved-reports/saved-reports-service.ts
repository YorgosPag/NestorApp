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
import { EnterpriseIdService } from '@/services/enterprise-id.service';
import type {
  SavedReport,
  CreateSavedReportInput,
  UpdateSavedReportInput,
  SavedReportVisibility,
} from '@/types/reports/saved-report';

const idService = new EnterpriseIdService();

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
  const now = new Date().toISOString();

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
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.SAVED_REPORTS)
    .doc(reportId)
    .get();

  if (!snap.exists) return null;

  const data = snap.data();
  if (data?.companyId !== companyId) return null;

  return docToSavedReport(data);
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
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SAVED_REPORTS).doc(reportId);
  const snap = await ref.get();

  if (!snap.exists) return null;

  const data = snap.data();
  if (data?.companyId !== companyId) return null;
  if (data.createdBy !== userId && data.visibility !== 'system') return null;

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
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
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SAVED_REPORTS).doc(reportId);
  const snap = await ref.get();

  if (!snap.exists) return false;

  const data = snap.data();
  if (data?.companyId !== companyId) return false;

  const favoritedBy: string[] = data.favoritedBy ?? [];
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
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SAVED_REPORTS).doc(reportId);
  const snap = await ref.get();

  if (!snap.exists) return;
  if (snap.data()?.companyId !== companyId) return;

  const currentCount = (snap.data()?.runCount as number) ?? 0;
  await ref.update({
    lastRunAt: new Date().toISOString(),
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
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SAVED_REPORTS).doc(reportId);
  const snap = await ref.get();

  if (!snap.exists) return false;

  const data = snap.data();
  if (data?.companyId !== companyId) return null as unknown as boolean;
  if (data.visibility === 'system') return false; // System reports cannot be deleted
  if (data.createdBy !== userId) return false; // Only owner can delete

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
