/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.10 του ADR-866 Φ1.2** — ο αναγνώστης φακέλων: **ποιο** ερώτημα, **ποιο** σύνορο.
 * @related ADR-866 §2.8.7 Δ3 · §2.9.1 Α1 · useMyPropertyDossiers.ts · useOwnedDocuments.ts · CHECK 3.74
 *
 * Μοκάρεται η μηχανή (`useOwnedList`/`useOwnedDocument`) για να διαβαστεί η **προδιαγραφή** που της δίνεται, και το
 * `firebase/firestore` για να διαβαστεί το **ερώτημα** που χτίζει. Το σύνορο είναι το **πραγματικό**.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `where(FIELDS.AUTHOR_USER_ID, …)` | «ρωτά `userId ==`» ⇒ 🔴 |
 * | `fromDocument: (raw, id) => ({ ...raw, id }) as PropertyDossier` | «περνά από το σύνορο» ⇒ 🔴 |
 * | `orderBy` στο ερώτημα (σύνθετος δείκτης, CHECK 3.15) | «μόνο ένα `where`» ⇒ 🔴 |
 */

type Spec = {
  collectionName: string;
  buildQuery: (userId: string) => unknown;
  fromDocument: (raw: unknown, id: string) => unknown;
};

const listSpecs: Spec[] = [];
const documentSpecs: Spec[] = [];

jest.mock('@/lib/firebase', () => ({ db: { fake: 'db' } }));

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  where: (field: string, op: string, value: unknown) => ({ where: [field, op, value] }),
  query: (base: unknown, ...constraints: unknown[]) => ({ base, constraints }),
}));

jest.mock('../useOwnedDocuments', () => ({
  useOwnedList: (spec: Spec) => {
    listSpecs.push(spec);
    return { state: 'loading' };
  },
  useOwnedDocument: (spec: Spec) => {
    documentSpecs.push(spec);
    return { state: 'loading' };
  },
}));

const { useMyPropertyDossiers, useMyPropertyDossier } = require('../useMyPropertyDossiers') as
  typeof import('../useMyPropertyDossiers');
const { propertyDossierFromDocument } = require('@/lib/property-dossier/property-dossier-from-document') as
  typeof import('@/lib/property-dossier/property-dossier-from-document');

describe('🏆 Α37.10 — «οι φάκελοί μου» = `userId ==` στο `property_dossiers`, μέσω του συνόρου', () => {
  it('λίστα: η συλλογή του φακέλου, ΕΝΑ `where(userId == uid)`, κανένα `orderBy`', () => {
    useMyPropertyDossiers('citizen-7');
    const [spec] = listSpecs;

    expect(spec.collectionName).toBe('property_dossiers');
    expect(spec.buildQuery('citizen-7')).toEqual({
      base: { collection: 'property_dossiers' },
      constraints: [{ where: ['userId', '==', 'citizen-7'] }],
    });
  });

  it('λίστα ΚΑΙ ένα: το ΙΔΙΟ σύνορο ανάγνωσης (CHECK 3.74), ποτέ ωμό `as`', () => {
    useMyPropertyDossiers('citizen-7');
    useMyPropertyDossier('pdos_x', 'citizen-7');

    expect(listSpecs.at(-1)?.fromDocument).toBe(propertyDossierFromDocument);
    expect(documentSpecs.at(-1)?.fromDocument).toBe(propertyDossierFromDocument);
  });

  it('η προδιαγραφή είναι ΣΤΑΘΕΡΗ ανάμεσα σε renders (αλλιώς η συνδρομή ξαναγράφεται σε βρόχο)', () => {
    useMyPropertyDossiers('a');
    useMyPropertyDossiers('b');

    expect(listSpecs.at(-1)).toBe(listSpecs.at(-2));
  });
});
