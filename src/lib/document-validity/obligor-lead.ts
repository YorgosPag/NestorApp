/**
 * =============================================================================
 * Μητρώο λήξεων — Ο ΥΠΕΥΘΥΝΟΣ ενός ακινήτου με πολλούς ιδιοκτήτες (ADR-915 §26)
 * =============================================================================
 *
 * **«Πολλοί ιδιοκτήτες, ΕΝΑ ΠΕΑ — ποιον παίρνω τηλέφωνο;»** Το έγγραφο ακινήτου είναι **ένα** για όλο το ακίνητο· αν
 * το ζητήσει το γραφείο από όλους, θα βγάλουν τρία. Άρα **ένας** υπεύθυνος επικοινωνίας (Procore «Ball in Court» ·
 * Vanta «owner» · το έντυπο ΥΠΕΝ «υπεύθυνος επικοινωνίας»), οι υπόλοιποι συνιδιοκτήτες.
 *
 * Η αλυσίδα — κερδίζει ο **πρώτος έγκυρος** κρίκος (ίδιο δόγμα με το `expiry-alert-routing.ts`, που αφορά υπαλλήλους):
 *
 * | # | Βάση | Πότε |
 * |---|---|---|
 * | 1 | `explicit` | ρητή επιλογή του γραφείου — **μόνο** αν ο εκλεκτός είναι ακόμη ιδιοκτήτης |
 * | 2 | `sole` | ένας μόνο ιδιοκτήτης |
 * | 3 | `majority-share` | μερίδιο **> 50%** — ΑΚ 789: η τακτική διοίκηση του κοινού κρίνεται κατά **μερίδια** |
 * | 4 | `contract-principal` | ανοιχτή υπόθεση με **έναν** κύριο μεταβιβάζοντα (`capacity: 'principal'`) |
 * | – | `undesignated` | αλλιώς — με τον **λόγο**: `no-majority` (μερίδια γνωστά, κανείς > 50%) · `unknown-shares` |
 *
 * 🔑 **Ποτέ «ο πρώτος της λίστας»**: η σειρά των ιδιοκτητών είναι σειρά καταχώρισης, όχι απόφαση κανενός.
 * 🔑 **Ρητή επιλογή που έπαψε να ισχύει ΛΕΓΕΤΑΙ** (`staleContactId`): ο εκλεκτός πούλησε ⇒ η αλυσίδα συνεχίζει, και η
 *    οθόνη λέει ότι η παλιά επιλογή δεν μετρά — ποτέ σιωπηλή μεταφορά σε άλλον.
 * 🔑 Στο **50/50** δεν υπάρχει πλειοψηφία (ΑΚ 789): `no-majority`, όχι κλήρωση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/obligor-lead
 */

import { PCT_TOLERANCE } from '@/lib/ownership/owner-utils';

/** Οι βάσεις ορισμού, με τη σειρά της αλυσίδας. Κλειστό σύνολο. */
export const OBLIGOR_LEAD_BASES = ['explicit', 'sole', 'majority-share', 'contract-principal'] as const;
export type ObligorLeadBasis = (typeof OBLIGOR_LEAD_BASES)[number];

/** Γιατί **δεν** ορίζεται υπεύθυνος — κάθε λόγος λέει στον άνθρωπο κάτι διαφορετικό. */
export const OBLIGOR_UNDESIGNATED_REASONS = ['no-majority', 'unknown-shares'] as const;
export type ObligorUndesignatedReason = (typeof OBLIGOR_UNDESIGNATED_REASONS)[number];

/** Το μερίδιο που κάνει πλειοψηφία: **αυστηρά** πάνω από το μισό (ΑΚ 789). */
export const MAJORITY_SHARE_PCT = 50;

export type ObligorLead =
  | {
      readonly kind: 'designated';
      readonly contactId: string;
      readonly basis: ObligorLeadBasis;
      /** Το μερίδιο του υπευθύνου όταν είναι γνωστό (μόνο αγοραστές) — η οθόνη το λέει («πλειοψηφία 60%»). */
      readonly sharePct: number | null;
      /** Η ρητή επιλογή που **έπαψε** να ισχύει (ο εκλεκτός δεν είναι πια ιδιοκτήτης) — η οθόνη την ονομάζει. */
      readonly staleContactId: string | null;
    }
  | { readonly kind: 'undesignated'; readonly reason: ObligorUndesignatedReason; readonly staleContactId: string | null };

export interface ObligorLeadFacts {
  /** Οι ιδιοκτήτες (`registry-owners.ts`) — σταθερή σειρά, χωρίς διπλά. */
  readonly owners: readonly string[];
  /** Η ρητή επιλογή του γραφείου (`document_obligor_designations`), ή `null`. */
  readonly explicitContactId: string | null;
  /** Επαφή → μερίδιο %. **Κενό** όταν η πηγή των ιδιοκτητών δεν έχει μερίδια (εντολή · πωλητές · εταιρεία). */
  readonly shares: ReadonlyMap<string, number>;
  /** Οι κύριοι μεταβιβάζοντες — **μόνο** όταν οι ιδιοκτήτες είναι οι μεταβιβάζοντες ανοιχτής υπόθεσης. */
  readonly principalContactIds: readonly string[];
}

/** Ο ιδιοκτήτης με μερίδιο > 50%, ή `null` (μερίδια ελλιπή ⇒ κανείς δεν κρίνεται: `unknown-shares`). */
function majorityOwnerOf(owners: readonly string[], shares: ReadonlyMap<string, number>): string | null {
  return owners.find((owner) => (shares.get(owner) ?? 0) > MAJORITY_SHARE_PCT + PCT_TOLERANCE) ?? null;
}

function sharesKnownFor(owners: readonly string[], shares: ReadonlyMap<string, number>): boolean {
  return owners.every((owner) => shares.has(owner));
}

/** Η παραγόμενη βάση (κρίκοι 2–4), ή ο λόγος που δεν υπάρχει. */
function derivedLead(facts: ObligorLeadFacts, staleContactId: string | null): ObligorLead {
  const { owners, shares } = facts;
  const designated = (contactId: string, basis: ObligorLeadBasis): ObligorLead =>
    ({ kind: 'designated', contactId, basis, sharePct: shares.get(contactId) ?? null, staleContactId });
  if (owners.length === 1) return designated(owners[0], 'sole');
  const majority = majorityOwnerOf(owners, shares);
  if (majority !== null) return designated(majority, 'majority-share');
  const principals = facts.principalContactIds.filter((id) => owners.includes(id));
  if (principals.length === 1) return designated(principals[0], 'contract-principal');
  const reason: ObligorUndesignatedReason = shares.size > 0 && sharesKnownFor(owners, shares) ? 'no-majority' : 'unknown-shares';
  return { kind: 'undesignated', reason, staleContactId };
}

/** **Ποιος** είναι ο υπεύθυνος του ακινήτου, και **γιατί**. `null` = κανείς ιδιοκτήτης (το λέει ήδη το «δεν έχει οριστεί»). */
export function obligorLeadOf(facts: ObligorLeadFacts): ObligorLead | null {
  if (facts.owners.length === 0) return null;
  const explicit = facts.explicitContactId;
  if (explicit !== null && facts.owners.includes(explicit)) {
    return { kind: 'designated', contactId: explicit, basis: 'explicit', sharePct: facts.shares.get(explicit) ?? null, staleContactId: null };
  }
  return derivedLead(facts, explicit);
}
