/**
 * @fileoverview **«ΠΟΙΟΙ ΔΙΑΒΑΖΟΥΝ»** — καθαρός πυρήνας της λίστας ακροατηρίου, **μηδέν** I/O.
 * @related ADR-834 §5 Β (γ) ③ *(πάντα ορατό)* · (ε) 🏆 *(ζωντανή, με «από πότε»)* · ADR-867 §4.2
 * @module lib/network-messaging/audience-roster
 *
 * 🏆 **Η ΔΙΑΦΑΝΕΙΑ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΔΙΝΕΙ** (Front/Intercom/HubSpot/Zendesk/Teams): ο αποστολέας βλέπει
 * **ποιοι** διαβάζουν, με **ποιον ρόλο** και **από πότε** — και **ποιοι διάβαζαν** ως πότε. Η έξοδος
 * **σφραγίζεται**, δεν σβήνεται (§4.2), άρα και η οθόνη τη δείχνει: κάποιος που έφυγε **είχε** δει ό,τι
 * γράφτηκε ως τότε, και ο άλλος το δικαιούται να το ξέρει.
 *
 * 🔑 **Οι πλευρές λέγονται ΣΧΕΤΙΚΑ με τον θεατή** («η πλευρά σας» / «η άλλη πλευρά»), ποτέ `host`/
 * `counterpart`: ο ιδιοκτήτης δεν ξέρει ότι είναι «αντισυμβαλλόμενος» — ξέρει ότι είναι **αυτός**.
 * Στο νήμα **σχέσης** κάθε πρόσωπο είναι πλευρά μόνο του και το νήμα είναι **προσωπικό** (γ) ②.
 *
 * 🔑 **ΜΙΑ ΘΕΣΗ, ΔΥΟ ΙΔΙΟΤΗΤΕΣ, ΔΗΛΩΜΕΝΕΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** (ADR-867 Β9 · NAR Άρθρο 4): ο ιδιοκτήτης
 * που είναι **και** μέλος της ομάδας (`alsoHostRole`) εμφανίζεται στη θέση του **και** ως **είδωλο** στην
 * πλευρά του γραφείου (`mirror`). Αλλιώς η πλευρά του γραφείου θα φαινόταν **άδεια** ενώ διαβάζει
 * κάποιος — και το ιδιοκτησιακό συμφέρον του μεσίτη δεν θα το έβλεπε κανείς.
 */

import type {
  NetworkAudienceEntry,
  NetworkAudienceRole,
  NetworkAudienceSide,
  NetworkHostRole,
  NetworkThreadKind,
} from '@/types/network-thread';

/** Η σειρά εμφάνισης ρόλων — ο **υπεύθυνος** πρώτος (σε αυτόν γράφει ο άλλος, ADR-834 (ε) ①). */
const ROLE_ORDER: Readonly<Record<NetworkAudienceRole, number>> = {
  responsible: 0,
  counterpart: 1,
  person: 2,
  collaborator: 3,
};

export type RosterSideRelation = 'mine' | 'theirs';

export interface RosterMember {
  /** Μοναδικό ανά **θητεία** — το ίδιο πρόσωπο εμφανίζεται μία φορά ανά διάστημα που διάβαζε (Ε8). */
  readonly key: string;
  readonly uid: string;
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceEntry['reason'];
  readonly since: string;
  /** `null` ⇒ διαβάζει **τώρα**. */
  readonly until: string | null;
  readonly isViewer: boolean;
  /** Η **δεύτερη** ιδιότητα του ιδιοκτήτη στο γραφείο — `null` ⇒ μία ιδιότητα. */
  readonly alsoHostRole: NetworkHostRole | null;
  /** `true` ⇒ η γραμμή είναι το **είδωλο** του ιδιοκτήτη στην πλευρά του γραφείου, όχι δεύτερο πρόσωπο. */
  readonly mirror: boolean;
}

export interface RosterSide {
  readonly relation: RosterSideRelation;
  readonly current: readonly RosterMember[];
  /**
   * Οι θητείες που **έληξαν** — πιο πρόσφατη έξοδος πρώτη. Ένα πρόσωπο που ξαναμπήκε εμφανίζεται **και**
   * εδώ (με το παλιό διάστημα) **και** στους τρέχοντες (ADR-867 Β9(β) Ε8).
   */
  readonly past: readonly RosterMember[];
  /** Παλαιότερες θητείες που δεν κρατιούνται ονομαστικά (όριο ανά γραμμή) — λέγονται, δεν κρύβονται. */
  readonly pastOmitted: number;
}

export interface AudienceRoster {
  /** `true` ⇒ νήμα **σχέσης**: η οθόνη λέει «προσωπικό», όχι «ομάδα». */
  readonly personal: boolean;
  /** `true` ⇒ ο θεατής είναι το **μόνο** πρόσωπο που διαβάζει (Teams «συνομιλία με τον εαυτό σου»). */
  readonly solo: boolean;
  /** Πρώτα η **άλλη** πλευρά (σε αυτήν γράφω), μετά η δική μου. Άδεια πλευρά ⇒ λείπει. */
  readonly sides: readonly RosterSide[];
}

/** Μια γραμμή της λίστας: η γραμμή ακροατηρίου **ή** το είδωλό της στην πλευρά του γραφείου. */
interface RosterRow {
  readonly entry: NetworkAudienceEntry;
  readonly side: NetworkAudienceSide;
  readonly mirror: boolean;
}

function memberOf(row: RosterRow, viewerUid: string): RosterMember {
  const { entry, mirror } = row;
  return {
    key: `${entry.uid}:${mirror ? 'mirror' : 'seat'}:${entry.since}`,
    uid: entry.uid,
    role: mirror && entry.alsoHostRole !== null ? entry.alsoHostRole : entry.role,
    reason: entry.reason,
    since: entry.since,
    until: entry.until,
    isViewer: entry.uid === viewerUid,
    alsoHostRole: mirror ? null : entry.alsoHostRole,
    mirror,
  };
}

/** Κάθε γραμμή στη θέση της + το είδωλο κάθε ιδιοκτήτη που είναι **και** μέλος του γραφείου. */
function rowsOf(audience: readonly NetworkAudienceEntry[]): readonly RosterRow[] {
  const own = audience.map((entry) => ({ entry, side: entry.side, mirror: false }));
  const mirrors = audience
    .filter((entry) => entry.side === 'counterpart' && entry.alsoHostRole !== null)
    .map((entry) => ({ entry, side: 'host' as const, mirror: true }));
  return [...own, ...mirrors];
}

/** Οι **προηγούμενες** θητείες μιας γραμμής, ως μέλη — με τον ρόλο και τον λόγο **εκείνης** της θητείας. */
function earlierMembersOf(row: RosterRow, viewerUid: string): readonly RosterMember[] {
  if (row.mirror) return [];
  const { entry } = row;
  return entry.tenureHistory.earlier.map((tenure) => ({
    key: `${entry.uid}:tenure:${tenure.since}`,
    uid: entry.uid,
    role: tenure.role,
    reason: tenure.reason,
    since: tenure.since,
    until: tenure.until,
    isViewer: entry.uid === viewerUid,
    alsoHostRole: null,
    mirror: false,
  }));
}

function byRoleThenSince(a: RosterMember, b: RosterMember): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.since.localeCompare(b.since) || a.uid.localeCompare(b.uid);
}

function byLatestExit(a: RosterMember, b: RosterMember): number {
  return (b.until ?? '').localeCompare(a.until ?? '') || a.uid.localeCompare(b.uid);
}

function sideOf(
  rows: readonly RosterRow[],
  relation: RosterSideRelation,
  viewerUid: string,
): RosterSide {
  const members = rows.map((row) => memberOf(row, viewerUid));
  const earlier = rows.flatMap((row) => earlierMembersOf(row, viewerUid));
  return {
    relation,
    current: members.filter((m) => m.until === null).sort(byRoleThenSince),
    past: [...members.filter((m) => m.until !== null), ...earlier].sort(byLatestExit),
    pastOmitted: rows.reduce((sum, row) => sum + (row.mirror ? 0 : row.entry.tenureHistory.omitted), 0),
  };
}

/**
 * **Το ακροατήριο ⇒ η λίστα όπως τη βλέπει ο θεατής.**
 *
 * ⚠️ **Θεατής χωρίς γραμμή** (δεν συμβαίνει — ο κανόνας δεν θα του έδινε καν το ακροατήριο) ⇒ κάθε
 * πλευρά λογίζεται «άλλη»: ποτέ μαντεψιά ότι κάποια είναι «δική του».
 */
export function buildAudienceRoster(
  audience: readonly NetworkAudienceEntry[],
  viewerUid: string,
  threadKind: NetworkThreadKind,
): AudienceRoster {
  const viewerSide: NetworkAudienceSide | null = audience.find((e) => e.uid === viewerUid)?.side ?? null;
  const rows = threadKind === 'relationship'
    ? audience.map((entry) => ({ entry, side: entry.side, mirror: false }))
    : rowsOf(audience);
  const isMine = (row: RosterRow) =>
    threadKind === 'relationship' ? row.entry.uid === viewerUid : row.side === viewerSide;

  const theirs = sideOf(rows.filter((row) => !isMine(row)), 'theirs', viewerUid);
  const mine = sideOf(rows.filter(isMine), 'mine', viewerUid);
  const sides = [theirs, mine].filter((side) => side.current.length + side.past.length + side.pastOmitted > 0);
  const live = new Set(audience.filter((entry) => entry.until === null).map((entry) => entry.uid));
  return {
    personal: threadKind === 'relationship',
    solo: live.size === 1 && live.has(viewerUid),
    sides,
  };
}

/** Όλα τα πρόσωπα που **ονομάζει** η οθόνη — για **μία** ερώτηση ονομάτων (ταξινομημένα, χωρίς διπλά). */
export function rosterUids(audience: readonly NetworkAudienceEntry[]): readonly string[] {
  return [...new Set(audience.map((entry) => entry.uid))].sort();
}
