/**
 * Κοινά δεδομένα των tests του στιγμιοτύπου (ADR-947 Φ2) — ένα πρόχειρο που η μηχανή υπολογίζει, και ένα αίτημα
 * σύνθεσης με χειροκίνητη τιμή ζώνης.
 */

import { INITIAL_DRAFT, type ObjectiveValueDraft } from '../objective-value-draft';
import type { ObjectiveValueSnapshotRequest } from '../objective-value-snapshot';

export const SNAPSHOT_DRAFT: ObjectiveValueDraft = {
  ...INITIAL_DRAFT,
  levels: [{ floor: 1, area: 80 }],
  frontage: 'single',
  hasCentralHeating: true,
  commercialityFactor: 1,
  permitDate: '2010-01-01',
};

export const SNAPSHOT_REQUEST: ObjectiveValueSnapshotRequest = {
  valuationDate: '2026-11-23',
  subject: { kind: 'freeform', label: 'Διαμέρισμα Α2' },
  draft: SNAPSHOT_DRAFT,
  zone: { kind: 'manual', price: 1500 },
  engine: { version: '2024.1', tablesSha256: 'f'.repeat(64) },
  issuer: { companyId: 'comp_1', name: 'Γραφείο', qualification: 'civil-engineer', registryNumber: '12345' },
};
