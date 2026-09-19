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

import type { NetworkActKind, NetworkAudienceRole } from './network-thread';

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
