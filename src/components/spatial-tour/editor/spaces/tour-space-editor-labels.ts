/**
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΤΟΥ ΒΗΜΑΤΟΣ «ΧΩΡΟΙ»** (ADR-884 Φ2στ-γ Γ3γ-2β · §4.14 · §12 Δ8 · Δ9).
 * @related `locales/{el,en}/spatial-tour.json` (`spaceEditor.*`) · `../tour-shape-labels.ts` (αρνήσεις του γραφέα σχημάτων)
 * @module components/spatial-tour/editor/spaces/tour-space-editor-labels
 *
 * 🔑 **Χωριστό αρχείο** (CHECK 3.34): τις ζητά μόνο ο επεξεργαστής χώρων, που φορτώνεται πίσω από `next/dynamic` — ποτέ το
 *   κέλυφος της σελίδας. ⛔ Κάθε κλειδί ολόγραφο με `spatial-tour:` (βλ. `spatial-tour-labels.ts`).
 */

import type { SpaceDetectRefusal } from '@/lib/spatial-tour/space-detect/space-detect-types';

export const TOUR_SPACE_EDITOR_KEYS = {
  coverage: 'spatial-tour:spaceEditor.coverage',
  coverageComplete: 'spatial-tour:spaceEditor.coverageComplete',
  coverageMissing: 'spatial-tour:spaceEditor.coverageMissing',
  coverageHint: 'spatial-tour:spaceEditor.coverageHint',
  open: 'spatial-tour:spaceEditor.open',
  needsScale: 'spatial-tour:spaceEditor.needsScale',
  title: 'spatial-tour:spaceEditor.title',
  description: 'spatial-tour:spaceEditor.description',
  map: 'spatial-tour:spaceEditor.map',
  tools: 'spatial-tour:spaceEditor.tools',
  toolSelect: 'spatial-tour:spaceEditor.toolSelect',
  toolPen: 'spatial-tour:spaceEditor.toolPen',
  toolPenHint: 'spatial-tour:spaceEditor.toolPenHint',
  door: 'spatial-tour:spaceEditor.door',
  doorValue: 'spatial-tour:spaceEditor.doorValue',
  doorHint: 'spatial-tour:spaceEditor.doorHint',
  detecting: 'spatial-tour:spaceEditor.detecting',
  proposals: 'spatial-tour:spaceEditor.proposals',
  listTitle: 'spatial-tour:spaceEditor.listTitle',
  listEmpty: 'spatial-tour:spaceEditor.listEmpty',
  proposal: 'spatial-tour:spaceEditor.proposal',
  approvedSpace: 'spatial-tour:spaceEditor.approvedSpace',
  unnamed: 'spatial-tour:spaceEditor.unnamed',
  selectPrompt: 'spatial-tour:spaceEditor.selectPrompt',
  approve: 'spatial-tour:spaceEditor.approve',
  discard: 'spatial-tour:spaceEditor.discard',
  remove: 'spatial-tour:spaceEditor.remove',
  saveDetails: 'spatial-tour:spaceEditor.saveDetails',
  notOrthogonal: 'spatial-tour:spaceEditor.notOrthogonal',
  measured: 'spatial-tour:spaceEditor.measured',
  measuredValue: 'spatial-tour:spaceEditor.measuredValue',
  declared: 'spatial-tour:spaceEditor.declared',
  declaredHint: 'spatial-tour:spaceEditor.declaredHint',
  declaredSource: 'spatial-tour:spaceEditor.declaredSource',
  declaredSourcePlaceholder: 'spatial-tour:spaceEditor.declaredSourcePlaceholder',
  declaredSourceRequired: 'spatial-tour:spaceEditor.declaredSourceRequired',
  declaredInvalid: 'spatial-tour:spaceEditor.declaredInvalid',
  declaredWarn: 'spatial-tour:spaceEditor.declaredWarn',
  nameFromPoint: 'spatial-tour:spaceEditor.nameFromPoint',
  nameOwn: 'spatial-tour:spaceEditor.nameOwn',
  separationTitle: 'spatial-tour:spaceEditor.separationTitle',
  separationBody: 'spatial-tour:spaceEditor.separationBody',
  separationApply: 'spatial-tour:spaceEditor.separationApply',
  separationKeep: 'spatial-tour:spaceEditor.separationKeep',
  separationSelected: 'spatial-tour:spaceEditor.separationSelected',
  separationRemove: 'spatial-tour:spaceEditor.separationRemove',
  vertex: 'spatial-tour:spaceEditor.vertex',
  vertexHint: 'spatial-tour:spaceEditor.vertexHint',
  addVertex: 'spatial-tour:spaceEditor.addVertex',
  close: 'spatial-tour:spaceEditor.close',
} as const;

/** Οι αρνήσεις της ανίχνευσης (Γ3α) + ό,τι αποτυγχάνει πριν φτάσει εκεί (κάτοψη/Worker/λήψη). */
export type SpaceDetectNotice = SpaceDetectRefusal | 'plan-unavailable' | 'failed';

export const SPACE_DETECT_NOTICE_KEY: Readonly<Record<SpaceDetectNotice, string>> = {
  uncalibrated: 'spatial-tour:spaceEditor.detect.uncalibrated',
  'seed-outside': 'spatial-tour:spaceEditor.detect.seedOutside',
  'seed-on-wall': 'spatial-tour:spaceEditor.detect.seedOnWall',
  leak: 'spatial-tour:spaceEditor.detect.leak',
  'too-small': 'spatial-tour:spaceEditor.detect.tooSmall',
  'plan-unavailable': 'spatial-tour:spaceEditor.detect.planUnavailable',
  failed: 'spatial-tour:spaceEditor.detect.failed',
};
