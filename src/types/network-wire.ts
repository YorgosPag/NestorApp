/**
 * @fileoverview **ΤΟ ΚΑΛΩΔΙΟ ΤΟΥ ΔΙΚΤΥΟΥ** — τα σχήματα των απαντήσεων των πορτών `app/api/network/**`.
 * @related ADR-867 Β5 (οι πόρτες) · Β7 (η οθόνη) · `types/network-thread.ts` (το μοντέλο)
 * @module types/network-wire
 *
 * 🔑 **ΕΝΑ σχήμα, ΔΥΟ άκρα**: η διαδρομή γράφει `NextResponse.json<NetworkXResult>(…)` και ο πελάτης
 * (`network-thread.client.ts`) διαβάζει **τον ίδιο** τύπο. Δύο χειρόγραφα αντίγραφα θα απέκλιναν την
 * ημέρα που προστεθεί πεδίο — και ο μεταγλωττιστής δεν θα το έβλεπε, γιατί το δίκτυο είναι `unknown`.
 * ⚠️ Ζει στους **τύπους**, όχι δίπλα στις διαδρομές: εκείνες είναι `server-only`.
 */

import type {
  NetworkActKind,
  NetworkAudienceRole,
  NetworkAudienceSide,
  NetworkHostRole,
  NetworkThreadState,
  NetworkThreadTopic,
} from './network-thread';

/** `POST …/messages` */
export interface NetworkSendResult {
  readonly success: true;
  readonly messageId: string;
}

/** `POST …/messages/{id}/retraction` — 🏆 «το πρόλαβε κάποιος;» */
export interface NetworkRetractionResult {
  readonly success: true;
  readonly readBeforeRetraction: boolean;
}

/** `PATCH …/messages/{id}` — ίδιο κείμενο ⇒ `edited: false` (ιδεμποτές). */
export type NetworkEditResult =
  | { readonly success: true; readonly edited: true; readonly editedAt: string; readonly readBeforeEdit: boolean }
  | { readonly success: true; readonly edited: false };

/** `POST …/read` */
export interface NetworkReadResult {
  readonly success: true;
  readonly lastReadAt: string;
}

/** Ένας απών — **μόνο** ρόλος και «ως πότε», ποτέ κείμενο (ΓΚΠΔ, ADR-867 §4.4). */
export interface NetworkAwayMember {
  readonly uid: string;
  readonly role: NetworkAudienceRole;
  readonly until: string;
}

/** `GET …/presence` — «ποιος λείπει ως πότε, ποιος διαβάζει στη θέση του». */
export interface NetworkPresenceResult {
  readonly success: true;
  readonly away: readonly NetworkAwayMember[];
  readonly covering: readonly string[];
}

/** Ένα πρόσωπο του ακροατηρίου — **κανένα** email (ΓΚΠΔ). */
export interface NetworkPerson {
  readonly uid: string;
  readonly name: string | null;
  readonly photoUrl: string | null;
}

/** `GET …/people` */
export interface NetworkPeopleResult {
  readonly success: true;
  readonly people: readonly NetworkPerson[];
  readonly hostName: string | null;
}

/** Η δική μου απουσία — **μόνο** ημερομηνίες. */
export interface NetworkAwayView {
  readonly startsAt: string;
  readonly endsAt: string;
}

/** `GET` / `PUT` / `DELETE …/away` */
export interface NetworkAwayResult {
  readonly success: true;
  readonly away: NetworkAwayView | null;
}

/** Η ομάδα της πράξης όπως τη βλέπει η οθόνη του γραφείου. */
export interface NetworkActTeamView {
  readonly id: string;
  readonly actKind: NetworkActKind;
  readonly responsibleUid: string;
  readonly memberUids: readonly string[];
  readonly version: number;
}

/**
 * `GET …/act-teams/{id}` — `canManage` = «δείξε «άλλαξε υπεύθυνο»» (ο κριτής ξαναρωτιέται στο PATCH).
 * `candidates` = τα **ενεργά** μέλη του γραφείου, με όνομα — από ποιους διαλέγει ο επιλογέας (Salesforce:
 * ο επιλογέας μελών ζει στην οθόνη της ομάδας). Μόνο για μέλος του **ίδιου** γραφείου (η πόρτα το κρίνει).
 */
export interface NetworkActTeamResult {
  readonly success: true;
  readonly team: NetworkActTeamView;
  readonly canManage: boolean;
  readonly candidates: readonly NetworkPerson[];
}

/** `PATCH …/act-teams/{id}` — `applied: false` ⇒ η ίδια αλλαγή είχε ήδη εφαρμοστεί. */
export type NetworkActTeamChangeResult =
  | {
      readonly success: true;
      readonly applied: true;
      readonly team: Pick<NetworkActTeamView, 'responsibleUid' | 'memberUids' | 'version'>;
    }
  | { readonly success: true; readonly applied: false };

// =============================================================================
// Ο ΚΑΤΑΛΟΓΟΣ ΝΗΜΑΤΩΝ (ADR-867 Β9β) — `GET /api/network/threads`
// =============================================================================

/**
 * Μία γραμμή του καταλόγου — ό,τι χρειάζεται η λίστα **χωρίς** να ανοίξει το νήμα.
 *
 * 🔑 **ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΚΑΤΑΛΟΓΟ**: το `services/network-messaging/thread-directory.ts` είναι
 * `server-only`, άρα ο πελάτης **δεν μπορεί** να εισαγάγει τύπο από εκεί. Ένα δεύτερο, χειρόγραφο
 * αντίγραφο θα απέκλινε την ημέρα που προστεθεί πεδίο, **αθόρυβα** — το δίκτυο είναι `unknown`.
 * Ο γραφέας (`directoryItem`) εισάγει **αυτόν** τον τύπο.
 */
export interface NetworkThreadListItem {
  readonly threadId: string;
  readonly topic: NetworkThreadTopic;
  readonly state: NetworkThreadState;
  readonly lastMessageAt: string | null;
  readonly activityAt: string;
  /** Υπάρχει μήνυμα **μετά** την τελευταία του ανάγνωση; (§8 #4 — όχι ένδειξη ανά μήνυμα.) */
  readonly unread: boolean;
  readonly muted: boolean;
  readonly role: NetworkAudienceRole;
  readonly side: NetworkAudienceSide;
  /**
   * 🔑 **ΜΙΑ ΘΕΣΗ, ΔΥΟ ΙΔΙΟΤΗΤΕΣ** (ADR-867 Β9 α) — ο ιδιοκτήτης που είναι **και** υπεύθυνος του
   * γραφείου. Ταξιδεύει ως τη **λίστα** επίτηδες: χωρίς αυτό, δύο γραμμές του ίδιου ανθρώπου
   * φαίνονται ταυτόσημες και το νήμα «με τον εαυτό σου» γίνεται δυσδιάκριτο.
   */
  readonly alsoHostRole: NetworkHostRole | null;
  /**
   * 🔑 **ΠΟΥ ΑΝΟΙΓΕΙ Η ΓΡΑΜΜΗ — Η ΣΥΝΟΜΙΛΙΑ, ΠΑΝΤΑ** (ADR-867 Β9γ).
   *
   * ⚠️ **Ήταν `string | null`**, και το `null` σήμαινε *«δεν υπάρχει οθόνη — νήμα σχέσης, Β8»*.
   * Το νήμα **απέκτησε διεύθυνση** (`threadHref`), οπότε το `null` δεν μπορεί πια να προκύψει: ο
   * ιδιωτικός χώρος ενός ανθρώπου υπάρχει πάντα. Ένας τύπος που επιτρέπει κατάσταση που **δεν
   * συμβαίνει** αναγκάζει κάθε αναγνώστη να γράψει κλάδο που δεν εκτελείται ποτέ — δηλαδή νεκρό
   * κώδικα με όψη προνοητικότητας.
   *
   * 🔑 Την απάντηση τη δίνει ο **διακομιστής** και όχι ο πελάτης, ακόμη κι όταν είναι απλή: η γραμμή
   * και η **ειδοποίηση** πρέπει να δείχνουν στο **ίδιο** σημείο, και αυτό εγγυάται μόνο μία πηγή
   * (`network-destination.ts`, ADR-749).
   */
  readonly href: string;
  /** Από πότε διαβάζει — η «ζωντανή διαφάνεια» του (ε) 🏆, και για τον ίδιο. */
  readonly since: string;
}

/** `GET /api/network/threads` — μία σελίδα· `next` = ο **αδιαφανής** δρομέας της επόμενης. */
export interface NetworkThreadDirectoryResult {
  readonly items: readonly NetworkThreadListItem[];
  readonly next: string | null;
}

/**
 * **ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΜΙΑΣ ΣΥΝΟΜΙΛΙΑΣ** — `GET /api/network/threads/{threadId}` (ADR-867 Β9γ).
 *
 * 🔑 Η συνομιλία έχει πλέον **δική της** διεύθυνση, άρα ο άνθρωπος φτάνει εκεί χωρίς να έχει δει τη
 * σελίδα της πράξης. Αυτό το σχήμα είναι ό,τι χρειάζεται η οθόνη **πέρα** από το ίδιο το νήμα:
 * ποια πλευρά είναι, ποια ομάδα διαχειρίζεται (αν διαχειρίζεται), και **για ποιο πράγμα** μιλάμε.
 *
 * ⚠️ **Δύο διαφορετικά `null`, και δεν συγχέονται**: `subjectTitle: null` ⇒ *«δεν ξέρω τι είναι»*
 * (νήμα σχέσης, ή αγγελία που δεν διαβάστηκε)· `subjectHref: null` ⇒ *«ξέρω, αλλά **δεν ανοίγει
 * από τον χώρο σου**»* — η οθόνη το **λέει** αντί να δώσει σύνδεσμο που απαντά 404 (ADR-848).
 */
export interface NetworkThreadContext {
  readonly side: NetworkAudienceSide;
  /** Η ομάδα της πράξης, **μόνο** για την πλευρά του γραφείου — ο ιδιοκτήτης δεν διαχειρίζεται ομάδα. */
  readonly teamId: string | null;
  readonly subjectTitle: string | null;
  readonly subjectHref: string | null;
}

/** `GET /api/network/threads/{threadId}` — η απάντηση της πόρτας. */
export type NetworkThreadContextResult = { readonly success: true } & NetworkThreadContext;
