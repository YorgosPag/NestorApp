/**
 * @fileoverview **Το πρόχειρο οικογένειας μέτρησης του χώρου** — καθαρές συναρτήσεις (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/measurement-draft
 *
 * 🔑 **Η επικύρωση της οθόνης είναι η επικύρωση του γραφέα**: `validateMeasurementFamily` (με απαγόρευση κωδικών
 *    πλατφόρμας) **και**, όσο η οικογένεια χρησιμοποιείται, `validateMeasurementFamilyEvolution` (append-only). Ο
 *    άνθρωπος βλέπει το «η μονάδα κλειδώθηκε» **πριν** πατήσει αποθήκευση, όχι ως 409 μετά.
 * 🔑 «Σε χρήση;» = κάποια ιδιότητα της βιβλιοθήκης τη δηλώνει στο παράγωγο `measurementFamilyCodes` — το **ίδιο**
 *    πεδίο που ρωτά ο γραφέας μέσα στη συναλλαγή.
 */

import type { AttributeRecord, MeasurementFamilyRecord } from '@/services/catalog/catalog-api.client';
import { fromWorkspaceDefinition } from '@/subapps/catalog/measurement/measurement-registry';
import { validateMeasurementFamilyEvolution } from '@/subapps/catalog/measurement/measurement-family-evolution';
import { validateMeasurementFamily } from '@/subapps/catalog/measurement/validate-measurement-family';
import { IssueCollector, type CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type {
  MeasurementUnitDefinition,
  WorkspaceMeasurementFamilyDefinition,
} from '@/subapps/catalog/types/measurement-family';

/** Κωδικός UNECE Rec 20 — ίδια μορφή με το zod schema του γραφέα. */
const UNECE_PATTERN = /^[A-Z0-9]{2,3}$/;

export function emptyMeasurementDraft(): WorkspaceMeasurementFamilyDefinition {
  return { code: '', labels: {}, standardUnitCode: '', units: [], singleUnit: false };
}

/** Μόνο ο ορισμός — χωρίς περίβλημα εγγραφής. */
export function measurementDraftOf(record: MeasurementFamilyRecord): WorkspaceMeasurementFamilyDefinition {
  return {
    code: record.code,
    labels: record.labels,
    standardUnitCode: record.standardUnitCode,
    units: record.units,
    singleUnit: record.singleUnit,
  };
}

export function isMeasurementFamilyInUse(code: string, attributes: readonly AttributeRecord[]): boolean {
  return attributes.some((attribute) => attribute.measurementFamilyCodes.includes(code));
}

function uneceIssues(units: readonly MeasurementUnitDefinition[]): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  units.forEach((unit, index) => {
    if (unit.unece !== undefined && !UNECE_PATTERN.test(unit.unece)) collector.add('invalidCode', `units[${index}].unece`);
  });
  return collector.issues;
}

/** Όλα τα ευρήματα του προχείρου — `inUseBase` = η αποθηκευμένη μορφή, όταν η οικογένεια χρησιμοποιείται. */
export function validateMeasurementDraft(
  draft: WorkspaceMeasurementFamilyDefinition,
  inUseBase: WorkspaceMeasurementFamilyDefinition | null,
): readonly CatalogIssue[] {
  return [
    ...validateMeasurementFamily(fromWorkspaceDefinition(draft), { forbidPlatformCodes: true }),
    ...uneceIssues(draft.units),
    ...(inUseBase ? validateMeasurementFamilyEvolution(inUseBase, draft) : []),
  ];
}

/** Νέα κενή μονάδα (συντελεστής 1)· η πρώτη γίνεται πρότυπο μόλις πάρει κωδικό (`withUnit`). */
export function withNewUnit(draft: WorkspaceMeasurementFamilyDefinition): WorkspaceMeasurementFamilyDefinition {
  const unit: MeasurementUnitDefinition = { code: '', symbol: '', factor: 1 };
  return { ...draft, units: [...draft.units, unit] };
}

/** Αντικατάσταση μονάδας· αλλαγή κωδικού του προτύπου μεταφέρει και τη δήλωση προτύπου. */
export function withUnit(
  draft: WorkspaceMeasurementFamilyDefinition,
  index: number,
  unit: MeasurementUnitDefinition,
): WorkspaceMeasurementFamilyDefinition {
  const previous = draft.units[index];
  const units = draft.units.map((current, at) => (at === index ? unit : current));
  const standardFollows = previous !== undefined && previous.code === draft.standardUnitCode;
  return { ...draft, units, standardUnitCode: standardFollows ? unit.code : draft.standardUnitCode };
}

export function withoutUnit(draft: WorkspaceMeasurementFamilyDefinition, index: number): WorkspaceMeasurementFamilyDefinition {
  const removed = draft.units[index];
  const units = draft.units.filter((_, at) => at !== index);
  const standardGone = removed !== undefined && removed.code === draft.standardUnitCode;
  return { ...draft, units, standardUnitCode: standardGone ? '' : draft.standardUnitCode };
}
