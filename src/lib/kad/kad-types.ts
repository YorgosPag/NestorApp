/**
 * @fileoverview **Οι τύποι του καταλόγου ΚΑΔ 2025** (ΑΑΔΕ Α.1003/2026, Παράρτημα Ι — NACE Rev 2.1).
 * @related scripts/kad/build-kad-2025.mjs (ο γεννήτορας) · lib/kad/kad-catalog-shape.ts (ο αναγνώστης)
 * @module lib/kad/kad-types
 *
 * Φύλλο: καμία εξάρτηση, ούτε React. Μία αυθεντία για περιηγητή, διακομιστή και AI.
 */

/** Η έκδοση καταλόγου που γράφεται δίπλα σε κάθε **νέα** επιλογή ΚΑΔ. */
export const KAD_CATALOG_VERSION = 'KAD2025' as const;
export type KadCatalogVersion = typeof KAD_CATALOG_VERSION;

/** Η δημόσια διαδρομή του παράγωγου αρχείου (ένα byte για περιηγητή ΚΑΙ διακομιστή). */
export const KAD_CATALOG_PUBLIC_PATH = ['data', 'kad', 'kad-2025.json'] as const;
export const KAD_CATALOG_URL = `/${KAD_CATALOG_PUBLIC_PATH.join('/')}`;

/**
 * Το επίπεδο μιας γραμμής, από το ρηχότερο στο βαθύτερο. Η μορφή του κωδικού **είναι** το επίπεδο:
 * τομέας `Α` · κλάδος `NN` · ομάδα `NN.N` · τάξη `NN.NN` · κατηγορία CPA `NN.NN.N` ·
 * υποκατηγορία CPA `NN.NN.NN` · εθνική δραστηριότητα `NN.NN.NN.NN`.
 */
export const KAD_LEVELS = [
  'section',
  'division',
  'group',
  'class',
  'category',
  'subcategory',
  'national',
] as const;
export type KadLevel = (typeof KAD_LEVELS)[number];

/** Μία γραμμή του Παραρτήματος Ι. */
export interface KadCatalogEntry {
  /** Ο επίσημος κωδικός με τελείες (π.χ. `41.00.11`), ή το γράμμα του τομέα. */
  readonly code: string;
  /** Η μορφή ΓΕΜΗ/ΑΑΔΕ: 8 ψηφία, χωρίς τελείες, συμπληρωμένα δεξιά με `0`· `null` για τομέα. */
  readonly gemi: string | null;
  /** Η επίσημη περιγραφή, όπως στο ΦΕΚ (μικτή γραφή). */
  readonly description: string;
  readonly level: KadLevel;
  /** Ο κωδικός του γονέα (για κλάδο: ο τομέας)· `null` μόνο για τομέα. */
  readonly parent: string | null;
}

/** Η προέλευση του αρχείου, όπως τη γράφει ο γεννήτορας. */
export interface KadCatalogMeta {
  readonly source: string;
  readonly fek: string;
  readonly url: string;
  readonly sha256: string;
  readonly effectiveFrom: string;
  readonly generatedAt: string;
  readonly count: number;
}

/** Ο κατάλογος, φορτωμένος και ευρετηριασμένος. */
export interface KadCatalog {
  readonly meta: KadCatalogMeta | null;
  readonly entries: readonly KadCatalogEntry[];
  /** Κωδικός με τελείες → γραμμή. */
  readonly byCode: ReadonlyMap<string, KadCatalogEntry>;
  /** 8 ψηφία ΓΕΜΗ → η γραμμή που τους αντιστοιχεί, κατά τον κανόνα σύγκρουσης του `kad-resolve`. */
  readonly byGemi: ReadonlyMap<string, KadCatalogEntry>;
}

/** Ό,τι γράφεται σε αποθηκευμένη επιλογή ΚΑΔ από τον κατάλογο. */
export interface KadSelection {
  readonly code: string;
  readonly description: string;
  readonly catalog: KadCatalogVersion;
}
