/**
 * Συγκαταθέσεις χρήστη → MCP client (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ Η ΣΥΓΚΑΤΑΘΕΣΗ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΗ ΟΝΤΟΤΗΤΑ ΚΑΙ ΟΧΙ ΠΕΔΙΟ ΤΟΥ TOKEN
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα tokens είναι εφήμερα και πολλαπλά: κάθε ανανέωση φτιάχνει καινούργια. Αν η
 * συγκατάθεση ζούσε μέσα τους, η ερώτηση «σε ποιους πράκτορες έχω δώσει
 * πρόσβαση;» θα απαντιόταν με σάρωση tokens — δηλαδή θα έδειχνε **αλυσίδες
 * ανανέωσης**, όχι αποφάσεις. Και η ανάκληση θα σήμαινε «σκότωσε ό,τι βρεις
 * τώρα», αφήνοντας την επόμενη ανανέωση να ξαναγεννήσει πρόσβαση.
 *
 * Η συγκατάθεση είναι **η απόφαση του ανθρώπου**: ένα έγγραφο ανά (χρήστης,
 * client, resource), που επιβιώνει των tokens και είναι αυτό που ο χρήστης
 * βλέπει και ανακαλεί. Τα tokens δείχνουν σε αυτήν.
 *
 * @module lib/oauth/oauth-consent-store
 * @see ADR-738 §6
 */

import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOAuthConsentId } from '@/services/enterprise-id.service';
import type { OAuthScope } from './oauth-config';

export interface ConsentRecord {
  readonly consentId: string;
  readonly uid: string;
  readonly companyId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly scopes: readonly OAuthScope[];
  readonly audience: string;
  readonly createdAt: number;
  readonly revokedAt: number | null;
}

export interface ConsentInput {
  readonly uid: string;
  readonly companyId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly scopes: readonly OAuthScope[];
  readonly audience: string;
}

function toConsent(id: string, data: FirebaseFirestore.DocumentData): ConsentRecord {
  return {
    consentId: id,
    uid: String(data.uid),
    companyId: String(data.companyId),
    clientId: String(data.clientId),
    clientName: String(data.clientName),
    scopes: (data.scopes as OAuthScope[]) ?? [],
    audience: String(data.audience),
    createdAt: (data.createdAt as Timestamp)?.toMillis() ?? 0,
    revokedAt: data.revokedAt ? (data.revokedAt as Timestamp).toMillis() : null,
  };
}

/**
 * Καταγράφει νέα συγκατάθεση.
 *
 * ⚠️ `setDoc()` με enterprise id (N.6) — **ποτέ** `add()`. Το id διαβάζεται
 * αργότερα από κάθε token της αλυσίδας, οπότε πρέπει να είναι δικό μας και
 * αναγνωρίσιμο, όχι αυτόματο της Firestore.
 */
export async function recordConsent(input: ConsentInput): Promise<string> {
  const consentId = generateOAuthConsentId();

  await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_CONSENTS)
    .doc(consentId)
    .set({
      uid: input.uid,
      companyId: input.companyId,
      clientId: input.clientId,
      clientName: input.clientName,
      scopes: [...input.scopes],
      audience: input.audience,
      createdAt: Timestamp.now(),
      revokedAt: null,
    });

  return consentId;
}

/**
 * Ενεργή συγκατάθεση για (χρήστης, client, resource) — ή `null`.
 *
 * ⚠️ Τα scopes **δεν** συγκρίνονται εδώ, και αυτό είναι σκόπιμο: ο καλών
 * αποφασίζει αν τα αποθηκευμένα καλύπτουν το αίτημα. Αν η σύγκριση γινόταν εδώ
 * ως ισότητα, ένα αίτημα με **υποσύνολο** των ήδη εγκεκριμένων θα ζητούσε ξανά
 * συγκατάθεση — εκπαιδεύοντας τον χρήστη να πατά «ναι» ρουτίνας.
 */
export async function findActiveConsent(
  uid: string,
  clientId: string,
  audience: string,
): Promise<ConsentRecord | null> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_CONSENTS)
    .where('uid', '==', uid)
    .where('clientId', '==', clientId)
    .where('audience', '==', audience)
    .where('revokedAt', '==', null)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return toConsent(doc.id, doc.data());
}

/** Οι ενεργές συγκαταθέσεις ενός χρήστη — η οθόνη «συνδεδεμένοι πράκτορες». */
export async function listActiveConsents(uid: string): Promise<readonly ConsentRecord[]> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_CONSENTS)
    .where('uid', '==', uid)
    .where('revokedAt', '==', null)
    .get();

  return snapshot.docs.map((doc) => toConsent(doc.id, doc.data()));
}

/**
 * Ανακαλεί συγκατάθεση.
 *
 * ⚠️ Ανακαλεί **μόνο** τη συγκατάθεση. Η ανάκληση των tokens γίνεται από τον
 * καλούντα μέσω `revokeTokensForConsent()`, ώστε η σειρά να είναι ρητή και
 * ελέγξιμη: συγκατάθεση πρώτα (κόβει κάθε *μελλοντική* έκδοση), tokens μετά
 * (κόβει την *τρέχουσα* πρόσβαση). Κρυμμένη cascade εδώ θα έκανε τη σειρά
 * λεπτομέρεια υλοποίησης αντί για απόφαση.
 */
export async function revokeConsent(consentId: string, uid: string): Promise<boolean> {
  const ref = getAdminFirestore().collection(COLLECTIONS.OAUTH_CONSENTS).doc(consentId);
  const snapshot = await ref.get();

  if (!snapshot.exists) return false;
  if (String(snapshot.get('uid')) !== uid) return false;

  await ref.set({ revokedAt: Timestamp.now() }, { merge: true });
  return true;
}
