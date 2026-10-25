/**
 * @fileoverview Σενάρια της γκαλερί για τις γραμμές χωρίς απόδειξη (ADR-916 §5.23 Φ-Δ.7γ) — κάθε μορφή της μέτρησης, κριμένη
 *   από την **πραγματική** κρίση (`handoverLineClosureOfferOf`), ώστε η γκαλερί να μη δείχνει ποτέ κουμπί που η πόρτα θα αρνιόταν.
 * @module components/property-handover-office/testing/handover-line-closure-scenarios
 */

import { handoverLineClosureOfferOf } from '@/lib/property-handover/handover-line-closure';
import type { PropertyHandover } from '@/types/property-handover';
import type { HandoverLineEvidence, HandoverUnprovenLine } from '@/types/property-handover-line-closure';

/** Μία γραμμή ανά μορφή μέτρησης που φτάνει στην καρτέλα — οι δύο οριστικές αιτίες και οι δύο «περίμενε». */
const UNPROVEN_SAMPLES: readonly { readonly name: string | null; readonly size: number; readonly evidence: HandoverLineEvidence }[] = [
  { name: 'Energy certificate.pdf', size: 482_113, evidence: { kind: 'lost', cause: 'bytes-gone' } },
  { name: null, size: 1_204_771, evidence: { kind: 'lost', cause: 'source-unlocated' } },
  { name: 'Floor plan — level 2.dwg', size: 3_911_402, evidence: { kind: 'recovering' } },
  { name: 'Warranty — elevator.pdf', size: 96_540, evidence: { kind: 'provable' } },
];

/** Οι γραμμές μιας παράδοσης της γκαλερί, με την προσφορά της καθεμίας από την ΙΔΙΑ κρίση με την πόρτα. */
export function scenarioUnprovenLines(handover: PropertyHandover): readonly HandoverUnprovenLine[] {
  return UNPROVEN_SAMPLES.map((sample, index) => ({
    sourceFileId: `file_unproven_${index + 1}`,
    name: sample.name,
    size: sample.size,
    deliveredAt: handover.fileDelivery?.startedAt ?? null,
    offer: handoverLineClosureOfferOf(handover, sample.evidence),
  }));
}
