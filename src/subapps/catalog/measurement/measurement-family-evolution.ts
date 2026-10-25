/**
 * **Εξέλιξη οικογένειας μέτρησης σε χρήση** (ADR-923 §5.2) — καθαρή συνάρτηση.
 *
 * Οι τιμές αποθηκεύονται **και** στη μονάδα-πρότυπο (Φάση 2). Αν μια οικογένεια που χρησιμοποιείται άλλαζε
 * πρότυπο ή συντελεστή, **κάθε** αποθηκευμένη τιμή θα σήμαινε σιωπηλά άλλο πράγμα — 2,1 kW θα γινόταν 2,1 BTU/h
 * χωρίς να αγγίξει κανείς το προϊόν. Γι' αυτό, όσο η οικογένεια χρησιμοποιείται:
 *
 * - η **μονάδα-πρότυπο** δεν αλλάζει·
 * - κάθε **υπάρχουσα** μονάδα κρατά κωδικό, συντελεστή και μετατόπιση (το σύμβολο αλλάζει ελεύθερα)·
 * - μονάδες **προστίθενται** ελεύθερα — η επέκταση δεν αλλάζει τίποτα από όσα ήδη γράφτηκαν.
 *
 * Αυτό είναι το «append-only» των μεγάλων registries μονάδων (UCUM/QUDT: ένα αναγνωριστικό μονάδας δεν
 * ξαναορίζεται ποτέ — νέα σημασία σημαίνει νέο αναγνωριστικό).
 * @module subapps/catalog/measurement/measurement-family-evolution
 */

import { IssueCollector, type CatalogIssue } from '../schema/catalog-issues';
import type { WorkspaceMeasurementFamilyDefinition } from '../types/measurement-family';

export function validateMeasurementFamilyEvolution(
  current: WorkspaceMeasurementFamilyDefinition,
  next: WorkspaceMeasurementFamilyDefinition,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (next.standardUnitCode !== current.standardUnitCode) collector.add('unitLockedInUse', 'standardUnitCode');
  current.units.forEach((unit, index) => {
    const successor = next.units.find((candidate) => candidate.code === unit.code);
    const unchanged = successor !== undefined
      && successor.factor === unit.factor
      && (successor.offset ?? 0) === (unit.offset ?? 0);
    if (!unchanged) collector.add('unitLockedInUse', `units[${index}]`, { code: unit.code });
  });
  return collector.issues;
}
