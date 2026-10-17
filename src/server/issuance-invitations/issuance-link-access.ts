import 'server-only';

/**
 * @fileoverview ADR-915 §29 — **η πύλη του κωδικού** για τον σύνδεσμο ανάθεσης: τι ζητά ο σύνδεσμος, τι απέδειξε ο
 *   κάτοχος, και τι βλέπει πριν τον κωδικό.
 * @related server/invitations/invitation-access-code.ts (ο γενικός πυρήνας) · issuance-invitation-answer.ts (ο καλών) ·
 *   lib/document-validity/issuance-assignment.ts (ο μειωτής, η αυθεντία: `linkVerificationSatisfies`)
 * @module server/issuance-invitations/issuance-link-access
 *
 * 🔑 **Δύο φραγμοί, ένας κριτής**: εδώ κρίνεται ο κωδικός και καταναλώνεται η προσπάθεια· ο **μειωτής** ξανακρίνει ότι ό,τι
 *    αποδείχθηκε (`verifiedBy`) καλύπτει ό,τι ζήτησε το αίτημα. Μια πόρτα που θα ξεχνούσε αυτό το αρχείο δεν περνά.
 * 🔑 **Καμία «ξεκλείδωτη συνεδρία»**: κάθε πράξη φέρνει τον κωδικό ξανά. Κανένα cookie, καμία κατάσταση στον server που
 *    θα μπορούσε να κλαπεί ή να μείνει ανοιχτή.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { LinkVerification } from '@/lib/document-validity/issuance-assignment';
import { ACCESS_CODE_MAX_FAILURES, normaliseAccessCode, stageAccessCodeAttempt } from '@/server/invitations/invitation-access-code';
import type { IssuanceInvitation, IssuanceLinkGateView } from '@/types/issuance-invitation';

import { ISSUANCE_INVITE_SECRET_ENV, isIssuanceLinkLocked, issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';

export type AccessCodeRefusal = 'code-required' | 'code-wrong' | 'code-locked';

export type IssuanceAccessCheck =
  | { readonly ok: true; readonly verifiedBy: LinkVerification }
  /** `remaining` = προσπάθειες που μένουν (η σελίδα τις λέει)· `lockedNow` = **αυτή** η προσπάθεια κλείδωσε. */
  | { readonly ok: false; readonly refusal: AccessCodeRefusal; readonly remaining: number; readonly lockedNow: boolean };

function attemptsLeft(invitation: IssuanceInvitation): number {
  const code = invitation.accessCode;
  return code === null || code.lockedAt !== null ? 0 : ACCESS_CODE_MAX_FAILURES - code.failures;
}

/**
 * **Η κρίση του κωδικού.** Χωρίς κωδικό στον σύνδεσμο ⇒ `link` (§28). Κωδικός που λείπει ⇒ `code-required` **χωρίς** να
 * χρεωθεί προσπάθεια. Αλλιώς μία προσπάθεια, σε συναλλαγή (`stageAccessCodeAttempt`).
 */
export async function checkIssuanceAccessCode(db: Firestore, invitation: IssuanceInvitation, attempt: string | null, nowIso: string): Promise<IssuanceAccessCheck> {
  if (invitation.accessCode === null) return { ok: true, verifiedBy: 'link' };
  if (isIssuanceLinkLocked(invitation)) return { ok: false, refusal: 'code-locked', remaining: 0, lockedNow: false };
  if (attempt === null || normaliseAccessCode(attempt) === '') {
    return { ok: false, refusal: 'code-required', remaining: attemptsLeft(invitation), lockedNow: false };
  }
  const ref = issuanceInvitationsCollection(db).doc(invitation.id);
  const result = await db.runTransaction((tx) => stageAccessCodeAttempt(tx, ref, {
    secretEnv: ISSUANCE_INVITE_SECRET_ENV,
    invitationId: invitation.id,
    attempt,
    nowIso,
    readStored: (raw) => parseIssuanceInvitation(raw, invitation.id)?.accessCode ?? null,
  }));
  if (result.kind === 'ok') return { ok: true, verifiedBy: 'access-code' };
  if (result.kind === 'wrong') return { ok: false, refusal: 'code-wrong', remaining: result.remaining, lockedNow: false };
  return { ok: false, refusal: 'code-locked', remaining: 0, lockedNow: result.lockedNow };
}

/** **Ό,τι φαίνεται πριν τον κωδικό** — σε ποιον απευθύνεται και ποιο γραφείο· τίποτα για ακίνητο, έγγραφο ή επαγγελματία. */
export function issuanceGateViewOf(invitation: IssuanceInvitation, recipientName: string | null, officeName: string | null): IssuanceLinkGateView {
  return { audience: invitation.audience, recipientName, officeName, attemptsLeft: attemptsLeft(invitation) };
}
