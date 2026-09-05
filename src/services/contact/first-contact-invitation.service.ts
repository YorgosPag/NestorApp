import 'server-only';

/**
 * @fileoverview **Η ΠΟΛΙΤΙΚΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — δύο πόρτες, ένα κλειδί, μία χρήση.
 * @related ADR-844 · lib/tokens/signed-token.ts · types/first-contact-invitation.ts
 * @module services/contact/first-contact-invitation.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ ΕΔΩ ΚΑΙ ΤΙ ΔΑΝΕΙΖΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Δανείζεται** τη γραμματική του συνδέσμου από το `lib/tokens/signed-token`
 * — το **ίδιο** SSoT που εξυπηρετεί ήδη το QR παρουσιών (ADR-170), την πύλη
 * προμηθευτή (ADR-327) και τη συγκατάθεση ιδιοκτήτη (ADR-777 §8.33). **Τέταρτος**
 * καταναλωτής, **καμία** τέταρτη μηχανή υπογραφής.
 *
 * **Κρατά** ό,τι είναι πραγματικά δικό της: **7 μέρες** · **μία χρήση** ·
 * **εξαψήφιος κωδικός** ως δεύτερη πόρτα · **5 δοκιμές** · αντικατάσταση του
 * προηγούμενου συνδέσμου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚪 ΓΙΑΤΙ ΔΥΟ ΠΟΡΤΕΣ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ **ΕΝΑ** ΚΛΕΙΔΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος είναι στο **κινητό**. Ανοίγει το email μέσα στην εφαρμογή Gmail,
 * που **δεν** ανοίγει τον κανονικό του φυλλομετρητή αλλά έναν δικό της
 * μίνι-browser: πατώντας τον σύνδεσμο η πράξη φεύγει σωστά, αλλά **η συνεδρία
 * του μένει σε παράθυρο που θα κλείσει σε δέκα δευτερόλεπτα**. Αύριο που θα
 * θέλει να δει *«το είδε ο ιδιοκτήτης;»* θα είναι αποσυνδεδεμένος.
 *
 * Ο **κωδικός** λύνει ακριβώς αυτό: η καρτέλα με την αγγελία μένει ανοιχτή, ο
 * άνθρωπος γράφει έξι ψηφία και **μένει εκεί που ήταν**, στον δικό του
 * φυλλομετρητή. Κόστος: αν κλείσει την καρτέλα, ξαναρχίζει.
 *
 * ⇒ **Και τα δύο στο ίδιο email** (το ίδιο κάνει το Slack), και ο άνθρωπος
 * διαλέγει. Ο κωδικός **δεν** είναι δεύτερο μυστικό: είναι δεύτερη πόρτα προς
 * την **ίδια** πρόσκληση, και συγκλίνουν στην **ίδια** {@link claimInvitation}.
 *
 * ⚠️ **Ο κωδικός ΜΟΝΟΣ ΤΟΥ δεν ανοίγει τίποτα** — απαιτεί και το `invitationId`,
 * που το κρατά **η ανοιχτή καρτέλα**. Δηλαδή έξι ψηφία δεν είναι «ένα
 * εκατομμύριο συνδυασμοί για το σύστημα», είναι «ένα εκατομμύριο για **μία
 * συγκεκριμένη** πρόσκληση, με **πέντε** δοκιμές». Ίδιο σχήμα με το Slack.
 *
 * **Layering**: service — Admin SDK. Καμία κρίση «γίνεσαι δεκτός;» εδώ: αυτή ζει
 * στο `first-contact-admission.ts` και τρέχει **στην εξαργύρωση**, από τον
 * γραφέα, όπως για κάθε άλλον.
 */

import { createHmac, randomInt } from 'crypto';

import type {
  DocumentReference,
  Firestore as AdminFirestore,
  Transaction,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decodeSignedToken,
  encodeSignedToken,
  equalsInConstantTime,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';
import { generateFirstContactInvitationId } from '@/services/enterprise-id.service';
import type { FirstContactDeclaration } from '@/services/contact/first-contact-vocabulary';
import {
  FIRST_CONTACT_TARGET_KINDS,
  sameFirstContactTarget,
  type FirstContactTarget,
} from '@/types/first-contact';
import {
  readStoredInvitationState,
  type FirstContactInvitation,
  type FirstContactInvitationDocument,
  type FirstContactInvitationRefusal,
} from '@/types/first-contact-invitation';

const logger = createModuleLogger('first-contact-invitation.service');

/**
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό με τις άλλες τρεις πύλες.** Τα πεδία ενός
 * υπογεγραμμένου συνδέσμου είναι απλό κείμενο και η υπογραφή **δεν ξέρει σε ποια
 * πύλη ανήκει**: με κοινό μυστικό, σύνδεσμος παρουσιών με τα σωστά πεδία θα
 * περνούσε για επαφή. Ξεχωριστά μυστικά κάνουν τη σύγχυση **αδύνατη**.
 */
const SECRET_ENV = 'FIRST_CONTACT_INVITE_SECRET';

/** Πόσο ζει ο σύνδεσμος. Δεν είναι η διάρκεια της **πράξης** — είναι της **απόδειξης**. */
const LIFETIME_DAYS = 7;

/**
 * Πόσες λάθος δοκιμές κωδικού αντέχει μια πρόσκληση.
 *
 * 🔑 **Πέντε, και το όριο είναι ανά ΠΡΟΣΚΛΗΣΗ — όχι ανά IP.** Το rate limit της
 * διαδρομής μετρά IP, και ο επιτιθέμενος **αλλάζει IP**. Αυτός ο μετρητής ζει
 * πάνω στον **στόχο** και δεν παρακάμπτεται με τίποτα.
 */
const MAX_CODE_ATTEMPTS = 5;

const CODE_DIGITS = 6;
const CODE_UPPER_BOUND = 10 ** CODE_DIGITS;

// =============================================================================
// 1. Ο ΚΩΔΙΚΟΣ
// =============================================================================

/**
 * **Έξι ψηφία, ομοιόμορφα** — `randomInt`, ποτέ `Math.random()`.
 *
 * ⚠️ Το `Math.random()` **δεν είναι κρυπτογραφικό**: η ακολουθία του προβλέπεται
 * από αρκετές παρατηρήσεις. Για κωδικό που ανοίγει επαφή άλλου ανθρώπου, αυτό
 * είναι η διαφορά ανάμεσα σε «τυχαίο» και «φαίνεται τυχαίο».
 *
 * ⚠️ **`padStart` και όχι εύρος από 100000**: το δεύτερο θα απέκλειε **κάθε**
 * κωδικό με αρχικό μηδέν, δηλαδή θα έκοβε το **10%** του χώρου — σιωπηλά.
 */
export function newVerificationCode(): string {
  return String(randomInt(0, CODE_UPPER_BOUND)).padStart(CODE_DIGITS, '0');
}

/**
 * **Το αποτύπωμα του κωδικού** — HMAC με το μυστικό μας, ποτέ σκέτο hash.
 *
 * 🔴 **Έξι ψηφία είναι ΜΟΝΟ ένα εκατομμύριο συνδυασμοί.** Ένα σκέτο `sha256`
 * σπάει **εξαντλητικά σε δευτερόλεπτα** σε φορητό υπολογιστή — δηλαδή μια
 * ανάγνωση της βάσης θα έδινε **κάθε** εκκρεμή κωδικό. Με HMAC, ο επιτιθέμενος
 * χρειάζεται **και** το μυστικό του διακομιστή, που δεν ζει στη βάση.
 */
function hashVerificationCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

// =============================================================================
// 2. ΕΚΔΟΣΗ
// =============================================================================

export interface IssuedInvitation {
  readonly invitationId: string;
  /** Για τον **σύνδεσμο** στο email. */
  readonly token: string;
  /** Για τη **δεύτερη πόρτα**. Ωμός **μόνο εδώ και στο email** — ποτέ στη βάση. */
  readonly code: string;
  readonly expiresAtISO: string;
}

/** Πεζά, χωρίς κενά — το κλειδί ιδεμποτησίας και ο παραλήπτης. */
export function normaliseChannelEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * **Νέα πρόσκληση** — γράφει το έγγραφο και ακυρώνει τυχόν προηγούμενη.
 *
 * @param nowISOValue Η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε τα άκρα
 *   να είναι δοκιμάσιμα. Ίδιο ιδίωμα με τον γραφέα της πράξης.
 *
 * ⚠️ **Γράφει, αντίθετα από το `issueMandateConsentLink`.** Εκεί ο καλών
 * αποθηκεύει το `nonce` πάνω στην **υπάρχουσα** εντολή, ώστε να είναι **μία**
 * γραφή. Εδώ **δεν υπάρχει τίποτα** να το κρατήσει — η πρόσκληση **είναι** το
 * έγγραφο.
 */
export async function issueFirstContactInvitation(
  adminDb: AdminFirestore,
  declaration: FirstContactDeclaration,
  channelEmailRaw: string,
  nowISOValue: string,
): Promise<IssuedInvitation> {
  const secret = requireTokenSecret(SECRET_ENV);
  const channelEmail = normaliseChannelEmail(channelEmailRaw);

  await supersedePreviousInvitations(adminDb, channelEmail, declaration, nowISOValue);

  const id = generateFirstContactInvitationId();
  const nonce = newTokenNonce();
  const code = newVerificationCode();
  const expiresAtMs = Date.parse(nowISOValue) + LIFETIME_DAYS * 24 * 60 * 60 * 1000;

  // ⚠️ **ΧΙΛΙΟΣΤΑ, ΠΟΤΕ ISO.** Το ISO κουβαλά άνω-κάτω τελείες — τον ίδιο
  //    χαρακτήρα που χωρίζει τα πεδία. Είναι το ελάττωμα που κρατούσε **κάθε**
  //    σύνδεσμο προμηθευτή νεκρό από την πρώτη μέρα (§8.33), και το
  //    `encodeSignedToken` πλέον **αρνείται** να το υπογράψει.
  const token = encodeSignedToken(secret, [id, nonce, String(expiresAtMs)]);

  const invitation: FirstContactInvitation = {
    id,
    declaration,
    channelEmail,
    nonce,
    codeHash: hashVerificationCode(code, secret),
    attempts: 0,
    state: 'sent',
    createdAt: nowISOValue,
    expiresAt: new Date(expiresAtMs).toISOString(),
    redeemedAt: null,
  };

  await adminDb.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).doc(id).set(invitation);

  return { invitationId: id, token, code, expiresAtISO: invitation.expiresAt };
}

/**
 * **Ο ίδιος άνθρωπος, ο ίδιος στόχος ⇒ η προηγούμενη παύει.**
 *
 * 🔑 Χωρίς αυτό θα κυκλοφορούσαν **δύο ζωντανοί σύνδεσμοι** για την ίδια επαφή,
 * και ο άνθρωπος που πατά τον **παλιό** (γιατί τον βρήκε πρώτο) θα έπαιρνε
 * «άκυρος» χωρίς να καταλάβει γιατί. Τώρα παίρνει *«αντικαταστάθηκε»*.
 */
async function supersedePreviousInvitations(
  adminDb: AdminFirestore,
  channelEmail: string,
  declaration: FirstContactDeclaration,
  nowISOValue: string,
): Promise<void> {
  const collection = adminDb.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS);
  const snapshot = await collection
    .where('channelEmail', '==', channelEmail)
    .where('state', '==', 'sent')
    .get();

  const stale = snapshot.docs.filter((doc) =>
    sameInvitationTarget((doc.data() as FirstContactInvitationDocument).declaration, declaration),
  );
  if (stale.length === 0) return;

  // ⚠️ **`collection.doc(doc.id)` και ΟΧΙ `doc.ref`**, παρότι το πραγματικό
  //    Firestore δίνει και τα δύο. Μετρημένο 2026-09-05: για να αποκτήσει `.ref` ο
  //    κοινός πλαστός (`places/__tests__/fake-firestore.ts`) έπρεπε κάθε ερώτημα να
  //    επιστρέφει αναφορά — και τότε **δύο ξένες σουίτες** (`brokered-listing`,
  //    `mandate-decision-notice`) προχώρησαν σε διαδρομή που χτυπά **πραγματικό**
  //    Firebase Storage και σταμάτησαν με λήξη χρόνου. Το `doc.id` το δίνει ο
  //    πλαστός **ήδη**, και η αναφορά χτίζεται εδώ: **ίδια πράξη, μηδέν ακτίνα σε
  //    κοινό εργαλείο**.
  const batch = adminDb.batch();
  for (const doc of stale) {
    batch.update(collection.doc(doc.id), { state: 'superseded', supersededAt: nowISOValue });
  }
  await batch.commit();
}

/**
 * Ίδιος στόχος;
 *
 * 🔑 **ΤΕΤΑΡΤΟΣ ΚΑΛΩΝ ΤΟΥ `sameFirstContactTarget`**, και ο λόγος είναι γραμμένος
 * στην κεφαλίδα του: *«ζει εκεί επειδή τη ρωτούν τρεις… δύο διατυπώσεις του
 * "ίδιος στόχος" είναι ελεύθερες να αποκλίνουν»*. Η πέμπτη διατύπωση θα ήταν το
 * σχήμα του ADR-749.
 *
 * ⚠️ **Και η ίδια η αποφυγή του παραλίγο να κοστίσει ελάττωμα**: μια «αμυντική»
 * σύγκριση `target.id === target.id` γράφτηκε πρώτα εδώ — αλλά το
 * {@link FirstContactTarget} **δεν έχει** πεδίο `id`· έχει `listingId` **ή**
 * `agencyCompanyId`. Θα ήταν `undefined === undefined` ⇒ **κάθε** στόχος ίδιος
 * με **κάθε** άλλον ⇒ η πρόσκληση για το ένα ακίνητο θα ακύρωνε την πρόσκληση
 * για **όλα** τα υπόλοιπα του ίδιου ανθρώπου.
 *
 * ⚠️ Ο έλεγχος σχήματος μένει, γιατί εδώ τα δεδομένα έρχονται **από τη βάση**:
 * αστοχεί προς το **ασφαλές** *(δύο προσκλήσεις που δεν αναγνωρίστηκαν ως ίδιες
 * απλώς συνυπάρχουν)*, ποτέ προς την ακύρωση ξένης πρόσκλησης.
 */
function sameInvitationTarget(stored: unknown, current: FirstContactDeclaration): boolean {
  const target = (stored as FirstContactDeclaration | undefined)?.target;
  if (target === null || typeof target !== 'object') return false;
  if (!isFirstContactTargetKind((target as { kind?: unknown }).kind)) return false;
  return sameFirstContactTarget(target as FirstContactTarget, current.target);
}

function isFirstContactTargetKind(value: unknown): boolean {
  return typeof value === 'string'
    && (FIRST_CONTACT_TARGET_KINDS as readonly string[]).includes(value);
}

// =============================================================================
// 3. ΕΞΑΡΓΥΡΩΣΗ — δύο πόρτες, μία κλειδαριά
// =============================================================================

export type InvitationClaim =
  | { readonly kind: 'claimed'; readonly invitation: FirstContactInvitation }
  | { readonly kind: 'refused'; readonly reason: FirstContactInvitationRefusal };

/**
 * **Πόρτα Α — ο σύνδεσμος.** Η υπογραφή ελέγχεται **πριν** από κάθε ανάγνωση.
 *
 * 🔑 Πλαστός σύνδεσμος απορρίπτεται **χωρίς κανένα αίτημα** στη βάση, οπότε
 * κανείς δεν μπορεί να μας κοστίσει στέλνοντας σκουπίδια.
 */
export async function claimInvitationByLink(
  adminDb: AdminFirestore,
  tokenString: string,
  nowISOValue: string = clockNowISO(),
): Promise<InvitationClaim> {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    logger.error('Λείπει το μυστικό των προσκλήσεων — κάθε σύνδεσμος φαίνεται άκυρος');
    return { kind: 'refused', reason: 'link-invalid' };
  }

  const verdict = decodeSignedToken(secret, tokenString, 3);
  if (!verdict.ok || verdict.fields.length !== 3) {
    return { kind: 'refused', reason: 'link-invalid' };
  }

  const [invitationId, nonce, expiresAtMs] = verdict.fields as [string, string, string];
  if (!Number.isFinite(Number(expiresAtMs))) {
    return { kind: 'refused', reason: 'link-invalid' };
  }

  return claimInvitation(adminDb, invitationId, nowISOValue, (stored) =>
    // ⚠️ Το `nonce` ελέγχεται **και** μέσα στη συναλλαγή: η υπογραφή αποδεικνύει
    //    ότι εμείς φτιάξαμε το κείμενο, **όχι** ότι δείχνει σε αυτό το έγγραφο.
    stored.nonce === nonce ? null : 'link-invalid',
  );
}

/**
 * **Πόρτα Β — ο εξαψήφιος κωδικός.** Απαιτεί **και** το `invitationId`, που το
 * κρατά η ανοιχτή καρτέλα.
 */
export async function claimInvitationByCode(
  adminDb: AdminFirestore,
  invitationId: string,
  code: string,
  nowISOValue: string = clockNowISO(),
): Promise<InvitationClaim> {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    logger.error('Λείπει το μυστικό των προσκλήσεων — κάθε κωδικός φαίνεται λάθος');
    return { kind: 'refused', reason: 'code-wrong' };
  }

  const expected = hashVerificationCode(code.trim(), secret);
  return claimInvitation(adminDb, invitationId, nowISOValue, (stored, tx, ref) => {
    if (stored.attempts >= MAX_CODE_ATTEMPTS) return 'code-exhausted';
    if (equalsInConstantTime(expected, stored.codeHash)) return null;

    // 🔑 **Ο μετρητής ανεβαίνει ΜΕΣΑ στη συναλλαγή**, αλλιώς δύο ταυτόχρονες
    //    δοκιμές θα μετρούσαν ως μία και οι πέντε θα γίνονταν αόριστες.
    tx.update(ref, { attempts: stored.attempts + 1 });
    return stored.attempts + 1 >= MAX_CODE_ATTEMPTS ? 'code-exhausted' : 'code-wrong';
  });
}

/**
 * **Η μία κλειδαριά** — κατάσταση, λήξη, ειδικός έλεγχος πόρτας, σφράγισμα.
 *
 * 🔴 **ΟΛΑ ΜΕΣΑ ΣΕ ΜΙΑ ΣΥΝΑΛΛΑΓΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ ΤΟΥ «ΜΙΑ ΧΡΗΣΗ»**: δύο
 * ταυτόχρονα πατήματα του ίδιου συνδέσμου *(ο άνθρωπος διπλοπάτησε, ή ο
 * προεπισκοπητής του email τον άνοιξε πρώτος)* θα γεννούσαν **δύο** πράξεις.
 * Ο έλεγχος και το σφράγισμα είναι **αδιαίρετα**.
 */
async function claimInvitation(
  adminDb: AdminFirestore,
  invitationId: string,
  nowISOValue: string,
  guard: (
    stored: FirstContactInvitation,
    tx: Transaction,
    ref: DocumentReference,
  ) => FirstContactInvitationRefusal | null,
): Promise<InvitationClaim> {
  const ref = adminDb.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).doc(invitationId);

  try {
    return await adminDb.runTransaction<InvitationClaim>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return refuse('invitation-unknown');

      const stored = readInvitation(snap.data());
      const unusable = stateRefusal(stored, nowISOValue);
      if (unusable !== null) return refuse(unusable);

      const blocked = guard(stored, tx, ref);
      if (blocked !== null) return refuse(blocked);

      tx.update(ref, { state: 'redeemed', redeemedAt: nowISOValue });
      return { kind: 'claimed', invitation: { ...stored, state: 'redeemed', redeemedAt: nowISOValue } };
    });
  } catch (error: unknown) {
    logger.error('Η εξαργύρωση της πρόσκλησης απέτυχε', {
      invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return refuse('invitation-unknown');
  }
}

function refuse(reason: FirstContactInvitationRefusal): InvitationClaim {
  return { kind: 'refused', reason };
}

/** Το ωμό έγγραφο → τύπος, με την κατάσταση **fail-closed** (δες τον τύπο). */
function readInvitation(data: unknown): FirstContactInvitation {
  const raw = data as FirstContactInvitationDocument;
  return {
    ...raw,
    state: readStoredInvitationState(raw.state),
    // ⚠️ Έγγραφο χωρίς μετρητή διαβάζεται ως **εξαντλημένο δεν είναι** αλλά
    //    **μηδέν**: η απουσία σημαίνει «δεν δοκίμασε ποτέ», που είναι αληθές για
    //    κάθε πρόσκληση πριν την πρώτη δοκιμή.
    attempts: typeof raw.attempts === 'number' ? raw.attempts : 0,
  };
}

/** Είναι αυτή η πρόσκληση **χρησιμοποιήσιμη τώρα**; */
function stateRefusal(
  invitation: FirstContactInvitation,
  nowISOValue: string,
): FirstContactInvitationRefusal | null {
  if (invitation.state === 'redeemed') return 'already-used';
  if (invitation.state === 'superseded') return 'superseded';
  if (invitation.state === 'expired') return 'expired';

  // ⚠️ **Η ώρα κρίνεται ΚΑΙ εδώ, όχι μόνο στο token.** Η πόρτα του κωδικού δεν
  //    περνά από υπογραφή, άρα δεν έχει ημερομηνία να διαβάσει — χωρίς αυτό, ο
  //    κωδικός θα ζούσε **για πάντα** ενώ ο σύνδεσμος θα έληγε.
  return Date.parse(invitation.expiresAt) <= Date.parse(nowISOValue) ? 'expired' : null;
}
