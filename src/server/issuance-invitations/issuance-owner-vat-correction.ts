import 'server-only';

/**
 * @fileoverview ADR-915 §45.15 (1β-γ-2) — **«Εφαρμογή στην επαφή»**: το γραφείο περνά στο CRM του τη διόρθωση ΑΦΜ που
 *   δήλωσε ο ιδιοκτήτης στη σελίδα έγκρισης (Salesforce staging: ό,τι έρχεται απ' έξω μπαίνει μόνο με απόφαση του κατόχου).
 * @related app/api/document-registry/issuance-assignments/owner-vat/route.ts (το σύνορο) ·
 *   lib/document-validity/issuance-owner-attestation.ts (`pendingVatCorrectionsOf` — η ίδια κρίση με την οθόνη) ·
 *   services/ai-pipeline/shared/contact-lookup-crud.ts (`updateContactField` — ο ΕΝΑΣ γραφέας πεδίου επαφής, ίχνος ADR-195)
 * @module server/issuance-invitations/issuance-owner-vat-correction
 *
 * 🔑 **Καμία ελεύθερη τιμή**: ο πελάτης λέει **ποια** διόρθωση είδε (`contactId` + ΑΦΜ)· γράφεται **μόνο** αν υπάρχει ακριβώς
 *    αυτή στο τεκμήριο της απόφασης. Το route δεν είναι «γράψε ΑΦΜ σε επαφή» — είναι «εφάρμοσε το τεκμήριο».
 * 🔑 **Ιδεμποτία εκ κατασκευής**: η επαφή έχει ήδη αυτό το ΑΦΜ ⇒ `unchanged`, καμία εγγραφή, κανένα ίχνος.
 * 🔑 **Ξένη επαφή ≡ ανύπαρκτη** (`readOwnedContactDocs`, ADR-742) — ο έλεγχος μισθωτή **πριν** από τον γραφέα.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { userPerformer } from '@/lib/audit/audit-performer';
import { pendingVatCorrectionsOf, sameVat } from '@/lib/document-validity/issuance-owner-attestation';
import { normalizeVat } from '@/lib/validation/greek-vat-number';
import { extractContactVatNumber } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { updateContactField } from '@/services/ai-pipeline/shared/contact-lookup-crud';
import { issuanceRecordOf } from '@/services/document-registry/issuance-assignment-schema';

import { readOwnAssignment } from './issuance-space-invite';

export interface OwnerVatCorrectionTarget {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly contactId: string;
  /** Το ΑΦΜ της διόρθωσης **όπως το είδε** το γραφείο (CAS απέναντι στο τεκμήριο). */
  readonly vatNumber: string;
}

/**
 * - `absent` — καμία ανάθεση του γραφείου για αυτό το (ακίνητο, είδος)·
 * - `no-correction` — το τεκμήριο δεν έχει (πια) αυτή τη διόρθωση για αυτή την επαφή·
 * - `contact-unavailable` — η επαφή δεν είναι (πια) του γραφείου.
 */
export type OwnerVatCorrectionRefusal = 'absent' | 'no-correction' | 'contact-unavailable';

export type OwnerVatCorrectionOutcome =
  | { readonly ok: true; readonly result: 'applied' | 'unchanged' }
  | { readonly ok: false; readonly refusal: OwnerVatCorrectionRefusal };

/** Η διόρθωση υπάρχει **ακριβώς** στο τεκμήριο της ανάθεσης; */
async function attestedCorrection(db: Firestore, companyId: string, target: OwnerVatCorrectionTarget): Promise<'absent' | 'no-correction' | 'found'> {
  const assignment = await readOwnAssignment(db, companyId, target.propertyId, target.documentKind);
  if (assignment === null) return 'absent';
  const attestation = issuanceRecordOf(assignment).decision?.ownerAttestation ?? null;
  // Ίδιο ερώτημα με την οθόνη: «διορθωμένο ΑΦΜ που διαφέρει από κάτι» — εδώ από οτιδήποτε (`null`), η επαφή κρίνεται μετά.
  const corrected = pendingVatCorrectionsOf(attestation, () => null);
  return corrected.some((entry) => entry.contactId === target.contactId && sameVat(entry.vatNumber, target.vatNumber)) ? 'found' : 'no-correction';
}

export async function applyOwnerVatCorrection(
  db: Firestore,
  actor: { readonly companyId: string; readonly uid: string },
  target: OwnerVatCorrectionTarget,
): Promise<OwnerVatCorrectionOutcome> {
  const attested = await attestedCorrection(db, actor.companyId, target);
  if (attested !== 'found') return { ok: false, refusal: attested };
  const contact = (await readOwnedContactDocs(db, actor.companyId, [target.contactId])).get(target.contactId);
  if (contact === undefined) return { ok: false, refusal: 'contact-unavailable' };
  if (sameVat(extractContactVatNumber(contact), target.vatNumber)) return { ok: true, result: 'unchanged' };
  await updateContactField(target.contactId, 'vatNumber', normalizeVat(target.vatNumber), userPerformer(actor.uid));
  return { ok: true, result: 'applied' };
}
