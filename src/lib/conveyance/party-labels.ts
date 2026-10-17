/**
 * Conveyance — «ΠΟΙΟΣ;» σε μια γραμμή προσώπου (ADR-915 §23.10): η ΜΙΑ κρίση για σειρά, όνομα και ορατότητα.
 *
 * Τρεις ερωτήσεις, ένας τόπος — τον ρωτούν ο server (τι ονόματα **διαβάζω** και **στέλνω**), ο client του
 * οικοδεσπότη (optimistic: πρόσωπο που μόλις μπήκε) και κάθε σημείο που αποδίδει ετικέτα γραμμής:
 * - **Πότε** χρειάζεται «ποιος»: από δύο ορατά πρόσωπα και πάνω. Με ένα, η γραμμή «ΕΝΦΙΑ» δεν είναι αμφίσημη ⇒
 *   κανένα όνομα ούτε στην οθόνη **ούτε στο δίκτυο** (ΓΚΠΔ 5(1)(γ): ό,τι δεν δείχνεται δεν στέλνεται).
 * - **Ποια** πρόσωπα: μόνο όσα φαίνονται μέσα από τις γραμμές **του θεατή** — ίδια πύλη με τον κατάλογο (`visibleTo`),
 *   άρα το όνομα δεν μπορεί να φτάσει εκεί όπου η γραμμή δεν φτάνει (ΓΚΠΔ 25(2): αριθμός αποδεκτών).
 * - **Σειρά**: η σειρά της υπόθεσης, αριθμημένη **ανάμεσα στα ορατά** — ποτέ κενό στην αρίθμηση που θα μαρτυρούσε
 *   πρόσωπο που ο θεατής δεν βλέπει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module lib/conveyance/party-labels
 */

import { parseRowKey } from '@/config/conveyance-checklist/row-key';
import type { CasePartyLabel, ChecklistRow, ConveyanceSellerParty } from '@/types/conveyance-case';

/** Από πόσα ορατά πρόσωπα και πάνω η γραμμή χρειάζεται «ποιος». */
export const PARTY_NAMES_FROM = 2;

export function needsPartyNames(visibleParties: number): boolean {
  return visibleParties >= PARTY_NAMES_FROM;
}

/** Τα πρόσωπα που φαίνονται μέσα από **αυτές** τις γραμμές (ήδη φιλτραρισμένες για τον θεατή). */
export function visiblePartyKeys(rows: readonly Pick<ChecklistRow, 'party'>[]): ReadonlySet<string> {
  return new Set(rows.flatMap((row) => (row.party === null ? [] : [row.party.key])));
}

/** Τα πρόσωπα της υπόθεσης που ο θεατής βλέπει, με τη σειρά της υπόθεσης. */
export function visibleSellers(
  sellers: readonly ConveyanceSellerParty[],
  visible: ReadonlySet<string>,
): readonly ConveyanceSellerParty[] {
  return sellers.filter((party) => visible.has(party.key));
}

/**
 * Οι ετικέτες των προσώπων — `[]` όταν δεν χρειάζεται «ποιος». Όνομα που λείπει ⇒ `''` (η οθόνη λέει «Πωλητής N»).
 * `names` κατά **κλειδί προσώπου**, όχι κατά επαφή.
 */
export function casePartyLabels(
  sellers: readonly ConveyanceSellerParty[],
  names: ReadonlyMap<string, string>,
): readonly CasePartyLabel[] {
  if (!needsPartyNames(sellers.length)) return [];
  return sellers.map((party, index) => ({ key: party.key, ordinal: index + 1, name: (names.get(party.key) ?? '').trim() }));
}

/** Τα ονόματα μιας όψης, για να ξαναμετρηθούν πάνω σε νεότερη λίστα προσώπων (optimistic του οικοδεσπότη). */
export function partyNamesOf(labels: readonly CasePartyLabel[]): ReadonlyMap<string, string> {
  return new Map(labels.map((label) => [label.key, label.name]));
}

/** Το πρόσωπο πίσω από ένα κλειδί γραμμής — `null` για γραμμή της υπόθεσης ή όταν δεν χρειάζεται «ποιος». */
export function partyLabelOfRowKey(labels: readonly CasePartyLabel[], rowKey: string): CasePartyLabel | null {
  return partyLabelOf(labels, parseRowKey(rowKey).partyKey);
}

/** `null` κλειδί (γραμμή της υπόθεσης) δεν ταιριάζει ποτέ: κάθε ετικέτα έχει κλειδί προσώπου. */
export function partyLabelOf(labels: readonly CasePartyLabel[], partyKey: string | null): CasePartyLabel | null {
  return labels.find((label) => label.key === partyKey) ?? null;
}
