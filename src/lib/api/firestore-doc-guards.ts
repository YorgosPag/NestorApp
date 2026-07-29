/**
 * ADR-245 — δύο ερωτήματα που ήταν ξαναγραμμένα σε **επτά** σημεία μέσα στα
 * `construction-*` routes:
 *
 *   1. «φέρε το έγγραφο· 404 αν λείπει, 403 αν ανήκει σε άλλο κτήριο»
 *   2. «κράτα μόνο τα επιτρεπτά πεδία της ενημέρωσης· 400 αν δεν μένει κανένα»
 *
 * Το (1) **δεν είναι καλλωπισμός**: η σειρά «404 πριν από 403» είναι συμβόλαιο
 * ασφαλείας. Αντεστραμμένη, ένας χρήστης άλλου tenant μαθαίνει ότι το id υπάρχει
 * — διαρροή ύπαρξης. Γραμμένη επτά φορές, αρκεί μία αντιγραφή με λάθος σειρά.
 *
 * @module lib/api/firestore-doc-guards
 */

import { FieldValue } from 'firebase-admin/firestore';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AdminFirestore } from '@/lib/api/building-scoped-route';

type CollectionOf = ReturnType<AdminFirestore['collection']>;
type DocumentRefOf = ReturnType<CollectionOf['doc']>;

export interface OwnedDocument {
  readonly ref: DocumentRefOf;
  readonly data: Record<string, unknown>;
}

export interface RequireDocOfBuildingParams {
  readonly adminDb: AdminFirestore;
  readonly collection: string;
  readonly id: string;
  readonly buildingId: string;
  /** Πώς λέγεται η οντότητα στο 404 (π.χ. `'Baseline'`, `'Assignment'`, `'task'`). */
  readonly label: string;
  /** Πώς λέγεται στο 403, αν διαφέρει (τα phases λένε γενικά `'Document'`). */
  readonly ownerLabel?: string;
}

/** Φέρνει το έγγραφο και επιβεβαιώνει ότι ανήκει στο κτήριο — 404 πριν από 403. */
export async function requireDocOfBuilding(
  params: RequireDocOfBuildingParams,
): Promise<OwnedDocument> {
  const { adminDb, collection, id, buildingId, label, ownerLabel } = params;

  const ref = adminDb.collection(collection).doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) throw new ApiError(404, `${label} not found`);

  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  if (data.buildingId !== buildingId) {
    throw new ApiError(403, `${ownerLabel ?? label} does not belong to this building`);
  }

  return { ref, data };
}

/**
 * Φιλτράρει την ενημέρωση με λευκή λίστα και σφραγίζει `updatedAt`/`updatedBy`.
 *
 * Η λευκή λίστα είναι ο λόγος ύπαρξης: χωρίς αυτήν ένα PATCH μπορεί να γράψει
 * `companyId` ή `buildingId` και να μετακινήσει το έγγραφο σε άλλον tenant.
 */
export function buildAllowedUpdates(
  updates: Record<string, unknown>,
  allowedFields: readonly string[],
  updatedBy: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      clean[key] = value;
    }
  }

  if (Object.keys(clean).length === 0) throw new ApiError(400, 'No valid fields to update');

  clean.updatedAt = FieldValue.serverTimestamp();
  clean.updatedBy = updatedBy;
  return clean;
}
