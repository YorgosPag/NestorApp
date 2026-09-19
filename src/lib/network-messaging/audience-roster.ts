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
 */

import type {
  NetworkAudienceEntry,
  NetworkAudienceRole,
  NetworkAudienceSide,
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
  readonly uid: string;
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceEntry['reason'];
  readonly since: string;
  /** `null` ⇒ διαβάζει **τώρα**. */
  readonly until: string | null;
  readonly isViewer: boolean;
}

export interface RosterSide {
  readonly relation: RosterSideRelation;
  readonly current: readonly RosterMember[];
  /** Όσοι **διάβαζαν** και σφραγίστηκαν — πιο πρόσφατη έξοδος πρώτη. */
  readonly past: readonly RosterMember[];
}

export interface AudienceRoster {
  /** `true` ⇒ νήμα **σχέσης**: η οθόνη λέει «προσωπικό», όχι «ομάδα». */
  readonly personal: boolean;
  /** Πρώτα η **άλλη** πλευρά (σε αυτήν γράφω), μετά η δική μου. Άδεια πλευρά ⇒ λείπει. */
  readonly sides: readonly RosterSide[];
}

function memberOf(entry: NetworkAudienceEntry, viewerUid: string): RosterMember {
  return {
    uid: entry.uid,
    role: entry.role,
    reason: entry.reason,
    since: entry.since,
    until: entry.until,
    isViewer: entry.uid === viewerUid,
  };
}

function byRoleThenSince(a: RosterMember, b: RosterMember): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.since.localeCompare(b.since) || a.uid.localeCompare(b.uid);
}

function byLatestExit(a: RosterMember, b: RosterMember): number {
  return (b.until ?? '').localeCompare(a.until ?? '') || a.uid.localeCompare(b.uid);
}

function sideOf(
  entries: readonly NetworkAudienceEntry[],
  relation: RosterSideRelation,
  viewerUid: string,
): RosterSide {
  const members = entries.map((entry) => memberOf(entry, viewerUid));
  return {
    relation,
    current: members.filter((m) => m.until === null).sort(byRoleThenSince),
    past: members.filter((m) => m.until !== null).sort(byLatestExit),
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
  const isMine = (entry: NetworkAudienceEntry) =>
    threadKind === 'relationship' ? entry.uid === viewerUid : entry.side === viewerSide;

  const theirs = sideOf(audience.filter((e) => !isMine(e)), 'theirs', viewerUid);
  const mine = sideOf(audience.filter(isMine), 'mine', viewerUid);
  const sides = [theirs, mine].filter((side) => side.current.length + side.past.length > 0);
  return { personal: threadKind === 'relationship', sides };
}

/** Όλα τα πρόσωπα που **ονομάζει** η οθόνη — για **μία** ερώτηση ονομάτων (ταξινομημένα, χωρίς διπλά). */
export function rosterUids(audience: readonly NetworkAudienceEntry[]): readonly string[] {
  return [...new Set(audience.map((entry) => entry.uid))].sort();
}
