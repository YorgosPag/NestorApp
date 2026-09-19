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
 * σίγαση. Το επιβάλλει το **Κ3** του CHECK 3.89. Ο λόγος δεν είναι καθαρότητα: το ίδιο
 * έγγραφο απαντά *«ποιος διαβάζει;»* **και** στον κανόνα Firestore· ένας δεύτερος γραφέας
 * που «απλώς ενημερώνει την ώρα ανάγνωσης» μπορεί να γράψει `until` με ένα `set` χωρίς
 * merge — δηλαδή να **βγάλει άνθρωπο από το νήμα** κατά λάθος.
 */

import 'server-only';

import type {
  CollectionReference,
  DocumentReference,
  Firestore as AdminFirestore,
  Transaction,
} from 'firebase-admin/firestore';

import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import type {
  NetworkAudienceEntry,
  NetworkAudienceReason,
  NetworkThread,
  NetworkThreadTopic,
} from '@/types/network-thread';

import {
  networkAudienceRef,
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
  readonly audience: readonly NetworkAudienceEntry[];
  /** `lastMessageAt ?? createdAt` του **υπάρχοντος** νήματος· `null` ⇒ δεν υπάρχει ακόμη. */
  readonly activityAt: string | null;
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
    audience: audienceSnap.docs.map((doc) => doc.data() as NetworkAudienceEntry),
    activityAt: stored === undefined ? null : threadActivityOf(stored),
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
    existing: slot.audience,
    newcomerReason: plan.newcomerReason,
    addedBy: plan.addedBy,
    nowISO: plan.nowISO,
    threadActivityAt: slot.activityAt ?? threadActivityOf(document),
  });

  for (const write of audienceWrites) {
    transaction.set(slot.audienceRef.doc(write.uid), write.entry);
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
// Η ΔΙΚΗ ΤΟΥ ΓΡΑΜΜΗ — ώρα ανάγνωσης και σίγαση, ΑΠΟ ΤΟΝ ΙΔΙΟ ΓΡΑΦΕΑ
// =============================================================================

/**
 * Ό,τι επιτρέπεται να αλλάξει **ο ίδιος** πάνω στη γραμμή του.
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
 * **Ο άνθρωπος αγγίζει τη ΔΙΚΗ του γραμμή** — και μόνο αν **διαβάζει τώρα**.
 *
 * ⚠️ `update` και **ποτέ** `set`: το `set` σε ανύπαρκτη γραμμή θα **δημιουργούσε
 * ακροατήριο** — δηλαδή θα έβαζε στο νήμα όποιον ζητήσει «σημείωσε ότι το διάβασα».
 */
export async function touchOwnAudience(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
  patch: AudienceSelfPatch,
): Promise<AudienceSelfOutcome> {
  const ref = networkAudienceRef(adminDb, threadId, uid);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const entry = snapshot.data() as NetworkAudienceEntry | undefined;
    if (entry === undefined || entry.until !== null) return 'not-audience';
    transaction.update(ref, patch);
    return 'updated';
  });
}

/**
 * 🔑 **ΤΟ FAN-OUT ΤΟΥ ΜΗΝΥΜΑΤΟΣ** — κάθε **ζωντανή** γραμμή μαθαίνει ότι το νήμα κινήθηκε, και ο
 * **αποστολέας** ότι έχει διαβάσει ό,τι μόλις έγραψε. Στην **ίδια** συναλλαγή με το μήνυμα.
 *
 * ⚠️ **Γιατί εδώ και όχι στον γραφέα μηνυμάτων**: είναι γραφή **ακροατηρίου** (CHECK 3.89 Κ3).
 * ⚠️ **Μόνο ζωντανές γραμμές**: η σφραγισμένη δεν εμφανίζεται σε κατάλογο (το ερώτημα φιλτράρει
 * `until == null`), και η **επιστροφή** την ξαναγράφει με τη δραστηριότητα της στιγμής.
 * ⚠️ `update`, **ποτέ** `set`: το `set` θα έσβηνε `lastReadAt`/`muted` — ή θα **γεννούσε** γραμμή.
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
  audience: readonly NetworkAudienceEntry[],
  activity: { readonly senderUid: string; readonly nowISO: string },
): void {
  for (const entry of audience) {
    if (entry.until !== null) continue;
    const patch = entry.uid === activity.senderUid
      ? { threadActivityAt: activity.nowISO, lastReadAt: activity.nowISO }
      : { threadActivityAt: activity.nowISO };
    transaction.update(networkAudienceRef(adminDb, threadId, entry.uid), patch);
  }
}

/**
 * **ΟΛΟ το ακροατήριο** — για την ερώτηση *«το πρόλαβε κάποιος;»* της ανάκλησης.
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
): Promise<readonly NetworkAudienceEntry[]> {
  const snapshot = await transaction.get(networkThreadAudience(adminDb, threadId));
  return snapshot.docs.map((doc) => doc.data() as NetworkAudienceEntry);
}
