/**
 * Τα έξι πεδία λογιστικού ελέγχου, σε μορφή σύρματος.
 *
 * Ο τύπος (`SerializedUserTextTemplate` / `SerializedCustomDictionaryEntry`)
 * εγγυάται ότι **υπάρχουν** τα κλειδιά· δεν εγγυάται ότι το `createdBy` δεν
 * πήρε την τιμή του `updatedBy`. Έξι πεδία με πανομοιότυπους τύπους είναι
 * ακριβώς η περίπτωση όπου μια αντιμετάθεση περνά κάθε type-check και φαίνεται
 * μόνο σε ανθρώπινο μάτι που κοιτά την οθόνη «ποιος το άλλαξε».
 */

import { serializeAuditFields } from '../_serialize-audit-fields';

/** Ό,τι ελάχιστο ζητά η συνάρτηση: κάτι που γίνεται `Date`. */
const stamp = (iso: string) => ({ toDate: () => new Date(iso) });

const DOC = {
  createdAt: stamp('2026-01-02T03:04:05.000Z'),
  updatedAt: stamp('2026-07-31T21:15:00.000Z'),
  createdBy: 'user_dimiourgos',
  createdByName: 'Δημιουργός',
  updatedBy: 'user_tropopoiitis',
  updatedByName: 'Τροποποιητής',
};

describe('serializeAuditFields', () => {
  it('κάθε πεδίο πάει στη ΔΙΚΗ του θέση — καμία αντιμετάθεση', () => {
    expect(serializeAuditFields(DOC)).toEqual({
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-07-31T21:15:00.000Z',
      createdBy: 'user_dimiourgos',
      createdByName: 'Δημιουργός',
      updatedBy: 'user_tropopoiitis',
      updatedByName: 'Τροποποιητής',
    });
  });

  it('οι χρόνοι γίνονται ISO strings — ο admin-SDK Timestamp δεν περνά το σύρμα', () => {
    const { createdAt, updatedAt } = serializeAuditFields(DOC);

    expect(typeof createdAt).toBe('string');
    expect(typeof updatedAt).toBe('string');
  });

  it('άγνωστος συντάκτης μένει `null`, ποτέ `undefined`', () => {
    // `undefined` σε πεδίο που ο client θεωρεί δεδομένο εξαφανίζεται στο
    // `JSON.stringify` — και ο client βλέπει «λείπει το κλειδί», όχι «άγνωστο».
    const anonymous = { ...DOC, createdByName: null, updatedByName: null };

    const out = serializeAuditFields(anonymous);

    expect(out.createdByName).toBeNull();
    expect(out.updatedByName).toBeNull();
    expect(Object.keys(out)).toContain('createdByName');
  });
});
