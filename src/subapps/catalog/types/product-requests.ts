/**
 * Τα **συμβόλαια** των αιτημάτων προϊόντων που μοιράζονται οθόνη και διακομιστής (ADR-923 §5.10.2 / §5.10.4).
 *
 * Ζούσαν μέσα σε αρχεία `server-only` (`product-writer.server.ts`, `completeness-recompute.server.ts`) ⇒ ο πελάτης
 * θα έπρεπε να τα **ξαναγράψει** — δεύτερη αλήθεια για το ίδιο σύρμα. Τώρα ορίζονται **μία** φορά, γενικά ως προς
 * τη μορφή της εγγραφής (αποθηκευμένη στον διακομιστή · σύρμα με ISO χρονοσφραγίδες στον πελάτη).
 *
 * @module subapps/catalog/types/product-requests
 */

import type { CatalogProductDefinition } from './product';

/** Μία γραμμή της δέσμης: `expectedRevision: null` = νέα παραλλαγή, αριθμός = CAS υπάρχουσας. */
export type VariantUpsert =
  | { readonly id: string | null; readonly expectedRevision: null; readonly definition: CatalogProductDefinition }
  | { readonly id: string; readonly expectedRevision: number; readonly definition: CatalogProductDefinition };

export interface VariantDelete {
  readonly id: string;
  readonly expectedRevision: number;
}

/** Η δέσμη `PUT …/product-models/[id]/variants` — όλες ή καμία (μία συναλλαγή). */
export interface VariantBatch {
  readonly upserts: readonly VariantUpsert[];
  readonly deletes: readonly VariantDelete[];
}

export interface VariantBatchResultOf<TModel, TProduct> {
  /** Η ρίζα μετά τη δέσμη (ευρετήριο, περίληψη «5/7», ευρήματα κανόνων). */
  readonly model: TModel;
  /** Οι παραλλαγές που γράφτηκαν, με τη σειρά της δέσμης (δημιουργίες με το id που πήραν). */
  readonly variants: readonly TProduct[];
}

/** Μία σελίδα της εργασίας επανυπολογισμού παραγώγων. */
export interface RecomputeRequest {
  readonly familyId: string | null;
  readonly cursor: string | null;
}

export interface RecomputeResult {
  readonly processed: number;
  readonly rejected: number;
  /** `null` = τέλος. */
  readonly nextCursor: string | null;
}
