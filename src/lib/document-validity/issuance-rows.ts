/**
 * @fileoverview ADR-915 §27 — **γραμμές του μητρώου + κατάλογος αναθέσεων ⇒ ό,τι δείχνει η οθόνη ανά γραμμή
 *   «Ανάθεσης»**: η τρέχουσα ανάθεση, το νεότερο έγγραφο (για την παραγόμενη ολοκλήρωση) και οι υποψήφιοι.
 * @related services/document-registry/registry-issuance.server.ts (ο αναγνώστης — καλεί αυτό) ·
 *   issuance-assignment.ts (κατάταξη) · document-next-step.ts (`needsIssuanceAssignment` — ο ΙΔΙΟΣ πυρήνας με την οθόνη)
 * @module lib/document-validity/issuance-rows
 *
 * 🔑 **Μόνο όπου θα δειχτεί** (ιδίωμα `professionalSearchPropertyIds`): γραμμή **ακινήτου** (όχι προσώπου — ένα έγγραφο
 *    για όλους τους ιδιοκτήτες, §26) σε κατάσταση που ζητά νέο έγγραφο, με εκδότη επαγγελματία.
 * 🔑 Καθαρό: το καλεί ο αναγνώστης του διακομιστή **και** το fixture των τεστ — η οθόνη ελέγχεται απέναντι στον ΙΔΙΟ
 *    συναρμολογητή με την παραγωγή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { needsIssuanceAssignment } from './document-next-step';
import {
  registryRowKindOf,
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type RegistryRow,
} from './document-registry';
import {
  issuanceKeyOf,
  issuanceStateOf,
  type IssuanceAssignmentRecord,
} from './issuance-assignment';
import {
  rankIssuanceCandidates,
  type IssuanceCandidate,
  type IssuanceRosterEntry,
} from './issuance-candidates';
import { currentInspectionContactOf } from './issuance-inspection-contact';
import type { IssuanceOwnerAttestation } from './issuance-owner-attestation';

/** Η ανάθεση μιας γραμμής «Ανάθεσης» — τα **γεγονότα** ωμά· η οθόνη κρίνει με τον ίδιο πυρήνα (`issuanceStateOf`). */
export interface RowIssuance {
  /** Η αποθηκευμένη ανάθεση (και κλειστή ή ολοκληρωμένη) — `null` = ποτέ. */
  readonly record: IssuanceAssignmentRecord | null;
  /** Το νεότερο έγγραφο του είδους στο ακίνητο — κρίνει την ολοκλήρωση. */
  readonly latestIssuedOn: string | null;
  /** «Σε γνωστό»: ήδη ταξινομημένοι, με το **γιατί** (`rankIssuanceCandidates`). */
  readonly candidates: readonly IssuanceCandidate[];
}

/** Οι γραμμές «Ανάθεσης»: κλειδί → (ακίνητο, είδος). */
export function assignableTargets(rows: readonly RegistryRow[]): ReadonlyMap<string, { readonly propertyId: string; readonly kind: DocumentKind }> {
  const targets = new Map<string, { readonly propertyId: string; readonly kind: DocumentKind }>();
  for (const row of rows) {
    const propertyId = registryRowPropertyIdOf(row);
    const kind = registryRowKindOf(row);
    if (propertyId === null || registryRowPartyOf(row) !== null || !needsIssuanceAssignment(kind, row.state)) continue;
    targets.set(issuanceKeyOf(propertyId, kind), { propertyId, kind });
  }
  return targets;
}

/** Το νεότερο `issuedOn` ανά (ακίνητο, είδος) — από **κάθε** γραμμή εγγράφου ακινήτου, και τις αντικατεστημένες. */
export function latestIssuedOnByKey(rows: readonly RegistryRow[]): ReadonlyMap<string, string> {
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (row.kind !== 'document' || row.document.propertyId === null || row.document.party !== null) continue;
    const issuedOn = row.document.issuedOn;
    const key = issuanceKeyOf(row.document.propertyId, row.document.kind);
    if (issuedOn !== null && issuedOn > (latest.get(key) ?? '')) latest.set(key, issuedOn);
  }
  return latest;
}

/** §45.15 (1β-γ-2) — οι επαφές των οποίων ο ιδιοκτήτης **διόρθωσε** ΑΦΜ στο τεκμήριο της έγκρισης. */
function correctedVatContactIds(attestation: IssuanceOwnerAttestation | null): readonly string[] {
  return attestation === null ? [] : attestation.owners.filter((owner) => owner.verdict === 'corrected').map((owner) => owner.contactId);
}

/**
 * Γραμμές + κατάλογος ⇒ ανάθεση ανά γραμμή «Ανάθεσης» + οι επαφές που θα ονομαστούν (επαγγελματίες · υπεύθυνοι αυτοψίας ·
 * υποψήφιοι) + (§45.15) οι **μόνες** επαφές για τις οποίες ταξιδεύει ΑΦΜ: όσες έχουν διόρθωση σε τεκμήριο (5(1)(γ)).
 */
export function issuanceOfRows(
  rows: readonly RegistryRow[],
  roster: readonly IssuanceRosterEntry[],
): {
  readonly issuance: Readonly<Record<string, RowIssuance>>;
  readonly contactIds: readonly string[];
  readonly vatContactIds: readonly string[];
} {
  const latest = latestIssuedOnByKey(rows);
  const current = new Map(roster.map((entry) => [issuanceKeyOf(entry.propertyId, entry.documentKind), entry.record] as const));
  const issuance: Record<string, RowIssuance> = {};
  const contactIds = new Set<string>();
  const vatContactIds = new Set<string>();
  for (const [key, { propertyId, kind }] of assignableTargets(rows)) {
    const record = current.get(key) ?? null;
    const latestIssuedOn = latest.get(key) ?? null;
    const state = issuanceStateOf(record, latestIssuedOn);
    const declined = state.kind === 'open' && state.stage === 'declined' ? state.record.professionalContactId : null;
    const candidates = rankIssuanceCandidates(roster, { kind, propertyId, excludeContactId: declined });
    issuance[key] = { record, latestIssuedOn, candidates };
    if (record !== null) contactIds.add(record.professionalContactId);
    // §45.15 — ο υπεύθυνος αυτοψίας μπορεί να μην είναι ιδιοκτήτης (ενοικιαστής · διαχειριστής): ονομάζεται κι αυτός.
    const inspection = record === null ? null : currentInspectionContactOf(record);
    if (inspection !== null) contactIds.add(inspection.contactId);
    for (const candidate of candidates) contactIds.add(candidate.contactId);
    for (const id of correctedVatContactIds(record?.decision?.ownerAttestation ?? null)) {
      contactIds.add(id);
      vatContactIds.add(id);
    }
  }
  return { issuance, contactIds: [...contactIds], vatContactIds: [...vatContactIds] };
}
