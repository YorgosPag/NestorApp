/**
 * @fileoverview ADR-915 §45.15 (1β-γ) — **το πρόχειρο των ιδιοκτητών** στη σελίδα έγκρισης και η μετάφρασή του στην
 *   κρίση που φεύγει με το `approve`. Καθαρό (χωρίς React) — ώστε να ελέγχεται μόνο του.
 * @related DocumentRequestCard.tsx · DocumentRequestOwners.tsx · lib/document-validity/issuance-owner-attestation.ts
 * @module app/(auth)/document-request/document-request-owners-draft
 */

import type { OwnerAttestationAnswer, OwnerVerdict } from '@/lib/document-validity/issuance-owner-attestation';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import type { IssuanceLinkOwnerView } from '@/types/issuance-invitation';

export interface OwnerDraft {
  readonly verdict: OwnerVerdict | null;
  readonly vatNumber: string;
}

export interface OwnersDraft {
  readonly byId: Readonly<Record<string, OwnerDraft>>;
  readonly missingNote: string;
}

export const EMPTY_OWNER_DRAFT: OwnerDraft = { verdict: null, vatNumber: '' };

export function emptyOwnersDraft(): OwnersDraft {
  return { byId: {}, missingNote: '' };
}

/**
 * Το πρόχειρο → η κρίση που φεύγει με το `approve`. `null` = **λείπει** κρίση ή ΑΦΜ είναι άκυρο (το «Εγκρίνω» μένει
 * ανενεργό)· `'none'` = η σελίδα δεν έδειξε ιδιοκτήτες, άρα δεν ζητείται τεκμήριο.
 */
export function ownerAttestationFromDraft(owners: readonly IssuanceLinkOwnerView[] | null, draft: OwnersDraft): OwnerAttestationAnswer | 'none' | null {
  if (owners === null || owners.length === 0) return 'none';
  const answered: OwnerAttestationAnswer['owners'][number][] = [];
  for (const owner of owners) {
    const entry = draft.byId[owner.contactId] ?? EMPTY_OWNER_DRAFT;
    if (entry.verdict === null) return null;
    if (entry.verdict === 'corrected' && !isValidGreekVat(entry.vatNumber)) return null;
    answered.push({ contactId: owner.contactId, verdict: entry.verdict, vatNumber: entry.verdict === 'corrected' ? entry.vatNumber.trim() : null });
  }
  return { owners: answered, missingNote: draft.missingNote.trim() || null };
}
