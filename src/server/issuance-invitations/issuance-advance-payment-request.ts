import 'server-only';

/**
 * @fileoverview ADR-943 Φ5β2 (§8 #11) — **«Αίτημα πληρωμής / Νέος σύνδεσμος» από το γραφείο**: νέος σύνδεσμος προκαταβολής
 *   στον ιδιοκτήτη της απόφασης, με ένα πάτημα — π.χ. η έγκριση καταγράφηκε από το γραφείο (`recorded-instruction`, χωρίς
 *   σύνδεσμο ιδιοκτήτη) ή ο ιδιοκτήτης έχασε/άφησε να λήξει το email.
 * @related issuance-advance-link.ts (ο ΕΝΑΣ εκδότης) · api/document-registry/issuance-assignments/advance-link (η πόρτα)
 * @module server/issuance-invitations/issuance-advance-payment-request
 *
 * 🏆 Stripe «Send invoice / resend»: κάθε αποστολή = έγκυρος σύνδεσμος. Το γραφείο στέλνει **μόνο** όταν ο ιδιοκτήτης έχει
 *    κάτι να κάνει στη σελίδα: να **πληρώσει** (`awaiting-payment`) ή να **φέρει αντίρρηση** (`release-pending`).
 * 🔑 §29 — `requireAccessCode` ⇒ νέος κωδικός, **μία** φορά στην απάντηση (το γραφείο τον λέει τηλεφωνικά)· από εκεί και
 *    πέρα αυτός είναι ο κωδικός του φακέλου και για τα αυτόματα email.
 * ⛔ Ποτέ αυτόματη αποστολή: εκτελεί μόνο ό,τι πάτησε άνθρωπος (§18.5).
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { advanceStateOf } from '@/lib/document-validity/issuance-advance';
import { issuanceStateOf } from '@/lib/document-validity/issuance-assignment';
import { readHostedIssuanceContext } from '@/services/document-registry/issuance-advance-payment.server';
import { issuanceAssignmentIdOf, issuanceRecordOf } from '@/services/document-registry/issuance-assignment-schema';
import type { AdvanceLinkMoment } from '@/services/email-templates/issuance-advance-link-email-texts';

import { issueAdvanceLink, type AdvanceLinkRefusal, type AdvanceLinkResult } from './issuance-advance-link';

export interface AdvanceLinkOfficeRequest {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly requireAccessCode: boolean;
}

/** `absent` καμία ανάθεση · `not-accepted` όχι ανοιχτή αναληφθείσα · `nothing-to-do` ο ιδιοκτήτης δεν έχει τι να κάνει τώρα. */
export type AdvancePaymentRequestRefusal = 'absent' | 'not-accepted' | 'nothing-to-do' | AdvanceLinkRefusal;

/** Τι λέει το email — από την κατάσταση των χρημάτων **τώρα**· `null` ⇒ τίποτα να ζητηθεί από τον ιδιοκτήτη. */
function momentOf(kind: ReturnType<typeof advanceStateOf>['kind']): AdvanceLinkMoment | null {
  if (kind === 'awaiting-payment') return 'payment-request';
  return kind === 'release-pending' ? 'work-started' : null;
}

/** **Το αίτημα πληρωμής του γραφείου** — βλ. κεφαλίδα. */
export async function requestAdvancePaymentFromOffice(
  db: Firestore, sender: { readonly companyId: string; readonly uid: string }, request: AdvanceLinkOfficeRequest, now: Date,
): Promise<AdvanceLinkResult | { readonly ok: false; readonly refusal: AdvancePaymentRequestRefusal }> {
  const assignmentId = issuanceAssignmentIdOf(sender.companyId, request.propertyId, request.documentKind);
  const context = await readHostedIssuanceContext(db, sender.companyId, assignmentId, now);
  if (context === 'unknown') return { ok: false, refusal: 'unavailable' };
  if (context === null) return { ok: false, refusal: 'absent' };
  const record = issuanceRecordOf(context.assignment);
  const state = issuanceStateOf(record, context.latestIssuedOn);
  if (state.kind !== 'open' || state.stage !== 'accepted') return { ok: false, refusal: 'not-accepted' };
  const moment = momentOf(advanceStateOf(record).kind);
  if (moment === null) return { ok: false, refusal: 'nothing-to-do' };
  return issueAdvanceLink(db, { context, record, moment, actorUid: sender.uid, requireAccessCode: request.requireAccessCode, now });
}
