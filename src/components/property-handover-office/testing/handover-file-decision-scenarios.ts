/**
 * @fileoverview **Ο ΕΝΑΣ πίνακας αρχείων της καρτέλας «Παράδοση»** — τον διαβάζουν η γκαλερί **και** οι άγκυρες Ζ29
 *   (ADR-916 §5.18 Φ-Δ.4).
 * @related handover-office-scenarios.ts (ο αντίστοιχος πίνακας των παραδόσεων) · lib/property-handover/handover-preview-file.ts
 * @module components/property-handover-office/testing/handover-file-decision-scenarios
 *
 * 🔑 **Κάθε μορφή της προσφοράς** (ανοιχτή · με επιβεβαίωση · μόνο «Παραδίδεται» μετά την παράδοση · κλειστή για κάθε λόγο)
 *    και **κάθε** λόγος κατάταξης. Η γραμμή **υπολογίζεται** από την πραγματική σύνθεση — ποτέ γραμμένη με το χέρι.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { handoverDispositionOf, type HandoverCandidateFile } from '@/lib/property-handover/handover-disposition';
import { handoverPreviewFileOf, handoverSetFileIdentityOf } from '@/lib/property-handover/handover-preview-file';
import type { PropertyHandoverPreview, PropertyHandoverPreviewFile } from '@/types/property-handover';

export interface HandoverFileScenario {
  readonly id: string;
  readonly displayName: string;
  /** `null` ⇒ αδιάβαστο έγγραφο (πάει στα «θέλουν απόφαση», καμία πράξη). */
  readonly candidate: HandoverCandidateFile | null;
  readonly delivered: boolean;
}

const base: HandoverCandidateFile = {
  entityType: ENTITY_TYPES.PROPERTY, purpose: 'document', domain: 'sales', category: 'documents', status: 'ready',
  lifecycleState: 'active', isDeleted: false,
};
const decided = (disposition: 'deliver' | 'internal') => ({
  disposition, reason: 'Checked with the legal team', decidedBy: 'u_office', decidedAt: '2026-10-23T09:00:00.000Z',
});

export const HANDOVER_FILE_SCENARIOS: readonly HandoverFileScenario[] = [
  { id: 'review-category', displayName: 'Scan 0042.pdf', candidate: base, delivered: false },
  { id: 'review-confidential', displayName: 'Buyer correspondence.pdf', candidate: { ...base, category: 'photos', classification: 'confidential' }, delivered: false },
  { id: 'deliver-category', displayName: 'Floor plan A1.pdf', candidate: { ...base, category: 'floorplans' }, delivered: false },
  { id: 'deliver-delivered', displayName: 'Living room.jpg', candidate: { ...base, category: 'photos' }, delivered: true },
  { id: 'internal-office-domain', displayName: 'Contractor invoice.pdf', candidate: { ...base, domain: 'accounting' }, delivered: false },
  { id: 'decision-internal', displayName: 'Draft contract.pdf', candidate: { ...base, handoverDecision: decided('internal') }, delivered: false },
  { id: 'decision-deliver-delivered', displayName: 'Warranty.pdf', candidate: { ...base, handoverDecision: decided('deliver') }, delivered: true },
  {
    id: 'protocol', displayName: 'Handover protocol.pdf', delivered: false,
    candidate: { ...base, handoverProtocolOf: { protocolId: 'phpr_demo', handoverId: 'phov_demo', revision: 1 } },
  },
  { id: 'unrecognised', displayName: 'Legacy upload.bin', candidate: null, delivered: false },
];

/** Η γραμμή ενός σεναρίου — από την **πραγματική** σύνθεση. */
export function scenarioPreviewFileOf(scenario: HandoverFileScenario): PropertyHandoverPreviewFile {
  const label = { fileId: `f_${scenario.id}`, displayName: scenario.displayName, entityType: ENTITY_TYPES.PROPERTY, entityId: 'prop_demo' };
  return handoverPreviewFileOf(handoverSetFileIdentityOf(label, scenario.candidate), scenario.candidate, scenario.delivered);
}

/** Τα σενάρια μοιρασμένα όπως τα μοιράζει το σύνολο — αδιάβαστο ⇒ «θέλουν απόφαση». */
export function scenarioPreviewFiles(): PropertyHandoverPreview['files'] {
  const files: Record<'deliver' | 'review' | 'internal', PropertyHandoverPreviewFile[]> = { deliver: [], review: [], internal: [] };
  for (const scenario of HANDOVER_FILE_SCENARIOS) {
    files[scenario.candidate === null ? 'review' : handoverDispositionOf(scenario.candidate)].push(scenarioPreviewFileOf(scenario));
  }
  return files;
}
