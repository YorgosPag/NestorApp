'use client';

/**
 * @fileoverview **Το πρόχειρο ενός επεξεργαστή του καταλόγου** — ένας μηχανισμός για ιδιότητα, οικογένεια μέτρησης και
 *   οικογένεια προϊόντων (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/use-definition-draft
 *
 * 🔑 Λεπτός καταναλωτής του γενικού `useRevisionedDraft` (ADR-928 Φ3γ: ο ίδιος πυρήνας τρέχει και τον επεξεργαστή
 *    συμφωνητικού). Ο κατάλογος κρατά την πολιτική **`reset`** στο 409: επαναφορά στη **νεότερη** βάση, με ειδοποίηση
 *    από τον καλούντα — καμία αλλαγή συμπεριφοράς για τους επεξεργαστές του.
 */

import { useRevisionedDraft, useShownDraftIssues, type RevisionedDraft } from '@/hooks/drafts/useRevisionedDraft';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';

export type { DraftStatus } from '@/hooks/drafts/useRevisionedDraft';

export type DefinitionDraft<D> = RevisionedDraft<D, CatalogIssue>;

/** Ανέγγιχτη φόρμα δεν «κοκκινίζει» — η ΜΙΑ απόφαση για κάθε επεξεργαστή του καταλόγου. */
export function useShownIssues(
  editor: Pick<DefinitionDraft<unknown>, 'dirty' | 'serverIssues'>,
  clientIssues: readonly CatalogIssue[],
  immediate?: (issue: CatalogIssue) => boolean,
): readonly CatalogIssue[] {
  return useShownDraftIssues(editor, clientIssues, immediate);
}

/**
 * `identity` = ποια οντότητα επεξεργάζεται (id ή `new`): αλλαγή ⇒ νέο πρόχειρο από τη βάση.
 * `revision` = η αναθεώρηση της βάσης (`null` για νέα οντότητα).
 */
export function useDefinitionDraft<D>(base: D, identity: string, revision: number | null = null): DefinitionDraft<D> {
  return useRevisionedDraft<D, CatalogIssue>(base, identity, revision, 'reset');
}
