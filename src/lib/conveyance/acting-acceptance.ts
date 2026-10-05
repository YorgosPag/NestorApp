/**
 * ADR-901 §15 (Γ1) — **τι στέλνει η οθόνη** στην αποδοχή, από ό,τι της είπε ο διακομιστής ότι θα γίνει.
 *
 * Η οθόνη **δεν αποφασίζει** χώρο: δείχνει την ετυμηγορία του `decideActingWorkspace` (`AcceptancePreview`) και
 * στέλνει **το πολύ ένα** αίτημα — μόνο όταν ο άνθρωπος έχει 2+ γραφεία και **διάλεξε**. Με 0 ή 1 γραφείο δεν
 * στέλνει τίποτα: ο διακομιστής ξανακρίνει τη στιγμή της αποδοχής (ο κόσμος μπορεί να άλλαξε στο μεταξύ).
 *
 * Καθαρό — κοινό για τον διάλογο «Αναλαμβάνω» και τη σελίδα της πρόσκλησης με email.
 *
 * @module lib/conveyance/acting-acceptance
 */

import type { ActingWorkspaceRequest } from '@/lib/auth/acting-workspace';
import type { AcceptancePreview, ActingForView } from '@/types/conveyance-case';

export type ActingChoice =
  /** `actingRequest` απόν ⇒ η οθόνη δεν ζητά χώρο (0 ή 1 γραφείο). */
  | { readonly ok: true; readonly actingRequest?: ActingWorkspaceRequest }
  /** `choice-missing`: 2+ γραφεία χωρίς επιλογή · `unknown`: τα γραφεία δεν ελέγχθηκαν — **καμία** αποστολή. */
  | { readonly ok: false; readonly reason: 'choice-missing' | 'unknown' };

/** Το αίτημα χώρου αυτής της αποδοχής — ή γιατί η αποδοχή δεν μπορεί ακόμη να σταλεί. */
export function actingChoiceOf(preview: AcceptancePreview, selectedCompanyId: string | null): ActingChoice {
  switch (preview.kind) {
    case 'office':
    case 'personal-provisional':
      return { ok: true };
    case 'choice-required':
      return preview.offices.some((office) => office.companyId === selectedCompanyId) && selectedCompanyId !== null
        ? { ok: true, actingRequest: { kind: 'org', companyId: selectedCompanyId } }
        : { ok: false, reason: 'choice-missing' };
    case 'unknown':
      return { ok: false, reason: 'unknown' };
  }
}

/**
 * Για ποιον **θα** ενεργεί η συμμετοχή μετά από αυτή την αποδοχή — για την αισιόδοξη κάρτα, μέχρι να έρθει η
 * αλήθεια του διακομιστή. `null` ⇒ δεν το ξέρουμε ακόμη (η κάρτα δεν υπόσχεται τίποτα).
 */
export function actingForAfterAccept(preview: AcceptancePreview | null, request: ActingWorkspaceRequest | undefined): ActingForView | null {
  if (preview === null) return null;
  if (preview.kind === 'office') return { kind: 'office', office: preview.office };
  if (preview.kind === 'personal-provisional') return { kind: 'personal' };
  if (preview.kind !== 'choice-required' || request?.kind !== 'org') return null;
  const office = preview.offices.find((candidate) => candidate.companyId === request.companyId);
  return office ? { kind: 'office', office } : null;
}
