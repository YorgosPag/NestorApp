/**
 * ADR-949 Α-1 — το πλάνο «ποιο έγγραφο, από πού»: άπληστη κάλυψη συνόλου, ειλικρινή «κανένα έγγραφο», κενό όταν δεν
 * λείπει τίποτα.
 */

import {
  OBJECTIVE_VALUE_EVIDENCE,
  OBJECTIVE_VALUE_EVIDENCE_DOCUMENTS,
  OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS,
} from '@/config/objective-value/objective-value-evidence';

import { objectiveValueEvidencePlan } from '../objective-value-evidence-plan';
import type { ObjectiveValueMissing } from '../objective-value-types';

const documentsOf = (missing: readonly ObjectiveValueMissing[]) =>
  objectiveValueEvidencePlan(missing).steps.map((step) => step.document);

describe('ADR-949 Α-1 — objectiveValueEvidencePlan', () => {
  it('κενό missing ⇒ κενό πλάνο', () => {
    expect(objectiveValueEvidencePlan([])).toEqual({ steps: [], selfAnswered: [] });
  });

  it('ADR-949 Α-3: η τιμή ζώνης ΔΕΝ υπόσχεται έγγραφο (η πράξη ΕΝΦΙΑ τη γράφει χρονολογημένη) ⇒ Ε9 + «πίνακες ζωνών»', () => {
    const plan = objectiveValueEvidencePlan(['area', 'floor', 'zonePrice']);
    expect(plan.steps.map((step) => step.document)).toEqual(['owner-e9']);
    expect(plan.steps[0].covers.map((c) => c.field)).toEqual(['area', 'floor']);
    expect(plan.selfAnswered).toEqual([{ field: 'zonePrice', reason: 'zone-tables' }]);
  });

  it('ισοπαλία κάλυψης ⇒ αποδεδειγμένη θέση πριν από ευκολία (Ε9 πριν από συμβόλαιο) και μετά η σειρά του μητρώου (Ε9 πριν από ΕΝΦΙΑ)', () => {
    expect(documentsOf(['area', 'floor'])).toEqual(['owner-e9']);
  });

  it('η ημερομηνία άδειας καλύπτεται ΜΟΝΟ από την άδεια — ποτέ από το έτος κατασκευής του Ε9', () => {
    expect(documentsOf(['area', 'ageYears'])).toEqual(['owner-e9', 'unit-permit']);
  });

  it('κάθε έγγραφο εμφανίζεται μία φορά, και κάθε πεδίο καλύπτεται από ένα μόνο βήμα', () => {
    const plan = objectiveValueEvidencePlan(['area', 'floor', 'zonePrice', 'ageYears', 'area']);
    const documents = plan.steps.map((s) => s.document);
    expect(new Set(documents).size).toBe(documents.length);
    const fields = plan.steps.flatMap((s) => s.covers.map((c) => c.field));
    expect(new Set(fields).size).toBe(fields.length);
    expect([...fields].sort()).toEqual(['ageYears', 'area', 'floor']);
  });

  it('ADR-949 §11.8: ισοδύναμο έγγραφο ⇒ εναλλακτική του βήματος (η πράξη ΕΝΦΙΑ δίπλα στο Ε9, όχι αόρατη)', () => {
    const [e9] = objectiveValueEvidencePlan(['area', 'floor']).steps;
    expect(e9.alternatives.map((a) => a.document)).toEqual(['owner-enfia-assessment']);
    expect(e9.alternatives[0].covers.map((c) => c.field)).toEqual(['area', 'floor']);
  });

  it('εναλλακτική ΜΟΝΟ με αποδεδειγμένη θέση για κάθε πεδίο — το συμβόλαιο (χωρίς «πού») δεν προτείνεται', () => {
    const [e9] = objectiveValueEvidencePlan(['area']).steps;
    expect(e9.alternatives.map((a) => a.document)).not.toContain('title-deed');
  });

  it('εναλλακτική μόνο όταν καλύπτει ΟΛΑ τα πεδία του βήματος, και ποτέ έγγραφο που είναι ήδη βήμα', () => {
    const plan = objectiveValueEvidencePlan(['area', 'floor', 'ageYears']);
    const permit = plan.steps.find((s) => s.document === 'unit-permit');
    expect(permit?.alternatives).toEqual([]);
    const planned = new Set(plan.steps.map((s) => s.document));
    for (const step of plan.steps) {
      for (const alternative of step.alternatives) {
        expect(planned.has(alternative.document)).toBe(false);
        expect(alternative.covers.map((c) => c.field)).toEqual(step.covers.map((c) => c.field));
      }
    }
  });

  it('ό,τι κανένα έγγραφο δεν γράφει λέγεται με τον λόγο του, ποτέ σιωπηλά', () => {
    const plan = objectiveValueEvidencePlan(['commercialityFactor', 'hasElevator', 'plotUtilisation']);
    expect(plan.steps).toEqual([]);
    expect(plan.selfAnswered).toEqual([
      { field: 'commercialityFactor', reason: 'zone-tables' },
      { field: 'hasElevator', reason: 'property-fact' },
      { field: 'plotUtilisation', reason: 'zone-tables' },
    ]);
  });
});

describe('ADR-949 Α-1 — το μητρώο', () => {
  it('κάθε έγγραφο του μητρώου το χρησιμοποιεί τουλάχιστον μία είσοδος (κανένα νεκρό)', () => {
    const used = new Set(Object.values(OBJECTIVE_VALUE_EVIDENCE).flatMap((evidence) =>
      evidence.kind === 'documents' ? evidence.sources.map((s) => s.document) : []));
    expect([...used].sort()).toEqual([...OBJECTIVE_VALUE_EVIDENCE_DOCUMENTS].sort());
  });

  it('κανένα έγγραφο δύο φορές στην ίδια είσοδο', () => {
    const bad = Object.entries(OBJECTIVE_VALUE_EVIDENCE).filter(([, evidence]) => {
      if (evidence.kind !== 'documents') return false;
      const documents = evidence.sources.map((s) => s.document);
      return new Set(documents).size !== documents.length || documents.length === 0;
    });
    expect(bad).toEqual([]);
  });

  it('κάθε έγγραφο έχει τρόπο απόκτησης', () => {
    for (const document of OBJECTIVE_VALUE_EVIDENCE_DOCUMENTS) {
      expect(OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS[document]).toBeDefined();
    }
  });
});
