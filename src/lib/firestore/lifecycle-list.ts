/**
 * Η ανάγνωση του κάδου και του αρχείου — οι **ίδιες** γραμμές σε δύο καταστάσεις.
 *
 * Βγήκε από το `soft-delete-engine.ts` για το όριο μεγέθους αρχείου· η μηχανή το ξαναεξάγει,
 * ώστε να μένει η μία πόρτα του κύκλου ζωής (ADR-281: «ένας μηχανισμός»).
 *
 * @module lib/firestore/lifecycle-list
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-697 — Trash-List Route SSoT
 */

import "server-only";

import { SOFT_DELETE_CONFIG } from "./soft-delete-config";
import { ARCHIVE, TRASH, type Retirement } from "./lifecycle-retirements";
import { FIELDS } from "@/config/firestore-field-constants";
import { compareStrings } from "@/lib/array-utils";
// Imported from its defining module rather than through `ApiErrorHandler`,
// which re-exports it but pulls in the whole `next/server` surface with it.
import { ApiError } from "@/lib/api/api-error-types";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

/**
 * Row as the trash endpoints have always emitted it: the raw document, with its
 * id folded in. Deliberately open-ended — the bin renders whatever the entity
 * happens to carry and no endpoint has ever projected a subset.
 */
export type TrashedEntityRow = FirebaseFirestore.DocumentData & { id: string };

/**
 * Οι γραμμές μιας οντότητας σε **μία** κατάσταση απόσυρσης, για μία εταιρεία.
 *
 * Ordering is applied in memory rather than via `orderBy` on purpose — a
 * composite `companyId + status + name` index does not exist, and adding
 * `orderBy` to the query would make every bin start throwing
 * `FAILED_PRECONDITION` until the index is deployed.
 */
async function listRetired(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  companyId: string,
  retirement: Retirement,
): Promise<TrashedEntityRow[]> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const trashList = config.trashList;

  if (!trashList) {
    throw new ApiError(500, `${config.labelEn} does not publish a ${retirement.place} list`);
  }

  const snapshot = await db
    .collection(config.collection)
    .where(FIELDS.COMPANY_ID, "==", companyId)
    .where(FIELDS.STATUS, "==", retirement.status)
    .get();

  // Deterministic, NOT locale-aware. This module is `server-only`, so there is no
  // active UI language here to collate against: `compareByLocale` resolves
  // through the i18n instance, which on the server always answers with the
  // fallback regardless of who is asking — locale-aware in name only, while
  // dragging the i18n surface into a server module. A bare `localeCompare()` was
  // worse still: it sorted by the SERVER's ambient locale, so the same trash list
  // could come back in a different order after a host change. Presentation-order
  // by language belongs to the client that renders the rows.
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => compareStrings(readSortKey(a, trashList.sortField), readSortKey(b, trashList.sortField)));
}

/**
 * List an entity's trashed rows for one company.
 *
 * @param db         Admin Firestore instance
 * @param entityType Soft-deletable entity; must publish a trash-list contract
 * @param companyId  Effective company, already resolved via `resolveTenantScope`
 * @throws ApiError(500) if the entity publishes no trash-list contract
 */
export async function listTrashed(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  companyId: string,
): Promise<TrashedEntityRow[]> {
  return listRetired(db, entityType, companyId, TRASH);
}

/**
 * List an entity's archived rows for one company — ίδιες γραμμές, άλλη κατάσταση.
 *
 * @throws ApiError(500) αν η οντότητα δεν έχει αρχείο ή δεν δημοσιεύει λίστα
 */
export async function listArchived(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  companyId: string,
): Promise<TrashedEntityRow[]> {
  const config = SOFT_DELETE_CONFIG[entityType];

  if (!config.archive) {
    throw new ApiError(500, `${config.labelEn} does not publish an archive list`);
  }

  return listRetired(db, entityType, companyId, ARCHIVE);
}

/**
 * Sort key for one row: the configured field when it is a string, otherwise the
 * empty string. Rows missing the field sort first — the behaviour every trash
 * route shipped, preserved rather than improved.
 */
function readSortKey(row: FirebaseFirestore.DocumentData, field: string): string {
  const value: unknown = row[field];
  return typeof value === "string" ? value : "";
}
