/**
 * @fileoverview ADR-915 §27 — **η ανάθεση όπως τη βλέπει η γραμμή**: από τη γραμμή και την απόκριση στο στάδιο, τη μπάλα,
 *   τους υποψηφίους και τον υπεύθυνο που αποφασίζει. Και η **αισιόδοξη** εμφάνιση μιας πράξης πριν απαντήσει ο διακομιστής.
 * @related lib/document-validity/issuance-assignment.ts (ο ΙΔΙΟΣ μειωτής με τον διακομιστή) · registry-obligors.ts
 * @module components/document-registry/registry-issuance
 *
 * 🔑 **Καμία δεύτερη λογική σταδίων**: η απόκριση φέρνει τα **γεγονότα**, η οθόνη κρίνει με `issuanceStateOf` και
 *    προβάλλει αισιόδοξα με `reduceIssuance` + `issuanceActionOf` — οι ίδιες συναρτήσεις με τη συναλλαγή του διακομιστή.
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { needsIssuanceAssignment } from '@/lib/document-validity/document-next-step';
import {
  registryRowKindOf,
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import {
  issuanceKeyOf,
  issuanceStateOf,
  reduceIssuance,
  visibleIssuanceStage,
  type IssuanceCandidate,
  type IssuanceState,
} from '@/lib/document-validity/issuance-assignment';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import { issuanceActionOf, type IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

/** Ό,τι χρειάζεται η μπάρα «Ανάθεση» μιας γραμμής. */
export interface RegistryIssuanceView {
  readonly key: string;
  readonly propertyId: string;
  readonly kind: DocumentKind;
  readonly state: IssuanceState;
  readonly candidates: readonly IssuanceCandidate[];
  /** Ο υπεύθυνος που **αποφασίζει** (§26) — `null` = κανείς ιδιοκτήτης / δεν ρωτήθηκε. */
  readonly lead: ObligorLead | null;
}

/**
 * Η ανάθεση της γραμμής, ή:
 * - `null`        — η γραμμή δεν δείχνει «Ανάθεση» (αρχή · πρόσωπο · έγκυρο έγγραφο)
 * - `unavailable` — δείχνει, αλλά ο κατάλογος δεν διαβάστηκε ⇒ **κανένας** ισχυρισμός «δεν ανατέθηκε»
 */
export function registryIssuanceOf(row: RegistryRow, registry: DocumentRegistryResponse): RegistryIssuanceView | 'unavailable' | null {
  const propertyId = registryRowPropertyIdOf(row);
  const kind = registryRowKindOf(row);
  if (propertyId === null || registryRowPartyOf(row) !== null || !needsIssuanceAssignment(kind, row.state)) return null;
  const key = issuanceKeyOf(propertyId, kind);
  const issuance = registry.issuance[key];
  if (!registry.issuanceKnown || issuance === undefined) return 'unavailable';
  return {
    key,
    propertyId,
    kind,
    state: issuanceStateOf(issuance.record, issuance.latestIssuedOn),
    candidates: issuance.candidates,
    lead: registry.properties[propertyId]?.obligorLead ?? null,
  };
}

/** Ο «χρήστης» της αισιόδοξης εγγραφής — ποτέ δεν φτάνει στον δίσκο (ο διακομιστής γράφει το δικό του `uid`). */
const OPTIMISTIC_ACTOR_UID = 'optimistic';

/**
 * **Αισιόδοξη** εμφάνιση: κάθε εκκρεμής πράξη περνά από τον ίδιο μειωτή πάνω στα τρέχοντα γεγονότα. Πράξη που ο μειωτής
 * αρνείται **δεν** προβάλλεται — θα την αρνιόταν και ο διακομιστής.
 */
export function withPendingIssuance(
  registry: DocumentRegistryResponse,
  pending: ReadonlyMap<string, IssuanceAssignmentBody>,
  nowIso: string,
): DocumentRegistryResponse {
  const overrides = [...pending].flatMap(([key, request]) => {
    const issuance = registry.issuance[key];
    if (issuance === undefined) return [];
    const reduced = reduceIssuance(request.documentKind, issuance.record, issuance.latestIssuedOn, issuanceActionOf(request), {
      uid: OPTIMISTIC_ACTOR_UID, nowIso,
    });
    return reduced.ok ? [[key, { ...issuance, record: reduced.record }] as const] : [];
  });
  return overrides.length === 0 ? registry : { ...registry, issuance: { ...registry.issuance, ...Object.fromEntries(overrides) } };
}

/** Ό,τι κουβαλά **κάθε** αίτημα της γραμμής: ποια ανάθεση, και το στάδιο που **βλέπει** ο άνθρωπος (CAS). */
export function issuanceTargetOf(view: RegistryIssuanceView): Pick<IssuanceAssignmentBody, 'propertyId' | 'documentKind' | 'expectedStage'> {
  return { propertyId: view.propertyId, documentKind: view.kind, expectedStage: visibleIssuanceStage(view.state) };
}
