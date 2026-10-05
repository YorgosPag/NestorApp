/**
 * Ο στόχος μιας πράξης κύκλου ζωής: ποιο έγγραφο, ποιας οντότητας, και αν ο καλών το δικαιούται.
 *
 * Βγήκε από το `soft-delete-engine.ts` όταν η μηχανή απέκτησε το αρχείο (ADR-329 §3.9): κάδος και
 * αρχείο ανοίγουν με την **ίδια** φόρτωση και τον **ίδιο** έλεγχο μισθωτή.
 *
 * @module lib/firestore/lifecycle-target
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import "server-only";

import { SOFT_DELETE_CONFIG } from "./soft-delete-config";
import type { SoftDeleteEntityConfig } from "./soft-delete-config";
// Imported from its defining module rather than through `ApiErrorHandler`,
// which re-exports it but pulls in the whole `next/server` surface with it.
import { ApiError } from "@/lib/api/api-error-types";
import { isPayloadOwnedByCompany } from "@/lib/auth/tenant-ownership";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

/** An entity resolved and cleared for a lifecycle operation. */
export interface LifecycleTarget {
  config: SoftDeleteEntityConfig;
  docRef: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData | undefined;
}

/**
 * Resolve the document a lifecycle operation is about, and enforce tenancy.
 *
 * All mutations open with the same steps — collection lookup, existence check,
 * tenant guard — differing only in whether a super admin may cross tenants.
 * That difference is a parameter here, not N transcriptions.
 *
 * @param isSuperAdmin Only `softDelete` passes this: its route-level guard has
 *                     already validated cross-tenant access. Restore, archive and
 *                     permanent-delete deliberately never bypass.
 * @throws ApiError(404) if the document does not exist
 * @throws ApiError(404) if it belongs to another company — **ίδιο** σφάλμα με το
 *   «δεν βρέθηκε» (ADR-742 §7.1)
 */
export async function loadLifecycleTarget(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  companyId: string,
  isSuperAdmin: boolean = false,
): Promise<LifecycleTarget> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  /**
   * 🔴 **ΕΝΑ** «δεν βρέθηκε» για **δύο** κλάδους (ADR-742 §7.1 · §7decies.4).
   *
   * Μέχρι τις 2026-08-01 η άρνηση ιδιοκτησίας εδώ ήταν
   * `403 'Unauthorized: {X} belongs to different company'` — μήνυμα που
   * **περιγράφει τον λόγο**, δηλαδή επιβεβαιώνει ότι το id υπάρχει. Ο engine
   * εξυπηρετεί **έξι** οντότητες, ανάμεσά τους `contact`, `project` και
   * `building`, που ήδη δηλώνονταν μεταμφιεσμένες: **μία** διαδρομή διαγραφής
   * ακύρωνε τη μεταμφίεση **και των τριών** πόρων, με κάθε άλλο test πράσινο
   * (§7septies: το μαντείο είναι ιδιότητα ΠΟΡΟΥ).
   *
   * Μηδέν ορίσματα ⇒ δεν υπάρχει τιμή που να ξεχωρίζει τους δύο κλάδους.
   */
  const notFound = (): ApiError => new ApiError(404, `${config.labelEn} not found`);

  if (!docSnap.exists) {
    throw notFound();
  }

  const data = docSnap.data();

  // ⚠️ Δηλωμένη αυστηροποίηση: πριν, ο έλεγχος ήταν
  // `data?.companyId && data.companyId !== companyId` ⇒ έγγραφο **χωρίς**
  // `companyId` περνούσε για **οποιονδήποτε**. Το κενό δεν είναι tenant, είναι
  // **απουσία** tenant (§4) — αυτολεξεί το σφάλμα που έκλεισε δύο φορές αλλού
  // (§7quinquies στο `rfq-service`, §7octies στο `bank-accounts-server`).
  if (!isSuperAdmin && !isPayloadOwnedByCompany(data, companyId)) {
    throw notFound();
  }

  return { config, docRef, data };
}

/** Το όνομα της εγγραφής όπως θα γραφτεί στη γραμμή ιστορικού. */
export function extractEntityName(
  data: FirebaseFirestore.DocumentData | undefined,
): string {
  if (!data) return "Unknown";
  return (
    data.name ??
    data.title ??
    (data.firstName
      ? `${data.firstName} ${data.lastName ?? ""}`.trim()
      : null) ??
    data.companyName ??
    data.number ??
    data.code ??
    "Unknown"
  );
}
