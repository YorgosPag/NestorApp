/**
 * Conveyance — ο κατάλογος ΜΙΑΣ υπόθεσης, από τα συστατικά της (ADR-901 §5.5).
 *
 * Η ΜΙΑ σύνθεση `υπόθεση + παραγόμενα γεγονότα + αρχεία → κατάλογος`. Την καλεί ο server
 * (`conveyance-case.service.ts`) και ο client (optimistic update στο `useConveyanceCase`) —
 * αν διέφεραν, η οθόνη θα «αναπηδούσε» στην απάντηση του server.
 *
 * ADR-915 §22 — οι γραμμές είναι **κατάλογος × πρόσωπα** (`caseRows`) και τα γεγονότα επιλύονται ανά πρόσωπο
 * (`resolveCaseFacts`).
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/case-checklist
 */

import type { ConveyanceRole } from '@/config/conveyance-checklist/types';
import type { ConveyanceCase, DerivedChecklist, EvidenceFile, SealedDelivery } from '@/types/conveyance-case';
import { caseRows, resolveCaseFacts } from './case-rows';
import { deriveChecklist } from './derive-checklist';
import type { FactValues } from './derive-facts';

export function deriveCaseChecklist(params: {
  readonly record: ConveyanceCase;
  readonly derivedFacts: FactValues;
  readonly evidence: readonly EvidenceFile[];
  /** Π2 — σφραγισμένες παραδόσεις (μόνο ο οικοδεσπότης μπορεί να έχει). */
  readonly sealed: readonly SealedDelivery[];
  readonly today: string;
  readonly viewer: ConveyanceRole | 'host';
}): DerivedChecklist {
  return deriveChecklist({
    rows: caseRows(params.record),
    facts: resolveCaseFacts(params.derivedFacts, params.record),
    overrides: params.record.overrides,
    evidence: params.evidence,
    sealed: params.sealed,
    today: params.today,
    targetSigningDate: params.record.targetSigningDate,
    viewer: params.viewer,
  });
}
