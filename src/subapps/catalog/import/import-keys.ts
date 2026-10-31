/**
 * Τα **φυσικά κλειδιά** του αγωγού εισαγωγής (ADR-923 §5.5.1) — ίδιο μοτίβο με το `pricing/pricing-keys.ts`: η ταυτότητα
 * παράγεται από το κλειδί (`byCode`), άρα ίδια είσοδος ⇒ ίδιο έγγραφο **δομικά**, χωρίς ερώτημα «υπάρχει ήδη;» με race.
 *
 * | Κλειδί | Τι σημαίνει |
 * |---|---|
 * | παρτίδα | ίδιο αρχείο + ίδιος στόχος + ίδια **έκδοση** προφίλ + ίδιο **εύρος σελίδων** + ίδια επανεκτέλεση ⇒ ίδια παρτίδα |
 * | πρόταση | παρτίδα + σύνολο ⇒ η επανάληψη ανάγνωσης μιας σελίδας ξαναγράφει την ίδια πρόταση |
 *
 * Το προφίλ μπαίνει **με την αναθεώρησή του**: ίδιο αρχείο με διορθωμένο προφίλ είναι **νέα** εκτέλεση, αλλιώς δεν θα
 * μπορούσε ποτέ να ξαναπεράσει. Το ίδιο και το εύρος σελίδων: άλλο κεφάλαιο του ίδιου PDF είναι άλλη δουλειά, αλλιώς θα
 * ξανάνοιγε η παλιά παρτίδα και το νέο εύρος θα αγνοούνταν σιωπηλά.
 * @module subapps/catalog/import/import-keys
 */

import type { ImportBatchTarget } from '../types/catalog-import';

const SEPARATOR = '|';

function targetKeyOf(target: ImportBatchTarget): string {
  return target.purpose === 'priceLines'
    ? `prices:${target.priceListVersionId}`
    : `attrs:${target.familyId}:${target.variantSchemeCode ?? ''}`;
}

export interface ImportBatchKeyInput {
  readonly contentSha256: string;
  readonly target: ImportBatchTarget;
  readonly profileId: string | null;
  readonly profileRevision: number | null;
  readonly pageRange: { readonly from: number; readonly to: number } | null;
  readonly run: number;
}

export function importBatchKey(input: ImportBatchKeyInput): string {
  const profile = input.profileId === null ? 'none' : `${input.profileId}@${input.profileRevision ?? 0}`;
  const pages = input.pageRange === null ? 'all' : `${input.pageRange.from}-${input.pageRange.to}`;
  return [input.contentSha256, targetKeyOf(input.target), profile, pages, String(input.run)].join(SEPARATOR);
}

export function importProposalKey(batchId: string, groupKey: string): string {
  return `${batchId}${SEPARATOR}${groupKey}`;
}
