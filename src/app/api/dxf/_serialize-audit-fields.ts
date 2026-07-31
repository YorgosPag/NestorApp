/**
 * =============================================================================
 * Τα έξι πεδία λογιστικού ελέγχου, σε μορφή σύρματος — μία φορά
 * =============================================================================
 *
 * Κάθε έγγραφο του DXF domain κουβαλά την ίδια εξάδα denormalized πεδίων
 * (`createdAt/updatedAt/createdBy/createdByName/updatedBy/updatedByName`) και
 * κάθε serializer έκανε την ίδια μετατροπή: admin-SDK `Timestamp` → ISO string.
 * Γραμμένη χωριστά σε κάθε route, μια αλλαγή μορφής χρόνου θα εφαρμοζόταν
 * **στα μισά** — και η απόκλιση θα φαινόταν μόνο σε όποιον σύγκρινε δύο
 * απαντήσεις δίπλα-δίπλα.
 *
 * ⚠️ Δεν δηλώνει `Timestamp` του `firebase-admin`: ζητά **μόνο** `toDate()`.
 * Έτσι το module μένει καθαρό από SDK και δουλεύει με ό,τι έχει τη μέθοδο.
 *
 * @module api/dxf/_serialize-audit-fields
 */

/** Ό,τι ξέρει να γίνει `Date` — το ελάχιστο που χρειάζεται η μετατροπή. */
interface HasToDate {
  toDate(): Date;
}

/** Η εξάδα όπως ζει στο έγγραφο. */
export interface AuditedDoc {
  readonly createdAt: HasToDate;
  readonly updatedAt: HasToDate;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

/** Η εξάδα όπως φεύγει στο σύρμα — χρόνοι σε ISO strings. */
export interface SerializedAuditFields {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

export function serializeAuditFields(doc: AuditedDoc): SerializedAuditFields {
  return {
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    updatedBy: doc.updatedBy,
    updatedByName: doc.updatedByName,
  };
}
