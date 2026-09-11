import 'server-only';

/**
 * @fileoverview **Ο ΛΟΓΑΡΙΑΣΜΟΣ ΞΑΝΑΧΤΙΖΕΤΑΙ ΑΠΟ ΤΟ ΜΗΔΕΝ — ΜΕ ΤΟ ΙΔΙΟ uid** (ADR-844 §13.8).
 * @related server/auth/mailbox-proof-custody.ts (ο καλών) · server/auth/citizen-identity.ts (η συνέχιση)
 * @module server/auth/account-reprovision
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΑΓΡΑΦΗ ΚΑΙ ΟΧΙ «ΑΦΑΙΡΕΣΗ ΚΩΔΙΚΟΥ» — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, 2026-09-11
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Πείραμα σε throwaway λογαριασμούς (`scripts/firebase-auth/probe-oob-survival.ts`): ο
 * επιτιθέμενος ζητά `VERIFY_AND_CHANGE_EMAIL` προς δικό του email **πριν** τη διεκδίκηση·
 * εφαρμόζεται **μετά**;
 *
 * | Πράξη πριν την εφαρμογή | Emulator | **Παραγωγή** |
 * |---|---|---|
 * | η παλιά διεκδίκηση (`emailVerified` + αφαίρεση `password` + ανάκληση) | πεθαίνει | **επιζεί ⇒ κατάληψη** |
 * | αλλαγή email και επαναφορά · αλλαγή κωδικού · `importUsers` | επιζεί | **επιζεί** |
 * | **διαγραφή + δημιουργία ΙΔΙΟΥ uid** | επιζεί | **INVALID_OOB_CODE** |
 * | Google **του επιτιθέμενου** δεμένο πριν + παλιά διεκδίκηση | — | **επιζεί, ΚΑΙ ο πάροχος μένει** |
 * | Google του επιτιθέμενου + **επαναδημιουργία** | — | **INVALID_OOB_CODE, κανένας πάροχος** |
 *
 * ⇒ Η επαναδημιουργία κλείνει **δύο** κλάσεις του Sudhodanan & Paverd (USENIX 2022) μαζί:
 * *Unexpired Email Change* και *Trojan Identifier*. Και ο emulator έδωσε **ανάποδη**
 * απάντηση και στις δύο — ⛔ **ΠΟΤΕ δοκιμή αυτής της σημασιολογίας στον emulator**.
 *
 * 🔑 **Το uid μένει ⇒ τα δεδομένα μένουν** (επαφές, αγγελίες, `users/{uid}`): ό,τι δένεται
 * με uid δεν καταλαβαίνει τίποτα. Χάνεται μόνο ό,τι **δεν αποδείχθηκε**: κάθε τρόπος
 * σύνδεσης και ο χρόνος δημιουργίας στο Auth. Δεύτερος παράγοντας δεν υπάρχει να χαθεί —
 * η Firebase δεν εγγράφει MFA σε ανεπιβεβαίωτο email.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΤΑ ΤΡΙΑ ΚΕΝΑ ΤΗΣ ΠΡΑΞΗΣ — ΚΑΙ Η ΑΠΑΝΤΗΣΗ ΣΤΟ ΚΑΘΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Η διεργασία πέφτει ανάμεσα σε διαγραφή και δημιουργία** ⇒ ημερολόγιο **πριν** τη
 *    διαγραφή (write-ahead), σβήσιμο **μετά** την επιτυχία, και {@link resumeInterruptedReprovision}
 *    στην επόμενη απόδειξη. Χωρίς αυτό θα γεννιόταν **νέο** uid και τα δεδομένα θα έμεναν
 *    ορφανά — σιωπηλά.
 * 2. **Κάποιος γράφεται με το email μέσα στο κενό** ⇒ ανεπιβεβαίωτος σφετεριστής
 *    **διαγράφεται** (ο κανόνας της ίδιας της Firebase για το email-link), φραγμένα
 *    {@link RACE_ATTEMPTS} φορές· **επιβεβαιωμένος** ⇒ άρνηση, ποτέ εικασία.
 * 3. **Ο επιτιθέμενος εφάρμοσε τον κωδικό ΛΙΓΟ ΠΡΙΝ** ⇒ το email του λογαριασμού δεν είναι
 *    πια το αποδεδειγμένο ⇒ **άρνηση** πριν από κάθε γραφή (κλειστά σε αποτυχία).
 */

import type { UserRecord } from 'firebase-admin/auth';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { sentryCaptureMessage } from '@/lib/telemetry';
import { generateDeterministicAuthReprovisionJournalId } from '@/services/enterprise-id.service';

/** Πόσες φορές διώχνουμε σφετεριστή μέσα στο κενό πριν αρνηθούμε. */
const RACE_ATTEMPTS = 3;

/** Γιατί **δεν** ξαναχτίστηκε — ο καλών το μεταφράζει σε «δεν μάθαμε», ποτέ σε ταυτότητα. */
export class ReprovisionAborted extends Error {
  constructor(readonly reason: 'email-moved' | 'mailbox-taken') {
    super(`Account reprovision aborted: ${reason}`);
    this.name = 'ReprovisionAborted';
  }
}

export interface ReprovisionReceipt {
  /** Κάθε τρόπος σύνδεσης που **δεν** επέζησε — `password`, ή πάροχος δεμένος από άλλον. */
  readonly removedProviders: readonly string[];
}

/** Ό,τι χρειάζεται για να ξαναστηθεί ο λογαριασμός — και **μόνο** αυτό. */
interface JournalEntry {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly customClaims: Record<string, unknown> | null;
}

function normalizedAddress(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
}

function journalRef(email: string) {
  const id = generateDeterministicAuthReprovisionJournalId(normalizedAddress(email));
  return getAdminFirestore().collection(COLLECTIONS.AUTH_REPROVISION_JOURNAL).doc(id);
}

/** Τα claims **χωρίς** τη σφραγίδα χρόνου — ο γραφέας βάζει νέα (ADR-360). */
function claimsWorthRestoring(claims: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const entries = Object.entries(claims ?? {}).filter(([key]) => key !== 'claimsUpdatedAt');
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function entryOf(record: UserRecord, provenEmail: string): JournalEntry {
  return {
    uid: record.uid,
    email: normalizedAddress(provenEmail),
    displayName: record.displayName ?? null,
    photoURL: record.photoURL ?? null,
    customClaims: claimsWorthRestoring(record.customClaims),
  };
}

async function deleteIfPresent(uid: string): Promise<void> {
  try {
    await getAdminAuth().deleteUser(uid);
  } catch (error: unknown) {
    // Ταυτόχρονη διεκδίκηση το έσβησε ήδη — συνεχίζουμε στη δημιουργία.
    if (codeOf(error) !== 'auth/user-not-found') throw error;
  }
}

/**
 * **Ποιος πήρε το email μέσα στο κενό;** Εμείς (ταυτόχρονη διεκδίκηση) ⇒ έτοιμο.
 * Ανεπιβεβαίωτος τρίτος ⇒ διώχνεται. Επιβεβαιωμένος ⇒ **άρνηση**.
 */
async function evictSquatter(entry: JournalEntry): Promise<'ours' | 'evicted'> {
  const squatter = await getAdminAuth().getUserByEmail(entry.email);
  if (squatter.uid === entry.uid) return 'ours';
  if (squatter.emailVerified) throw new ReprovisionAborted('mailbox-taken');
  await getAdminAuth().deleteUser(squatter.uid);
  return 'evicted';
}

/** Το uid υπάρχει ήδη: είναι **δίδυμο** ταυτόχρονης διεκδίκησης, ή κάτι άλλο; */
async function assertConcurrentTwin(entry: JournalEntry): Promise<void> {
  const twin = await getAdminAuth().getUser(entry.uid);
  const isTwin = twin.emailVerified && normalizedAddress(twin.email) === entry.email && twin.providerData.length === 0;
  if (!isTwin) throw new ReprovisionAborted('email-moved');
}

async function recreate(entry: JournalEntry): Promise<void> {
  for (let attempt = 1; attempt <= RACE_ATTEMPTS; attempt += 1) {
    try {
      await getAdminAuth().createUser({
        uid: entry.uid,
        email: entry.email,
        emailVerified: true,
        ...(entry.displayName !== null ? { displayName: entry.displayName } : {}),
        ...(entry.photoURL !== null ? { photoURL: entry.photoURL } : {}),
      });
      return;
    } catch (error: unknown) {
      const code = codeOf(error);
      if (code === 'auth/uid-already-exists') return assertConcurrentTwin(entry);
      if (code !== 'auth/email-already-exists') throw error;
      if ((await evictSquatter(entry)) === 'ours') return;
    }
  }
  throw new ReprovisionAborted('mailbox-taken');
}

/** Δημιουργία → claims → σβήσιμο ημερολογίου. Κοινό σε πρώτη εκτέλεση **και** συνέχιση. */
async function completeFromJournal(entry: JournalEntry): Promise<void> {
  await recreate(entry);
  if (entry.customClaims !== null) await setClaimsWithMirror(entry.uid, entry.customClaims);
  await journalRef(entry.email).delete();
}

/**
 * **Ξαναχτίσε τον λογαριασμό από το μηδέν, με το ίδιο uid.**
 *
 * @param uid Ο λογαριασμός που βρέθηκε με `getUserByEmail`.
 * @param provenEmail Η διεύθυνση που **μόλις αποδείχθηκε**.
 * @throws {ReprovisionAborted} Αν ο λογαριασμός δεν είναι πια αυτού του email, ή το email
 *   το κρατά επιβεβαιωμένος τρίτος. Κάθε άλλο σφάλμα της Firebase περνά ως έχει.
 */
export async function reprovisionAuthAccount(uid: string, provenEmail: string): Promise<ReprovisionReceipt> {
  const record = await getAdminAuth().getUser(uid);
  if (normalizedAddress(record.email) !== normalizedAddress(provenEmail)) {
    throw new ReprovisionAborted('email-moved');
  }

  const entry = entryOf(record, provenEmail);
  // 🔴 **ΠΡΙΝ τη διαγραφή — η σειρά είναι όλο το νόημα του ημερολογίου.**
  await journalRef(entry.email).set({ ...entry, startedAt: AdminFieldValue.serverTimestamp() });
  await deleteIfPresent(uid);
  await completeFromJournal(entry);

  return { removedProviders: record.providerData.map((provider) => provider.providerId) };
}

function readJournalEntry(data: FirebaseFirestore.DocumentData | undefined): JournalEntry | null {
  if (typeof data?.uid !== 'string' || typeof data.email !== 'string') return null;
  return {
    uid: data.uid,
    email: data.email,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    customClaims: typeof data.customClaims === 'object' && data.customClaims !== null
      ? (data.customClaims as Record<string, unknown>)
      : null,
  };
}

/**
 * **Υπάρχει διεκδίκηση που διακόπηκε για αυτό το email;** Τότε **ολοκλήρωσέ τη** και
 * επίστρεψε το uid — αντί ο καλών να γεννήσει **νέο** λογαριασμό και να ορφανέψουν τα
 * δεδομένα του παλιού.
 *
 * @returns Το uid που ξαναστήθηκε, ή `null` αν δεν υπήρχε τίποτα να συνεχιστεί.
 */
export async function resumeInterruptedReprovision(email: string): Promise<string | null> {
  const snapshot = await journalRef(email).get();
  const entry = snapshot.exists ? readJournalEntry(snapshot.data()) : null;
  if (entry === null) return null;

  await completeFromJournal(entry);
  // 🔑 Σπάνιο **και** σημαντικό: σημαίνει ότι μια διεκδίκηση έμεινε στη μέση.
  sentryCaptureMessage('Interrupted account reprovision resumed', 'warning', {
    tags: { component: 'account-reprovision' },
    extra: { uid: entry.uid },
  });
  return entry.uid;
}
