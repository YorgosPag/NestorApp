/**
 * @fileoverview **Ο ΕΝΑΣ αναγνώστης του δεσμού «χώρος ↔ επαφή»** από ήδη διαβασμένο έγγραφο χώρου (ADR-951).
 * @module lib/company/self-contact-ref
 *
 * Καθαρή συνάρτηση — την καλούν ο γραφέας (μέσα σε συναλλαγή), ο resolver βιτρίνας και ο browser. Μισό ή άκυρο
 * σχήμα ⇒ `null` (ποτέ «μισός» δεσμός), όπως το `brandLogoOf`.
 */

import type { WorkspaceSelfContact } from '@/types/company-self-contact';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** Το πεδίο του εγγράφου `companies/{companyId}` — ΕΝΑ όνομα, εδώ. */
export const SELF_CONTACT_FIELD = 'selfContact';

export function selfContactOf(companyData: Record<string, unknown> | undefined): WorkspaceSelfContact | null {
  const raw = companyData?.[SELF_CONTACT_FIELD];
  if (typeof raw !== 'object' || raw === null) return null;
  const { contactId, linkedAt, linkedBy } = raw as Record<string, unknown>;
  if (!isNonEmptyString(contactId) || !isNonEmptyString(linkedAt) || !isNonEmptyString(linkedBy)) return null;
  return { contactId, linkedAt, linkedBy };
}

/** «Είναι αυτή η επαφή ο χώρος;» — η μία κρίση για κάθε όψη (λίστα · κεφαλίδα · βιτρίνα). */
export function isWorkspaceSelfContact(contactId: string, selfContact: WorkspaceSelfContact | null): boolean {
  return selfContact !== null && selfContact.contactId === contactId;
}
