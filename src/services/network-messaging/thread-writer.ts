/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΝΗΜΑΤΟΣ ΚΑΙ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ ΤΟΥ** (ADR-867 §4.1/§4.2/§4.3).
 * @related ADR-834 §5 Β (γ) ① · (ε) ①-③ · CHECK 3.89 · αδελφός: `act-team-writer.ts`
 * @module services/network-messaging/thread-writer
 *
 * 🔑 **ΤΟ ΝΗΜΑ ΔΕΝ «ΑΝΟΙΓΕΙ» — ΥΠΑΡΧΕΙ ΕΠΕΙΔΗ ΥΠΑΡΧΕΙ ΑΚΜΗ** (§3). Γι' αυτό η γέννηση δεν
 * είναι πράξη χρήστη: είναι **παρενέργεια της πράξης** που γέννησε την ακμή, στην **ίδια**
 * συναλλαγή. Κανείς δεν πατά «νέα συνομιλία», και κανείς δεν μπορεί να ζητήσει νήμα με
 * άγνωστο — δεν υπάρχει διαδρομή που να το επιτρέπει.
 *
 * ⚠️ **ΟΜΑΔΑ ≠ ΝΗΜΑ, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ Η ΑΡΧΙΤΕΚΤΟΝΙΚΗ.** Η **ομάδα** γεννιέται
 * με την **πράξη** — ακόμη και «σε αναμονή», γιατί το «ποιος απαντά από το γραφείο» είναι
 * ιδιότητα της πράξης (Β3). Το **νήμα** γεννιέται με την **ΑΚΜΗ** — δηλαδή μόνο όταν
 * υπάρχει **πρόσωπο** στην άλλη πλευρά (`confirmedByUserId`). Ιδιοκτήτης χωρίς λογαριασμό
 * ⇒ ομάδα **ναι**, νήμα **όχι** (§8 #1) — και αυτό **δεν** είναι κενό: είναι ο λόγος που
 * το {@link writeActThread} επιστρέφει `null` αντί να γεννήσει νήμα με κενό άκρο.
 *
 * ⚠️ **ΔΥΟ ΠΟΡΤΕΣ, ΕΝΑΣ ΠΥΡΗΝΑΣ** — το ίδιο ιδίωμα με τον γραφέα ομάδας:
 * {@link readActThreadSlot} + {@link writeActThread} για όποιον **έχει ήδη** συναλλαγή,
 * {@link ensureActThread} για όποιον **δεν έχει**.
 *
 * ⛔ **ΚΑΝΕΝΑΣ ΑΛΛΟΣ ΓΡΑΦΕΑΣ ΑΚΡΟΑΤΗΡΙΟΥ** (§4.3) — ούτε για το `lastReadAt`, ούτε για τη
 * σίγαση (που ζουν πλέον στο **ιδιωτικό** έγγραφο της θέσης, Ε9 — ίδιος γραφέας). Το επιβάλλει το **Κ3** του CHECK 3.89. Ο λόγος δεν είναι καθαρότητα: το ίδιο
 * έγγραφο απαντά *«ποιος διαβάζει;»* **και** στον κανόνα Firestore· ένας δεύτερος γραφέας
 * που «απλώς ενημερώνει την ώρα ανάγνωσης» μπορεί να γράψει `until` με ένα `set` χωρίς
 * merge — δηλαδή να **βγάλει άνθρωπο από το νήμα** κατά λάθος.
 */

import 'server-only';

import {
  FieldValue,
  type CollectionReference,
  type DocumentReference,
  type Firestore as AdminFirestore,
  type Transaction,
} from 'firebase-admin/firestore';

import { inboxVerdictsOf, type InboxVerdict } from '@/lib/network-messaging/thread-liveness';
import { networkAudiencePrivateFromDocument } from '@/lib/network-messaging/network-thread-from-document';
import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import type {
  NetworkAudienceEntry,
  NetworkAudienceReason,
  NetworkAudienceSeat,
  NetworkThread,
  NetworkThreadTopic,
} from '@/types/network-thread';

import { legacyPrivateResidue, publicAudienceRow, seatsOfThread } from './audience-seats';
import {
  networkAudiencePrivateRef,
  networkAudienceRef,
  networkInboxRowRef,
  networkThreadAudience,
  networkThreadRef,
} from './network-thread-ref';
import { projectActAudience, type AudienceTeamSource, type AudienceWrite } from './thread-audience';

/** Το θέμα ενός νήματος **πράξης** — το σκέλος `act` της διακριτής ένωσης. */
export type ActThreadTopic = Extract<NetworkThreadTopic, { kind: 'act' }>;

/** Το έγγραφο, με το πεδίο χρόνου που ο τύπος του πυρήνα κουβαλά ως `lastMessageAt`. */
export interface ActThreadDocument extends NetworkThread {
  readonly updatedAt: string;
}

/**
 * **Η γέννηση σε μορφή εγγράφου** — καθαρή, ώστε να ελέγχεται χωρίς Firestore.
 *
 * ⚠️ `lastMessageAt: null` και **όχι** `createdAt`: «κανείς δεν μίλησε ακόμη» είναι
 * **διαφορετικό** από «μίλησε τη στιγμή της γέννησης», και η οθόνη τα δείχνει αλλιώς.
 */
export function actThreadDocument(topic: ActThreadTopic, nowISO: string): ActThreadDocument {
  return {
    id: generateDeterministicNetworkActThreadId(topic.actSeed),
    topic,
    state: 'open',
    createdAt: nowISO,
    lastMessageAt: null,
    updatedAt: nowISO,
  };
}

/** Ό,τι κρατά η **φάση ανάγνωσης** μιας ξένης συναλλαγής για να μπορέσει να γράψει. */
export interface ActThreadSlot {
  readonly ref: DocumentReference;
  /**
   * Η υποσυλλογή ακροατηρίου, **χτισμένη μία φορά στη φάση ανάγνωσης**. Ταξιδεύει μαζί
   * με το slot ώστε η φάση **γραφής** να μη χρειάζεται ξανά το `adminDb` — και ώστε το
   * μονοπάτι να χτίζεται **μία** φορά ανά συναλλαγή (Κ1 του CHECK 3.89).
   */
  readonly audienceRef: CollectionReference;
  readonly exists: boolean;
  /** Το θέμα του **υπάρχοντος** νήματος — από εκεί βγαίνει ο αντισυμβαλλόμενος. */
  readonly topic: ActThreadTopic | null;
  /**
   * Οι θέσεις **με** την ιδιωτική πλευρά (ADR-867 §4.5 Β10): η προβολή χρειάζεται `lastReadAt`/`muted` για να
   * κρίνει τη γραμμή αδιάβαστων όποιου **επιστρέφει**. ⚠️ Προς τη δημόσια γραμμή περνά **μόνο** μέσα από το
   * `publicAudienceRow` — τα ιδιωτικά πεδία δεν φτάνουν ποτέ εκεί.
   */
  readonly audience: readonly NetworkAudienceSeat[];
  /** `lastMessageAt ?? createdAt` του **υπάρχοντος** νήματος· `null` ⇒ δεν υπάρχει ακόμη. */
  readonly activityAt: string | null;
  /** Η ζωντάνια του **υπάρχοντος** νήματος (κρίση αδιάβαστου)· `null` ⇒ δεν υπάρχει ακόμη. */
  readonly liveness: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'> | null;
  /** Η γραμμή αδιάβαστων ενός ανθρώπου **για αυτό το νήμα** — χτισμένη στη φάση ανάγνωσης, όπως το `audienceRef`. */
  readonly inboxRowOf: InboxRowOf;
}

/**
 * **Φάση ανάγνωσης** — το έγγραφο **και** το ακροατήριό του, μαζί.
 *
 * ⚠️ **ΠΡΕΠΕΙ** να τρέξει πριν από **κάθε** γραφή της συναλλαγής (απαίτηση Firestore).
 * 🔑 Το ακροατήριο διαβάζεται **ολόκληρο** επίτηδες: η προβολή πρέπει να δει και τις
 * **σφραγισμένες** γραμμές, αλλιώς μια επιστροφή θα γραφόταν ως πρώτη είσοδος και το
 * «από πότε» θα έλεγε ψέματα.
 */
export async function readActThreadSlot(
  transaction: Transaction,
  adminDb: AdminFirestore,
  actSeed: string,
): Promise<ActThreadSlot> {
  const threadId = generateDeterministicNetworkActThreadId(actSeed);
  const ref = networkThreadRef(adminDb, threadId);
  const audienceRef = networkThreadAudience(adminDb, threadId);

  const [snapshot, audienceSnap] = await Promise.all([
    transaction.get(ref),
    transaction.get(audienceRef),
  ]);

  const stored = snapshot.data() as NetworkThread | undefined;
  return {
    ref,
    audienceRef,
    exists: snapshot.exists,
    topic: stored?.topic.kind === 'act' ? stored.topic : null,
    audience: await seatsOfThread((...refs) => transaction.getAll(...refs), adminDb, threadId, audienceSnap.docs),
    activityAt: stored === undefined ? null : threadActivityOf(stored),
    liveness: stored === undefined ? null : { lastMessageAt: stored.lastMessageAt, lastLiveMessageAt: stored.lastLiveMessageAt },
    inboxRowOf: (uid) => networkInboxRowRef(adminDb, uid, threadId),
  };
}

/**
 * **Η δραστηριότητα ενός νήματος** — ο **ένας** ορισμός (`lastMessageAt ?? createdAt`), για
 * τη γέννηση, την είσοδο και τον κατάλογο. Δύο διατυπώσεις θα ταξινομούσαν διαφορετικά.
 */
export function threadActivityOf(thread: Pick<NetworkThread, 'lastMessageAt' | 'createdAt'>): string {
  return thread.lastMessageAt ?? thread.createdAt;
}

/** Ό,τι χρειάζεται η **φάση γραφής**: η ομάδα τώρα, και —αν δεν υπάρχει νήμα— το θέμα του. */
export interface ActThreadPlan {
  /**
   * Το θέμα, **μόνο** όταν η ακμή υπάρχει. `null` ⇒ *«μην γεννήσεις νήμα»* — και είναι η
   * κανονική περίπτωση της μεταβίβασης: η ομάδα αλλάζει, το νήμα μπορεί να μην υπάρχει.
   */
  readonly birth: ActThreadTopic | null;
  readonly team: AudienceTeamSource;
  readonly newcomerReason: NetworkAudienceReason;
  readonly addedBy: string;
  readonly nowISO: string;
}

/** Τι έγινε — ώστε ο καλών να μπορεί να το γράψει στο ίχνος χωρίς δεύτερη ανάγνωση. */
export interface ActThreadOutcome {
  readonly threadId: string | null;
  readonly created: boolean;
  readonly audienceWrites: readonly AudienceWrite[];
}

const NO_THREAD: ActThreadOutcome = { threadId: null, created: false, audienceWrites: [] };

/**
 * **Φάση γραφής**: γεννά το νήμα **αν λείπει και υπάρχει ακμή**, και ξαναγράφει το
 * ακροατήριο ως **προβολή** της ομάδας (§4.3).
 *
 * 🔑 **Ιδεμποτής σε τρία επίπεδα**: ντετερμινιστικό κλειδί ⇒ δεύτερη γέννηση βρίσκει το
 * **ίδιο** έγγραφο· υπαρκτό νήμα **δεν** ξαναγράφεται (μια ανανέωση όρων δεν μηδενίζει το
 * `lastMessageAt`)· η προβολή επιστρέφει **μόνο διαφορές**.
 *
 * ⚠️ **Ο αντισυμβαλλόμενος έρχεται από το ΥΠΑΡΧΟΝ έγγραφο όταν υπάρχει** — ποτέ από το
 * `plan`. Αλλιώς μια δεύτερη πράξη με άλλο πρόσωπο θα άλλαζε **σιωπηλά** ποιος διαβάζει
 * ένα νήμα που έχει ήδη ιστορικό.
 */
export function writeActThread(
  transaction: Transaction,
  slot: ActThreadSlot,
  plan: ActThreadPlan,
): ActThreadOutcome {
  const topic = slot.topic ?? plan.birth;
  if (topic === null) return NO_THREAD;

  const document = actThreadDocument(topic, plan.nowISO);
  if (!slot.exists) transaction.set(slot.ref, document);

  const audienceWrites = projectActAudience({
    team: plan.team,
    counterpartUid: topic.counterpartUid,
    // 🔒 Η προβολή βλέπει **μόνο** τη δημόσια πλευρά — ιδιωτικό πεδίο δεν ταξιδεύει ούτε στα `audienceWrites`.
    existing: slot.audience.map(publicAudienceRow),
    newcomerReason: plan.newcomerReason,
    addedBy: plan.addedBy,
    nowISO: plan.nowISO,
    threadActivityAt: slot.activityAt ?? threadActivityOf(document),
  });

  for (const write of audienceWrites) {
    // 🔒 Ε9: μόνο δηλωμένα δημόσια πεδία — η προβολή ξεκινά από το ακατέργαστο `previous`.
    transaction.set(slot.audienceRef.doc(write.uid), publicAudienceRow(write.entry));
  }
  // 🔢 Β10: όποιος μπήκε/επέστρεψε/βγήκε — η γραμμή αδιάβαστων ακολουθεί τη θέση του, στην ίδια συναλλαγή.
  //    Νέο νήμα ⇒ κανένα μήνυμα ⇒ καμία γραμμή να υπάρξει.
  if (slot.liveness !== null) {
    writeInboxVerdicts(transaction, slot.inboxRowOf, projectionVerdicts(slot, audienceWrites));
  }

  return { threadId: document.id, created: !slot.exists, audienceWrites };
}

/**
 * **Η πόρτα για όποιον ΔΕΝ έχει συναλλαγή** — δική της συναλλαγή, ώστε η ιδεμποτησία να
 * μην είναι «διάβασε, μετά γράψε» με κενό ανάμεσα.
 */
export async function ensureActThread(
  adminDb: AdminFirestore,
  plan: ActThreadPlan & { readonly actSeed: string },
): Promise<ActThreadOutcome> {
  return adminDb.runTransaction(async (transaction) => {
    const slot = await readActThreadSlot(transaction, adminDb, plan.actSeed);
    return writeActThread(transaction, slot, plan);
  });
}

// =============================================================================
// 🔢 ΤΟ ΚΟΥΤΙ ΑΔΙΑΒΑΣΤΩΝ — ΠΡΟΒΟΛΗ ΤΟΥ ΑΚΡΟΑΤΗΡΙΟΥ, ΑΠΟ ΤΟΝ ΙΔΙΟ ΓΡΑΦΕΑ (ADR-867 §4.5 · Β10)
// =============================================================================

/** Η γραμμή αδιάβαστων ενός ανθρώπου για **ένα** νήμα. */
export type InboxRowOf = (uid: string) => DocumentReference;

/** Ό,τι κουβαλά η γραμμή — η ώρα του ζωντανού μηνύματος που την κρατά (αύριο: ταξινόμηση «μόνο αδιάβαστα»). */
export interface NetworkInboxUnreadRow {
  readonly liveMessageAt: string;
}

/**
 * 🔑 **Εκτελεί τις ετυμηγορίες** — `set` όπου η θέση μετρά, `delete` όπου όχι. **Κανένας μετρητής**: το badge είναι
 * το πλήθος των γραμμών, άρα δεν υπάρχει άθροισμα που να αποκλίνει. Κάθε γραφή εξαρτάται **μόνο** από την αλήθεια
 * ⇒ ιδεμποτής χωρίς να διαβάσει την προηγούμενη κατάσταση της γραμμής (N.7.2 #3).
 * ⚠️ Γραφή, άρα καλείται **μετά** από κάθε ανάγνωση της συναλλαγής.
 */
export function writeInboxVerdicts(
  transaction: Transaction,
  rowOf: InboxRowOf,
  verdicts: readonly InboxVerdict[],
): void {
  for (const verdict of verdicts) {
    const row = rowOf(verdict.uid);
    if (verdict.liveMessageAt === null) transaction.delete(row);
    else transaction.set(row, { liveMessageAt: verdict.liveMessageAt } satisfies NetworkInboxUnreadRow);
  }
}

/**
 * Οι ετυμηγορίες της **προβολής**: μόνο για όσους άλλαξε η ζωντάνια της θέσης. Σφραγίδα ⇒ καμία γραμμή· είσοδος ή
 * επιστροφή ⇒ η κρίση με την ιδιωτική πλευρά που επιβίωσε (νέος χωρίς ιδιωτικό έγγραφο ⇒ «δεν διάβασε ποτέ»).
 * Η αλλαγή ρόλου **δεν** αγγίζει το αδιάβαστο — καμία γραφή.
 */
function projectionVerdicts(slot: ActThreadSlot, writes: readonly AudienceWrite[]): readonly InboxVerdict[] {
  if (slot.liveness === null) return [];
  const privateOf = new Map(slot.audience.map((seat) => [seat.uid, seat]));
  const moved = writes.filter((write) => write.change !== 'role-changed');
  return inboxVerdictsOf(
    moved.map((write) => ({ ...networkAudiencePrivateFromDocument(privateOf.get(write.uid)), uid: write.uid, until: write.entry.until })),
    slot.liveness,
  );
}

export type InboxReconcileOutcome = 'unread' | 'clear';

/**
 * 🛟 **ΤΟ ΔΙΧΤΥ (N.7.2 #4)** — ξαναγράφει τη γραμμή ενός ανθρώπου για ένα νήμα από την **αλήθεια** (νήμα + θέση),
 * σε δική της συναλλαγή. Ιδεμποτής: δεύτερη κλήση = ίδιο αποτέλεσμα. Τη ζητά η συμφιλίωση
 * (`scripts/migrations/reconcile-network-inbox.ts`) — ο μετανάστης **ζητά**, δεν γράφει (CHECK 3.89 Κ3).
 */
export async function reconcileInboxSeat(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
): Promise<InboxReconcileOutcome> {
  return adminDb.runTransaction(async (transaction) => {
    const [threadSnap, seatSnap, privateSnap] = await transaction.getAll(
      networkThreadRef(adminDb, threadId),
      networkAudienceRef(adminDb, threadId, uid),
      networkAudiencePrivateRef(adminDb, threadId, uid),
    );
    const thread = threadSnap?.data() as NetworkThread | undefined;
    const entry = seatSnap?.data() as NetworkAudienceEntry | undefined;
    // Νήμα ή θέση που δεν υπάρχει ⇒ καμία γραμμή (ορφανή γραμμή = ψέμα στο badge).
    const verdicts: readonly InboxVerdict[] = thread === undefined || entry === undefined
      ? [{ uid, liveMessageAt: null }]
      : inboxVerdictsOf([{ ...networkAudiencePrivateFromDocument(privateSnap?.data()), uid, until: entry.until }], thread);
    writeInboxVerdicts(transaction, (who) => networkInboxRowRef(adminDb, who, threadId), verdicts);
    return verdicts.some((verdict) => verdict.liveMessageAt !== null) ? 'unread' : 'clear';
  });
}

// =============================================================================
// Η ΙΔΙΩΤΙΚΗ ΠΛΕΥΡΑ ΤΗΣ ΘΕΣΗΣ — ώρα ανάγνωσης, σίγαση, follow, ΑΠΟ ΤΟΝ ΙΔΙΟ ΓΡΑΦΕΑ (ADR-867 Β9(β) Ε9)
// =============================================================================

/**
 * Ό,τι επιτρέπεται να αλλάξει **ο ίδιος** — και ζει στο **ιδιωτικό** του έγγραφο, όχι στη δημόσια γραμμή.
 *
 * 🔑 **Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ, ΟΧΙ ΕΝΑΣ ΕΛΕΓΧΟΣ ΜΕΣΑ ΣΤΗ ΣΥΝΑΡΤΗΣΗ**: με ένα ανοιχτό
 * `Partial<NetworkAudienceEntry>` η **ίδια** διαδρομή θα μπορούσε να γράψει `until` — να
 * βγάλει δηλαδή άνθρωπο από το νήμα με το πρόσχημα «σημείωσα ότι το διάβασα».
 */
export type AudienceSelfPatch =
  | { readonly lastReadAt: string }
  | { readonly muted: boolean }
  | { readonly following: boolean };

export type AudienceSelfOutcome = 'updated' | 'not-audience';

/**
 * **Ο άνθρωπος αγγίζει τη ΔΙΚΗ του ιδιωτική πλευρά** — και μόνο αν **διαβάζει τώρα**.
 *
 * 🔑 Η **δημόσια** γραμμή διαβάζεται (είναι η απάντηση στο «διαβάζει;») αλλά **δεν** γράφεται: η γραφή πάει
 * στο ιδιωτικό έγγραφο, που η άλλη πλευρά δεν βλέπει (Ε9). `set` με `merge`: το έγγραφο γεννιέται με την
 * **πρώτη** πράξη του ανθρώπου, και ένα πεδίο δεν σβήνει τα άλλα. ⚠️ Το `set` εδώ **δεν** γεννά ακροατήριο —
 * το ιδιωτικό έγγραφο δεν απαντά ποτέ «ποιος διαβάζει», και ο φρουρός της ζωντανής γραμμής προηγείται.
 */
export async function touchOwnAudience(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
  patch: AudienceSelfPatch,
): Promise<AudienceSelfOutcome> {
  const privateRef = networkAudiencePrivateRef(adminDb, threadId, uid);
  return adminDb.runTransaction(async (transaction) => {
    // 🔢 Β10: νήμα + ιδιωτική πλευρά διαβάζονται μαζί με τη θέση — η γραμμή αδιάβαστων κρίνεται με το patch εφαρμοσμένο.
    const [seatSnap, threadSnap, privateSnap] = await transaction.getAll(
      networkAudienceRef(adminDb, threadId, uid),
      networkThreadRef(adminDb, threadId),
      privateRef,
    );
    const entry = seatSnap?.data() as NetworkAudienceEntry | undefined;
    if (entry === undefined || entry.until !== null) return 'not-audience';
    transaction.set(privateRef, patch, { merge: true });
    const thread = threadSnap?.data() as NetworkThread | undefined;
    if (thread !== undefined && touchesUnread(patch)) {
      const after = { ...networkAudiencePrivateFromDocument(privateSnap?.data()), ...patch, uid, until: entry.until };
      writeInboxVerdicts(transaction, (who) => networkInboxRowRef(adminDb, who, threadId), inboxVerdictsOf([after], thread));
    }
    return 'updated';
  });
}

/** Το `following` ορίζει ειδοποιήσεις, όχι αδιάβαστο — καμία γραφή στο κουτί. */
function touchesUnread(patch: AudienceSelfPatch): boolean {
  return 'lastReadAt' in patch || 'muted' in patch;
}

export type LegacyPrivateMove = 'moved' | 'clean' | 'absent';

/**
 * 🔁 **Η ΜΕΤΑΚΙΝΗΣΗ ΤΟΥ ΠΑΛΙΟΥ ΣΧΗΜΑΤΟΣ** (ADR-867 Β9(β) Ε9 · contract) — τα ιδιωτικά πεδία φεύγουν από τη
 * δημόσια γραμμή και πάνε στο ιδιωτικό έγγραφο, **στην ίδια συναλλαγή**: ποτέ στιγμή όπου τα πεδία λείπουν
 * και από τα δύο, ποτέ στιγμή όπου η άλλη πλευρά τα βλέπει ενώ ο άνθρωπος έχει ήδη ιδιωτικό έγγραφο.
 *
 * 🔑 **Ιδεμποτής**: δεύτερη κλήση βρίσκει καθαρή γραμμή ⇒ `clean`, καμία γραφή. Ό,τι λέει ήδη το ιδιωτικό
 * έγγραφο **νικά** (το έγραψε ο νέος κώδικας, άρα είναι νεότερο) — δες `legacyPrivateResidue`.
 * ⚠️ Εδώ και όχι στο script: είναι γραφή ακροατηρίου (CHECK 3.89 Κ3) — ο μετανάστης **ζητά**, δεν γράφει.
 */
export async function moveLegacyPrivateSeat(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
): Promise<LegacyPrivateMove> {
  const seatRef = networkAudienceRef(adminDb, threadId, uid);
  const privateRef = networkAudiencePrivateRef(adminDb, threadId, uid);
  return adminDb.runTransaction(async (transaction) => {
    const [seatSnap, privateSnap] = await transaction.getAll(seatRef, privateRef);
    const publicRaw = seatSnap?.data();
    if (publicRaw === undefined) return 'absent';
    const residue = legacyPrivateResidue(publicRaw, privateSnap?.data());
    if (residue === null) return 'clean';
    if (Object.keys(residue.carry).length > 0) transaction.set(privateRef, residue.carry, { merge: true });
    transaction.update(seatRef, Object.fromEntries(residue.strip.map((field) => [field, FieldValue.delete()])));
    return 'moved';
  });
}

/**
 * 🔑 **ΤΟ FAN-OUT ΤΟΥ ΜΗΝΥΜΑΤΟΣ** — κάθε **ζωντανή** γραμμή μαθαίνει ότι το νήμα κινήθηκε, και ο
 * **αποστολέας** ότι έχει διαβάσει ό,τι μόλις έγραψε. Στην **ίδια** συναλλαγή με το μήνυμα.
 *
 * ⚠️ **Γιατί εδώ και όχι στον γραφέα μηνυμάτων**: είναι γραφή **ακροατηρίου** (CHECK 3.89 Κ3).
 * ⚠️ **Μόνο ζωντανές γραμμές**: η σφραγισμένη δεν εμφανίζεται σε κατάλογο (το ερώτημα φιλτράρει
 * `until == null`), και η **επιστροφή** την ξαναγράφει με τη δραστηριότητα της στιγμής.
 * ⚠️ Στη **δημόσια** γραμμή `update`, **ποτέ** `set`: το `set` θα **γεννούσε** γραμμή — δηλαδή ακροατήριο.
 * 🔒 Το `lastReadAt` του αποστολέα πάει στο **ιδιωτικό** του έγγραφο (Ε9): αλλιώς η άλλη πλευρά θα έβλεπε
 * «διάβασε ως τις 14:32» σε κάθε μήνυμα που στέλνει.
 *
 * 🔑 **Ο αποστολέας δεν γίνεται «αδιάβαστο» από το δικό του μήνυμα** (Slack/Teams: η αποστολή
 * σημαίνει και ανάγνωση ως εκεί). Χωρίς αυτό, κάθε νήμα όπου μίλησε τελευταίος θα φαινόταν έντονο.
 *
 * Το κόστος είναι **1 γραφή ανά ζωντανό μέλος** — ομάδα πράξης + αντισυμβαλλόμενος, μονοψήφιο
 * πλήθος. Το αντίθετο (ταξινόμηση κατά την ανάγνωση) κοστίζει **κάθε** φορά που ανοίγει ο κατάλογος.
 */
export function writeThreadActivity(
  transaction: Transaction,
  adminDb: AdminFirestore,
  threadId: string,
  audience: readonly NetworkAudienceSeat[],
  activity: { readonly senderUid: string; readonly nowISO: string },
): void {
  const live = audience.filter((entry) => entry.until === null);
  for (const entry of live) {
    transaction.update(networkAudienceRef(adminDb, threadId, entry.uid), { threadActivityAt: activity.nowISO });
    if (entry.uid === activity.senderUid) {
      transaction.set(networkAudiencePrivateRef(adminDb, threadId, entry.uid), { lastReadAt: activity.nowISO }, { merge: true });
    }
  }
  // 🔢 Β10: το νέο μήνυμα είναι το τελευταίο ζωντανό· ο αποστολέας το «διάβασε» γράφοντάς το.
  const seats = live.map((seat) => (seat.uid === activity.senderUid ? { ...seat, lastReadAt: activity.nowISO } : seat));
  writeThreadInbox(transaction, adminDb, threadId, seats, { lastMessageAt: activity.nowISO, lastLiveMessageAt: activity.nowISO });
}

/**
 * 🔢 **Το κουτί ΟΛΟΥ του ακροατηρίου ενός νήματος, μετά από αλλαγή της ζωντάνιας του** (ADR-867 §4.5 · Β10) —
 * η αποστολή (από εδώ) και η **ανάκληση** (`thread-messages.ts`, που δεν επιτρέπεται να γράψει κουτί — Κ3).
 * Οι σφραγισμένες θέσεις παίρνουν `delete`: ιδεμποτές, και καθαρίζει ό,τι τυχόν έμεινε από πριν.
 */
export function writeThreadInbox(
  transaction: Transaction,
  adminDb: AdminFirestore,
  threadId: string,
  seats: readonly NetworkAudienceSeat[],
  liveness: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'>,
): void {
  writeInboxVerdicts(transaction, (uid) => networkInboxRowRef(adminDb, uid, threadId), inboxVerdictsOf(seats, liveness));
}

/**
 * **ΟΛΟ το ακροατήριο, με την ιδιωτική πλευρά κάθε θέσης** — για την ερώτηση *«το πρόλαβε κάποιος;»* της
 * ανάκλησης/επεξεργασίας και για τον σχεδιασμό ειδοποιήσεων της αποστολής. ⚠️ Οι θέσεις (`NetworkAudienceSeat`)
 * μένουν στον διακομιστή: **καμία** απάντηση προς πελάτη δεν τις σερβίρει.
 *
 * ⚠️ Επιστρέφει **και τα σφραγισμένα** μέλη, επίτηδες: κάποιος που έφυγε από την ομάδα
 * **αφού** διάβασε το μήνυμα, **το διάβασε**. Η σφραγίδα αφαιρεί μελλοντική πρόσβαση —
 * δεν ξεγράφει το παρελθόν, και μια ανάκληση που το αγνοούσε θα έλεγε ψέματα στον
 * αποστελέα ακριβώς εκεί που μετράει.
 */
export async function readThreadAudience(
  transaction: Transaction,
  adminDb: AdminFirestore,
  threadId: string,
): Promise<readonly NetworkAudienceSeat[]> {
  const snapshot = await transaction.get(networkThreadAudience(adminDb, threadId));
  return seatsOfThread((...refs) => transaction.getAll(...refs), adminDb, threadId, snapshot.docs);
}
