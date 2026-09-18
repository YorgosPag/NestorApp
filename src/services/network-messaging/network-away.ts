/**
 * @fileoverview **Η ΑΠΟΥΣΙΑ ΩΣ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΩΣ ΕΦΑΡΜΟΓΗ** — «ο Κώστας απουσιάζει ως 24/9 —
 * διαβάζει η Ελένη» (ADR-834 §5 Β (ε) 🏆 · ADR-867 §4.4 · Β5).
 * @module services/network-messaging/network-away
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΚΑΙ ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Τι κάνει | Τι λείπει |
 * |---|---|---|
 * | Outlook «Automatic replies» | **προγραμματισμένη** έναρξη/λήξη | ο αποστολέας παίρνει κείμενο, όχι **ποιος απαντά** |
 * | Intercom «Away mode» | διακόπτης + ανάθεση | κανένα ημερολόγιο· ο πελάτης δεν μαθαίνει τίποτα |
 * | Zendesk OOO | ημερομηνίες | μόνο για **νέα** tickets |
 * | Follow Up Boss «Pause Leads» | παύση νέων leads | τα **ανοιχτά** νήματα μένουν ορφανά |
 *
 * ⇒ Εδώ: **έναρξη + λήξη** (Outlook), η άλλη πλευρά βλέπει **ποιος διαβάζει στη θέση του**
 * (κανείς από τους τέσσερις), και ισχύει για **όλα** τα νήματα, παλιά και νέα.
 *
 * 🔒 **ΚΑΝΕΝΑ ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ, ΕΠΙΤΗΔΕΣ** (ΓΚΠΔ άρθρο 5 §1(γ) — ελαχιστοποίηση): το Outlook
 * ζητά μήνυμα, και οι άνθρωποι γράφουν «στο νοσοκομείο ως τις 24». Εδώ η άλλη πλευρά είναι
 * **ξένος χώρος** — μαθαίνει **μόνο** «ως πότε», ποτέ «γιατί».
 *
 * ⚠️ **Η απουσία ΔΕΝ είναι αποχώρηση.** Αποχώρηση = αναστολή ⇒ **μεταβίβαση** ευθύνης (Β3).
 * Απουσία = ο άνθρωπος **μένει** στην ομάδα και στο ακροατήριο· απλώς ο αντισυμβαλλόμενος
 * ξέρει ποιος απαντά ενδιάμεσα, και οι ειδοποιήσεις (Β6) πηγαίνουν στους υπόλοιπους.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicNetworkAwayId } from '@/services/enterprise-id.service';
import type { NetworkAudienceEntry, NetworkAudienceRole } from '@/types/network-thread';

import { networkThreadAudience } from './network-thread-ref';
import { isLiveAudience } from './thread-audience';

/**
 * **Ανώτατη διάρκεια.** Πέρα από έναν χρόνο δεν είναι «απουσία» — είναι **αποχώρηση**, και έχει
 * άλλη πράξη με άλλη συνέπεια (αναστολή ⇒ μεταβίβαση). Ένα όριο εδώ κρατά τις δύο πράξεις χωριστές.
 */
export const MAX_AWAY_DAYS = 365;
const DAY_MS = 86_400_000;

/** `network_away/{naway_*}` — **μία** δήλωση ανά πρόσωπο. */
export interface NetworkAway {
  readonly id: string;
  readonly uid: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly updatedAt: string;
}

export type AwayRefusal = 'invalid-dates' | 'ends-before-start' | 'already-ended' | 'too-long';

// =============================================================================
// ΚΑΘΑΡΑ ΚΟΜΜΑΤΙΑ
// =============================================================================

/** Η δήλωση στέκει; — ο **ένας** κριτής, για τη διαδρομή και για κάθε μελλοντικό δρόμο. */
export function judgeAway(input: {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly nowISO: string;
}): AwayRefusal | null {
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  const now = Date.parse(input.nowISO);
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(now)) return 'invalid-dates';
  if (end <= start) return 'ends-before-start';
  if (end <= now) return 'already-ended';
  if (end - Math.max(start, now) > MAX_AWAY_DAYS * DAY_MS) return 'too-long';
  return null;
}

/** **Λείπει τώρα;** — `[startsAt, endsAt)`, ίδιο διάστημα με κάθε ημερολόγιο. */
export function isAwayActive(away: Pick<NetworkAway, 'startsAt' | 'endsAt'> | null, nowISO: string): boolean {
  if (away === null) return false;
  const now = Date.parse(nowISO);
  return Date.parse(away.startsAt) <= now && now < Date.parse(away.endsAt);
}

/** Ένα μέλος που λείπει, όπως το βλέπει η άλλη πλευρά: **ρόλος** και **ως πότε** — τίποτα άλλο. */
export interface AwayMember {
  readonly uid: string;
  readonly role: NetworkAudienceRole;
  readonly until: string;
}

export interface ThreadPresence {
  readonly away: readonly AwayMember[];
  /**
   * 🏆 **Ποιος διαβάζει στη θέση τους** — τα ζωντανά μέλη της **ίδιας πλευράς** με όσους λείπουν,
   * που **δεν** λείπουν. Κενό ⇒ η οθόνη λέει την αλήθεια («κανείς ως τις …»), δεν την ωραιοποιεί.
   */
  readonly covering: readonly string[];
}

/** Ακροατήριο + δηλώσεις ⇒ παρουσία. Ο καλών **δεν** περιλαμβάνεται: δεν πληροφορείται για τον εαυτό του. */
export function presenceOf(
  audience: readonly NetworkAudienceEntry[],
  aways: ReadonlyMap<string, NetworkAway>,
  callerUid: string,
  nowISO: string,
): ThreadPresence {
  const live = audience.filter((entry) => isLiveAudience(entry));
  const isAway = (uid: string) => isAwayActive(aways.get(uid) ?? null, nowISO);
  const away: AwayMember[] = live.flatMap((entry) => {
    const record = aways.get(entry.uid) ?? null;
    return entry.uid !== callerUid && record !== null && isAwayActive(record, nowISO)
      ? [{ uid: entry.uid, role: entry.role, until: record.endsAt }]
      : [];
  });
  const awaySides = new Set(live.filter((entry) => away.some((a) => a.uid === entry.uid)).map((e) => e.side));
  const covering = live
    .filter((entry) => awaySides.has(entry.side) && !isAway(entry.uid))
    .map((entry) => entry.uid);
  return { away, covering };
}

// =============================================================================
// ΓΡΑΦΗ — ο ΕΝΑΣ γραφέας της συλλογής
// =============================================================================

function awayRef(adminDb: AdminFirestore, uid: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.NETWORK_AWAY).doc(generateDeterministicNetworkAwayId(uid));
}

/**
 * **Δήλωσε απουσία** (νέα ή αντικατάσταση της τρέχουσας) — ιδεμποτής: ίδια είσοδος ⇒ ίδιο έγγραφο.
 * ⚠️ `set` **χωρίς** merge επίτηδες: η δήλωση είναι **ολόκληρη** κάθε φορά — κανένα υπόλειμμα
 * προηγούμενης.
 */
export async function setNetworkAway(
  adminDb: AdminFirestore,
  input: { readonly uid: string; readonly startsAt: string; readonly endsAt: string; readonly nowISO: string },
): Promise<{ readonly kind: 'set'; readonly away: NetworkAway } | { readonly kind: 'refused'; readonly reason: AwayRefusal }> {
  const refusal = judgeAway(input);
  if (refusal !== null) return { kind: 'refused', reason: refusal };
  const away: NetworkAway = {
    id: generateDeterministicNetworkAwayId(input.uid),
    uid: input.uid,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    updatedAt: input.nowISO,
  };
  await awayRef(adminDb, input.uid).set(away);
  return { kind: 'set', away };
}

/**
 * **Γύρισα** — η απουσία **λήγει τώρα** (και μια προγραμματισμένη **ακυρώνεται**).
 * ⚠️ **Λήξη, όχι διαγραφή**: η ίδια πράξη ξαναγίνεται χωρίς σφάλμα (N.7.2 #3), και ένα μελλοντικό
 * «ποιος έλειπε όταν στάλθηκε;» (Β6) έχει τι να διαβάσει.
 */
export async function endNetworkAway(
  adminDb: AdminFirestore,
  uid: string,
  nowISO: string,
): Promise<'ended' | 'not-away'> {
  const ref = awayRef(adminDb, uid);
  return adminDb.runTransaction<'ended' | 'not-away'>(async (transaction) => {
    const away = ((await transaction.get(ref)).data() as NetworkAway | undefined) ?? null;
    if (away === null || Date.parse(away.endsAt) <= Date.parse(nowISO)) return 'not-away';
    const startsAt = Date.parse(away.startsAt) < Date.parse(nowISO) ? away.startsAt : nowISO;
    transaction.update(ref, { startsAt, endsAt: nowISO, updatedAt: nowISO });
    return 'ended';
  });
}

// =============================================================================
// ΑΝΑΓΝΩΣΗ
// =============================================================================

/** Η **δική μου** δήλωση — ισχύουσα ή προγραμματισμένη· `null` αν δεν υπάρχει ή έληξε. */
export async function readOwnAway(adminDb: AdminFirestore, uid: string, nowISO: string): Promise<NetworkAway | null> {
  const away = ((await awayRef(adminDb, uid).get()).data() as NetworkAway | undefined) ?? null;
  return away !== null && Date.parse(away.endsAt) > Date.parse(nowISO) ? away : null;
}

/**
 * 🔑 **Η παρουσία ενός νήματος**, για όποιον **διαβάζει ήδη** αυτό το νήμα — και για κανέναν άλλον.
 *
 * ⚠️ `not-audience` για ξένο **και** για ανύπαρκτο νήμα: η ίδια απάντηση (ADR-742). Αλλιώς η
 * διαδρομή θα έλεγε σε αγνώστους *«αυτό το νήμα υπάρχει, και ο Κώστας λείπει»*.
 */
export async function readThreadPresence(
  adminDb: AdminFirestore,
  threadId: string,
  callerUid: string,
  nowISO: string,
): Promise<{ readonly kind: 'ok'; readonly presence: ThreadPresence } | { readonly kind: 'not-audience' }> {
  const audience = (await networkThreadAudience(adminDb, threadId).get()).docs
    .map((doc) => doc.data() as NetworkAudienceEntry);
  if (!isLiveAudience(audience.find((entry) => entry.uid === callerUid))) return { kind: 'not-audience' };

  const others = audience.filter((entry) => isLiveAudience(entry) && entry.uid !== callerUid);
  const aways = await readAwaysOf(adminDb, others.map((entry) => entry.uid));
  return { kind: 'ok', presence: presenceOf(audience, aways, callerUid, nowISO) };
}

/**
 * **Οι δηλώσεις απουσίας πολλών προσώπων, με ΜΙΑ ανάγνωση** (`getAll`) — όσες υπάρχουν.
 *
 * 🔗 ADR-867 Β6 (N.0.2): τη ζητούν η **παρουσία** (ποιος λείπει), η **ειδοποίηση** (ποιος
 * αναπληρώνει) και η **πύλη του email** (λείπει ακόμη;). Ένας αναγνώστης, τρεις ερωτήσεις.
 */
export async function readAwaysOf(
  adminDb: AdminFirestore,
  uids: readonly string[],
): Promise<ReadonlyMap<string, NetworkAway>> {
  const aways = new Map<string, NetworkAway>();
  const unique = [...new Set(uids)];
  if (unique.length === 0) return aways;
  const snaps = await adminDb.getAll(...unique.map((uid) => awayRef(adminDb, uid)));
  snaps.forEach((snap) => {
    const away = snap.data() as NetworkAway | undefined;
    if (away !== undefined) aways.set(away.uid, away);
  });
  return aways;
}
