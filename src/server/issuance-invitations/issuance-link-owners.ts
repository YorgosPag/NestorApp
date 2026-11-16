import 'server-only';

/**
 * @fileoverview ADR-915 §45.15 (1β-γ) — **οι ιδιοκτήτες στη σελίδα έγκρισης**: τι βλέπει ο υπεύθυνος (ονόματα · ΑΦΜ με
 *   μάσκα για τρίτους) και τι βεβαιώνει (το στιγμιότυπο της απόφασης).
 * @related issuance-link-view.ts (`quoteFacetsOf` — η όψη) · issuance-invitation-answer.ts (η απάντηση) ·
 *   lib/document-validity/issuance-owner-attestation.ts (ο κανόνας)
 * @module server/issuance-invitations/issuance-link-owners
 *
 * 🔑 **Ο ίδιος αναγνώστης για όψη και απάντηση**: ιδιοκτήτες = `label.ownerContactIds` του **ήδη** διαβασμένου μητρώου
 *    (§26 Ζ5)· ΑΦΜ = της επαφής **τώρα** (`readOwnedContactDocs` — ξένη επαφή ≡ ανύπαρκτη). Άρα «ίδιο σύνολο» σημαίνει
 *    «αυτό που είδε ο άνθρωπος».
 * 🔑 **Αποτυχία ⇒ `null`, ποτέ μαντεψιά**: η σελίδα τότε δεν ζητά τεκμήριο· η απάντηση με τεκμήριο ⇒ `unavailable`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  maskedVatTail,
  ownerAttestationOf,
  type IssuanceOwnerAttestation,
  type OwnerAttestationRefusal,
} from '@/lib/document-validity/issuance-owner-attestation';
import type { IssuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';
import { createModuleLogger } from '@/lib/telemetry';
import { extractContactVatNumber } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import type { IssuanceLinkOwnerVat, IssuanceLinkOwnerView } from '@/types/issuance-invitation';

import type { ResolvedLink } from './issuance-invitation-answer';

const logger = createModuleLogger('issuance-link-owners');

/** Ιδιοκτήτης → τρέχον ΑΦΜ (`null` = η επαφή δεν έχει). `null` όλο = δεν διαβάστηκαν τώρα. */
async function currentOwnerVats(db: Firestore, link: ResolvedLink): Promise<ReadonlyMap<string, string | null> | null> {
  const ids = [...new Set(link.label.ownerContactIds ?? [])];
  try {
    const docs = await readOwnedContactDocs(db, link.invitation.companyId, ids);
    return new Map(ids.map((id) => {
      const data = docs.get(id);
      return [id, data ? extractContactVatNumber(data) : null] as const;
    }));
  } catch (error) {
    logger.warn('Οι ιδιοκτήτες του συνδέσμου δεν διαβάστηκαν', { invitationId: link.invitation.id, error });
    return null;
  }
}

function vatViewOf(vat: string | null, self: boolean): IssuanceLinkOwnerVat {
  if (vat === null) return { kind: 'none' };
  return self ? { kind: 'full', value: vat } : { kind: 'masked', tail: maskedVatTail(vat) };
}

/** Η όψη: κάθε ιδιοκτήτης με όνομα (του μητρώου) και ΑΦΜ — ολόκληρο μόνο για τον ίδιο τον παραλήπτη. */
export async function linkOwnersOf(db: Firestore, link: ResolvedLink): Promise<readonly IssuanceLinkOwnerView[] | null> {
  const vats = await currentOwnerVats(db, link);
  if (vats === null) return null;
  return [...vats].map(([contactId, vat]) => {
    const self = contactId === link.invitation.contactId;
    return { contactId, name: link.registry.people[contactId]?.name ?? null, self, vat: vatViewOf(vat, self) };
  });
}

export type OwnerAttestationResolution =
  | { readonly kind: 'ok'; readonly attestation: IssuanceOwnerAttestation | null }
  | { readonly kind: 'refused'; readonly refusal: OwnerAttestationRefusal }
  | { readonly kind: 'unavailable' };

/**
 * Η απάντηση → το τεκμήριο, κριμένο απέναντι στους ιδιοκτήτες **τώρα**. Μόνο το `approve` κουβαλά τεκμήριο· απάντηση
 * χωρίς (`null`) περνά ως «δεν ζητήθηκε».
 */
export async function resolveOwnerAttestation(db: Firestore, link: ResolvedLink, answer: IssuanceLinkAnswerBody): Promise<OwnerAttestationResolution> {
  if (answer.answer !== 'approve' || answer.ownerAttestation === null) return { kind: 'ok', attestation: null };
  const vats = await currentOwnerVats(db, link);
  if (vats === null) return { kind: 'unavailable' };
  const attestation = ownerAttestationOf(answer.ownerAttestation, vats);
  return typeof attestation === 'string' ? { kind: 'refused', refusal: attestation } : { kind: 'ok', attestation };
}
