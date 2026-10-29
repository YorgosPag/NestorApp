/**
 * **Ομάδες τιμολόγησης και μέλη** — καθαρό μοντέλο (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related server/catalog/pricing-group-writer.server.ts (ένας γραφέας για τα δύο είδη) ·
 *   server/catalog/customer-assignment-writer.server.ts (ταυτότητα ανάθεσης = ο συμβαλλόμενος)
 * @module components/catalog/pricing/pricing-group-draft
 *
 * 🔑 **Ένας επεξεργαστής, δύο είδη** (ίδιο σχήμα, ίδιος γραφέας): η επιλογή στη διεύθυνση κουβαλά το είδος
 *    (`?group=customerGroup:wholesale`) — ο ίδιος κωδικός μπορεί να υπάρχει και στα δύο είδη χωρίς σύγκρουση.
 * 🔑 **«Ένας συμβαλλόμενος ⇒ μία ομάδα» φαίνεται ΠΡΙΝ από την αποστολή** (SAP: μία ομάδα τιμής ανά πελάτη): ο γραφέας
 *    το εγγυάται δομικά (id ανάθεσης = `pricingPartyKey`), η οθόνη το **λέει** — και η «προσθήκη» μέλους που ανήκει
 *    αλλού γίνεται ρητή **μετακίνηση** της ίδιας ανάθεσης, ποτέ ένα 409 `duplicateCode` μετά το κλικ.
 */

import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validatePricingGroup } from '@/subapps/catalog/schema/validate-pricing';
import type { CustomerGroupDefinition, PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { CustomerAssignmentWire, CustomerGroupWire, DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { PRICING_GROUP_KINDS, type PricingGroupKind } from '@/subapps/catalog/vocabulary/pricing';

/** Ίδιο σχήμα για τα δύο είδη (ο γραφέας το επιβεβαιώνει στη μεταγλώττιση). */
export type PricingGroupDefinition = CustomerGroupDefinition;
export type PricingGroupWire = DiscountGroupWire | CustomerGroupWire;

const SELECTION_SEPARATOR = ':';

/** Η επιλογή στη διεύθυνση: `είδος:κωδικός` (ή `είδος:new` για φόρμα δημιουργίας). */
export const groupSelectionOf = (kind: PricingGroupKind, code: string): string => `${kind}${SELECTION_SEPARATOR}${code}`;

const isPricingGroupKind = (value: string): value is PricingGroupKind => (PRICING_GROUP_KINDS as readonly string[]).includes(value);

export function parseGroupSelection(value: string | null): { readonly kind: PricingGroupKind; readonly code: string } | null {
  if (value === null) return null;
  const at = value.indexOf(SELECTION_SEPARATOR);
  const kind = at < 0 ? '' : value.slice(0, at);
  const code = value.slice(at + 1);
  return isPricingGroupKind(kind) && code !== '' ? { kind, code } : null;
}

export const emptyGroupDraft = (): PricingGroupDefinition => ({ code: '', labels: {} });

/** Μόνο τα πεδία του ορισμού — ποτέ τα μεταδεδομένα της εγγραφής μέσα στο σώμα αιτήματος. */
export const groupDraftOf = (record: PricingGroupWire): PricingGroupDefinition => ({ code: record.code, labels: record.labels });

/** Η ίδια επικύρωση με τον γραφέα + ο διπλός κωδικός **του ίδιου είδους** (ο γραφέας: ντετερμινιστικό id ⇒ 409). */
export function groupDraftIssues(
  draft: PricingGroupDefinition,
  siblings: readonly PricingGroupWire[],
  record: PricingGroupWire | null,
): readonly CatalogIssue[] {
  const taken = siblings.some((other) => other.id !== record?.id && !other.isDeleted && other.code === draft.code);
  const duplicate: CatalogIssue[] = record === null && taken ? [{ code: 'duplicateCode', path: 'code', params: { code: draft.code } }] : [];
  return [...validatePricingGroup(draft), ...duplicate];
}

// ── Μέλη ομάδας πελατών ──────────────────────────────────────────────────────

/** Τι σημαίνει «πρόσθεσε αυτόν τον συμβαλλόμενο εδώ»: νέα ανάθεση · ήδη μέλος · μετακίνηση από άλλη ομάδα. */
export type MembershipVerdict =
  | { readonly kind: 'add' }
  | { readonly kind: 'alreadyHere'; readonly assignment: CustomerAssignmentWire }
  | { readonly kind: 'move'; readonly assignment: CustomerAssignmentWire; readonly from: CustomerGroupWire | null };

export function membershipVerdict(
  party: PricingPartyRef,
  groupId: string,
  assignments: readonly CustomerAssignmentWire[],
  groups: readonly CustomerGroupWire[],
): MembershipVerdict {
  const key = pricingPartyKey(party);
  const assignment = assignments.find((candidate) => !candidate.isDeleted && pricingPartyKey(candidate.party) === key);
  if (!assignment) return { kind: 'add' };
  if (assignment.customerGroupId === groupId) return { kind: 'alreadyHere', assignment };
  return { kind: 'move', assignment, from: groups.find((group) => group.id === assignment.customerGroupId) ?? null };
}

/** Τα μέλη μιας ομάδας, με σταθερή σειρά (κατά όνομα, μετά κατά κλειδί — ανώνυμα μέλη δεν «χορεύουν»). */
export function membersOf(
  groupId: string,
  assignments: readonly CustomerAssignmentWire[],
  nameOf: (assignment: CustomerAssignmentWire) => string,
): readonly CustomerAssignmentWire[] {
  return assignments
    .filter((assignment) => !assignment.isDeleted && assignment.customerGroupId === groupId)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || pricingPartyKey(a.party).localeCompare(pricingPartyKey(b.party)));
}
