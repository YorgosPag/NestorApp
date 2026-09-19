/**
 * @fileoverview **ΤΟ ΑΚΡΟΑΤΗΡΙΟ ΩΣ ΠΡΟΒΟΛΗ ΤΗΣ ΟΜΑΔΑΣ** — καθαρός πυρήνας, **μηδέν** I/O.
 * @related ADR-867 §4.2 · §4.3 · ADR-834 §5 Β (ε) ①-③ (🏆 «από πότε»)
 * @module services/network-messaging/thread-audience
 *
 * 🔑 **Το ακροατήριο ΔΕΝ δηλώνεται — ΠΑΡΑΓΕΤΑΙ** από την ομάδα της πράξης (SSoT, §4.3).
 * Αυτό το αρχείο απαντά *«δεδομένης της ομάδας **τώρα** και του ακροατηρίου **όπως είναι**,
 * ποιες γραφές χρειάζονται;»* — και τίποτα άλλο. Ο γραφέας
 * (`thread-writer.ts`) τις εκτελεί· ο κριτής της ακμής δεν εμπλέκεται καθόλου.
 *
 * 🏆 **Η ΕΞΟΔΟΣ ΣΦΡΑΓΙΖΕΤΑΙ, ΔΕΝ ΣΒΗΝΕΤΑΙ** (ADR-834 (ε) ③). Ένα `delete` θα έκανε το
 * «ποιος διάβαζε τον Μάρτιο;» **αναπάντητο** — και το νήμα σχέσης του Β8 **γεννιέται από
 * αυτό ακριβώς το ιστορικό**: «τα πρόσωπα που **υπήρξαν** ομάδα της πράξης». Σβησμένη
 * γραμμή δεν είναι «λιγότερα δεδομένα», είναι **σβησμένη σχέση**.
 *
 * 🔑 **ΙΔΕΜΠΟΤΗΣ ΕΞ ΟΡΙΣΜΟΥ** (N.7.2 #3): επιστρέφει **μόνο** ό,τι αλλάζει. Δεύτερη κλήση
 * με τις ίδιες εισόδους δίνει **κενό** — αλλιώς κάθε ανανέωση όρων θα ξανάγραφε το
 * `since` κάθε μέλους, δηλαδή η «ζωντανή διαφάνεια» θα έλεγε ότι μπήκαν **σήμερα**.
 */

import type {
  NetworkAudienceEntry,
  NetworkAudienceReason,
  NetworkAudienceRole,
  NetworkAudienceSide,
} from '@/types/network-thread';

/** Ό,τι χρειάζεται η προβολή από την ομάδα — **δομικός** τύπος, όχι το έγγραφο. */
export interface AudienceTeamSource {
  readonly responsibleUid: string;
  /** **Περιλαμβάνει** τον υπεύθυνο (μία λίστα — ADR-867 §4.3). */
  readonly memberUids: readonly string[];
}

export interface AudienceProjectionInput {
  readonly team: AudienceTeamSource;
  /** Το πρόσωπο της **άλλης** πλευράς. Χωρίς αυτό δεν υπάρχει νήμα (§8 #1). */
  readonly counterpartUid: string;
  /** Το ακροατήριο **όπως είναι τώρα** — ζωντανές **και** σφραγισμένες γραμμές. */
  readonly existing: readonly NetworkAudienceEntry[];
  /**
   * Ο λόγος για όποιον μπαίνει **σε αυτή** την πράξη: `creator` στη γέννηση,
   * `failover` στη μεταβίβαση, `admin-self` όταν μπαίνει μόνος του ο διαχειριστής.
   * ⚠️ Δεν μαντεύεται εδώ: **ο καλών ξέρει γιατί καλεί**.
   */
  readonly newcomerReason: NetworkAudienceReason;
  readonly addedBy: string;
  readonly nowISO: string;
  /**
   * Η δραστηριότητα του νήματος **τώρα** (`lastMessageAt ?? createdAt`) — ό,τι γράφεται στη
   * γραμμή όποιου **μπαίνει**, ώστε το νήμα να βρίσκει αμέσως τη θέση του στον κατάλογό του.
   */
  readonly threadActivityAt: string;
}

/** Τι άλλαξε — η ετικέτα υπάρχει για το **ίχνος** και για τις άγκυρες, όχι για τον κανόνα. */
export type AudienceChange = 'joined' | 'rejoined' | 'role-changed' | 'sealed';

/** Μία γραφή ανά `uid` — το έγγραφο **ολόκληρο**, ποτέ μπάλωμα πεδίων. */
export interface AudienceWrite {
  readonly uid: string;
  readonly entry: NetworkAudienceEntry;
  readonly change: AudienceChange;
}

/** Η θέση που **δικαιούται** κάποιος στο ακροατήριο αυτή τη στιγμή. */
interface Seat {
  readonly side: NetworkAudienceSide;
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceReason;
}

/**
 * **Ποιος δικαιούται θέση τώρα** — ο αντισυμβαλλόμενος πρώτος, ώστε να μην μπορεί
 * μια ανώμαλη ομάδα (ίδιο uid και στις δύο πλευρές) να τον κάνει «συνεργάτη του γραφείου».
 */
function seatsOf(input: AudienceProjectionInput): ReadonlyMap<string, Seat> {
  const seats = new Map<string, Seat>();
  seats.set(input.counterpartUid, {
    side: 'counterpart',
    role: 'counterpart',
    reason: 'counterpart',
  });

  for (const uid of input.team.memberUids) {
    if (seats.has(uid)) continue;
    seats.set(uid, {
      side: 'host',
      role: uid === input.team.responsibleUid ? 'responsible' : 'collaborator',
      reason: input.newcomerReason,
    });
  }
  return seats;
}

/** Η **νέα** γραμμή κάποιου που δεν είχε ποτέ θέση. */
function joined(uid: string, seat: Seat, input: AudienceProjectionInput): AudienceWrite {
  return {
    uid,
    change: 'joined',
    entry: {
      uid,
      side: seat.side,
      role: seat.role,
      reason: seat.reason,
      addedBy: input.addedBy,
      since: input.nowISO,
      until: null,
      lastReadAt: null,
      muted: false,
      following: false,
      threadActivityAt: input.threadActivityAt,
    },
  };
}

/**
 * **Η επιστροφή**: η σφραγίδα σπάει με **νέο** `since`.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: το έγγραφο κρατά τη **ΤΡΕΧΟΥΣΑ** θητεία, όχι όλες. Πλήρες
 * ιστορικό θητειών θα ήθελε δεύτερη υποσυλλογή· για το ερώτημα του Β8 *(«υπήρξε ποτέ
 * ομάδα;»)* αρκεί η **ύπαρξη** της γραμμής, που εδώ δεν χάνεται ποτέ.
 *
 * 🔑 `lastReadAt`, `muted` και `following` **επιβιώνουν**: είναι «τι έχει διαβάσει» και «τι θέλει να
 * ακούει» — δικά **του**, όχι της ομάδας. Ένα μηδένισμα θα του ξανάστελνε ειδοποιήσεις
 * που είχε σιγήσει ο ίδιος.
 */
function rejoined(
  previous: NetworkAudienceEntry,
  seat: Seat,
  input: AudienceProjectionInput,
): AudienceWrite {
  return {
    uid: previous.uid,
    change: 'rejoined',
    entry: {
      ...previous,
      side: seat.side,
      role: seat.role,
      reason: seat.reason,
      addedBy: input.addedBy,
      since: input.nowISO,
      until: null,
      // ⚠️ Όσο έλειπε, η γραμμή του **δεν** ενημερωνόταν (το fan-out αγγίζει μόνο ζωντανές).
      threadActivityAt: input.threadActivityAt,
    },
  };
}

/**
 * **Η αλλαγή ρόλου** — ο συνεργάτης έγινε υπεύθυνος (ή το αντίστροφο, μετά από
 * μεταβίβαση). Το `since` **μένει**: δεν μπήκε τώρα, **ανέβηκε** τώρα.
 */
function roleChanged(previous: NetworkAudienceEntry, seat: Seat): AudienceWrite {
  return {
    uid: previous.uid,
    change: 'role-changed',
    entry: { ...previous, role: seat.role, side: seat.side },
  };
}

/** **Η σφραγίδα** — η γραμμή μένει, το `until` απαντά «ως πότε διάβαζε». */
function sealed(previous: NetworkAudienceEntry, nowISO: string): AudienceWrite {
  return { uid: previous.uid, change: 'sealed', entry: { ...previous, until: nowISO } };
}

/**
 * 🔑 **Η προβολή**: ομάδα + αντισυμβαλλόμενος ⇒ ποιες γραμμές ακροατηρίου αλλάζουν.
 *
 * ⚠️ Επιστρέφει **μόνο τις διαφορές**. Κενός πίνακας σημαίνει *«το ακροατήριο ήδη λέει
 * την αλήθεια»* — και είναι η **συνηθισμένη** έκβαση, γι' αυτό δεν είναι σφάλμα.
 */
export function projectActAudience(
  input: AudienceProjectionInput,
): readonly AudienceWrite[] {
  const seats = seatsOf(input);
  const byUid = new Map(input.existing.map((entry) => [entry.uid, entry]));
  const writes: AudienceWrite[] = [];

  for (const [uid, seat] of seats) {
    const previous = byUid.get(uid);
    if (previous === undefined) writes.push(joined(uid, seat, input));
    else if (previous.until !== null) writes.push(rejoined(previous, seat, input));
    else if (previous.role !== seat.role || previous.side !== seat.side) {
      writes.push(roleChanged(previous, seat));
    }
  }

  // 🔴 Η **έξοδος**: ζωντανή γραμμή χωρίς θέση ⇒ σφραγίζεται. Ποτέ `delete` — δες κεφαλίδα.
  for (const entry of input.existing) {
    if (entry.until === null && !seats.has(entry.uid)) writes.push(sealed(entry, input.nowISO));
  }

  return writes;
}

/**
 * **Διαβάζει αυτός ΤΩΡΑ;** — η **ίδια** ερώτηση που κάνει ο κανόνας Firestore
 * (`exists(audience/{uid}) && until == null`), γραμμένη **μία** φορά για τον διακομιστή.
 *
 * ⚠️ Δύο διατυπώσεις της ίδιας ερώτησης είναι δύο απαντήσεις που θα αποκλίνουν. Ο κανόνας
 * δεν μπορεί να καλέσει αυτή τη συνάρτηση — γι' αυτό η **σουίτα των 35 κελιών** εκτελεί
 * τον κανόνα σε πραγματικό εξομοιωτή, και εδώ μένει η **μία** διατύπωση του κώδικα.
 */
export function isLiveAudience(entry: NetworkAudienceEntry | null | undefined): boolean {
  return entry !== null && entry !== undefined && entry.until === null;
}
