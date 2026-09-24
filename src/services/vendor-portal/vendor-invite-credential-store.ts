/**
 * =============================================================================
 * ΤΑ ΔΙΑΠΙΣΤΕΥΤΗΡΙΑ ΣΤΗ ΒΑΣΗ — ο ΜΟΝΟΣ αναγνώστης/γραφέας του `vendor_invite_credentials`
 * =============================================================================
 *
 * Η γραμματική του συνδέσμου ζει στο `./vendor-invite-credential` (χωρίς βάση)· εδώ ζουν
 * οι ερωτήσεις στη βάση: «ποιο έγγραφο είναι αυτό;», «ανακάλεσέ το», «ποιοι σύνδεσμοι υπάρχουν;».
 *
 * ⚠️ Κάθε ερώτημα ανά πρόσκληση ξεκινά από το `companyId` (φράχτης μισθωτή, CHECK 3.10/3.35) —
 * και **δεν** είναι παράμετρος που μπορεί να παραλειφθεί (ίδιο σκεπτικό με `listInvitesWhere`).
 *
 * @module services/vendor-portal/vendor-invite-credential-store
 * @enterprise ADR-876 §5
 */

import 'server-only';

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type {
  VendorInviteCredential,
  VendorInviteCredentialSummary,
} from '@/subapps/procurement/types/vendor-invite-credential';

import { credentialMatches, isCredentialExpired, parseVendorLink } from './vendor-invite-credential';

/** Το αποτέλεσμα της επαλήθευσης ενός συνδέσμου — κάθε άρνηση με το όνομά της. */
export type VendorCredentialCheck =
  | { readonly ok: true; readonly credential: VendorInviteCredential; readonly expired: boolean }
  | { readonly ok: false; readonly reason: 'invalid_link' | 'server_config_error' | 'link_not_found' }
  /** Αυθεντικός αλλά ανακλημένος — κουβαλά το έγγραφο ώστε ο αναλυτής να πει ΓΙΑΤΙ (ADR-876 §5 Σ21). */
  | { readonly ok: false; readonly reason: 'link_revoked'; readonly credential: VendorInviteCredential };

function credentialsOf(db: Firestore) {
  return db.collection(COLLECTIONS.VENDOR_INVITE_CREDENTIALS);
}

/**
 * **Σύνδεσμος → έκδοση.** Υπογραφή πρώτα (χωρίς βάση), μετά `get` με ID, μετά σύγκριση σε
 * σταθερό χρόνο. Ο ληγμένος σύνδεσμος **αναγνωρίζεται** (`expired: true`) — το αν γίνεται
 * δεκτός το αποφασίζει ο σκοπός, στον αναλυτή της πρόσκλησης.
 */
export async function checkVendorCredential(token: string, nowMs: number): Promise<VendorCredentialCheck> {
  const parsed = await parseVendorLink(token);
  if (!parsed.ok) return parsed;

  const snap = await credentialsOf(getAdminFirestore()).doc(parsed.credentialId).get();
  if (!snap.exists) return { ok: false, reason: 'link_not_found' };
  const credential = snap.data() as VendorInviteCredential;
  // Ίδια απάντηση με το «δεν βρέθηκε»: ο σύνδεσμος δεν μαθαίνει αν το ID του υπάρχει.
  if (!credentialMatches(credential, parsed.nonceHash)) return { ok: false, reason: 'link_not_found' };
  if (credential.revokedAt) return { ok: false, reason: 'link_revoked', credential };
  return { ok: true, credential, expired: isCredentialExpired(credential, nowMs) };
}

/** Σημείωσε ότι ο σύνδεσμος χρησιμοποιήθηκε — παρενέργεια, ποτέ φραγμός. */
export async function touchVendorCredential(credentialId: string, nowIso: string): Promise<void> {
  await credentialsOf(getAdminFirestore()).doc(credentialId).update({ lastUsedAt: nowIso });
}

function toSummary(c: VendorInviteCredential): VendorInviteCredentialSummary {
  return {
    id: c.id,
    issuedVia: c.issuedVia,
    issuedBy: c.issuedBy,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
    lastUsedAt: c.lastUsedAt,
    revokedAt: c.revokedAt,
  };
}

/** Οι σύνδεσμοι μιας πρόσκλησης, νεότεροι πρώτοι — **μεταδεδομένα**, ποτέ hash. */
export async function listVendorCredentials(
  companyId: string,
  inviteId: string,
): Promise<VendorInviteCredentialSummary[]> {
  const snap = await credentialsOf(getAdminFirestore())
    .where('companyId', '==', companyId)
    .where('inviteId', '==', inviteId)
    .get();
  return snap.docs
    .map((d) => toSummary(d.data() as VendorInviteCredential))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export interface RevokeCredentialInput {
  readonly companyId: string;
  readonly inviteId: string;
  readonly credentialId: string;
  readonly revokedBy: string;
  readonly nowIso: string;
}

/**
 * Ανάκληση **ενός** συνδέσμου. Ιδεμποτική: ήδη ανακλημένος ⇒ `already`.
 * Ξένος μισθωτής ή άλλη πρόσκληση ⇒ `not_found` (ποτέ «υπάρχει αλλά όχι δικός σου»).
 */
export async function revokeVendorCredential(
  input: RevokeCredentialInput,
): Promise<'revoked' | 'already' | 'not_found'> {
  const db = getAdminFirestore();
  const ref = credentialsOf(db).doc(input.credentialId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'not_found';
    const c = snap.data() as VendorInviteCredential;
    if (!isPayloadOwnedByCompany(c, input.companyId) || c.inviteId !== input.inviteId) return 'not_found';
    if (c.revokedAt) return 'already';
    tx.update(ref, { revokedAt: input.nowIso, revokedBy: input.revokedBy });
    return 'revoked';
  });
}

/**
 * **Διάβασε** τους ζωντανούς συνδέσμους μιας πρόσκλησης μέσα σε transaction. Χωριστό από την
 * εγγραφή, γιατί το Firestore απαιτεί όλες τις αναγνώσεις πριν από κάθε εγγραφή.
 */
export async function readLiveCredentialRefsTx(
  tx: Transaction,
  db: Firestore,
  companyId: string,
  inviteId: string,
) {
  const snap = await tx.get(
    credentialsOf(db).where('companyId', '==', companyId).where('inviteId', '==', inviteId),
  );
  return snap.docs.filter((d) => !(d.data() as VendorInviteCredential).revokedAt).map((d) => d.ref);
}
