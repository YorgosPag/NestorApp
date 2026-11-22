/**
 * @fileoverview 🧬 **ΤΟ ΑΠΟΤΥΠΩΜΑ ΜΕΣΩΝ** — ADR-845 §7.17 Α5 (κλάση Ο-35).
 * @related lib/listings/listing-media-fingerprint.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: το αποτύπωμα είναι ο τρόπος με τον οποίο η συμφιλίωση λέει *«συμφωνεί»*. Αν
 * αλλάξει χωρίς να αλλάξει το υλικό, κάθε αγγελία ξαναψήνεται κάθε βράδυ· αν **δεν** αλλάξει όταν
 * αλλάζει το υλικό, η πόρτα που ξέφυγε μένει αόρατη.
 */

import {
  mediaAgreement,
  mediaFingerprintInput,
  mediaRecipesInput,
  recipeAgreement,
  stampOf,
} from '../listing-media-fingerprint';

type Sources = Parameters<typeof mediaFingerprintInput>[0];

function photo(id: string, extra: Record<string, unknown> = {}): Sources[number] {
  return {
    privateStoragePath: `companies/c/${id}.jpg`,
    storagePlacement: undefined,
    material: 'photo',
    focalPoint: null,
    sourceFileId: id,
    captureSpot: null,
    northRad: null,
    ...extra,
  } as unknown as Sources[number];
}

describe('ADR-845 §7.17 Α5 — η κανονική μορφή του αποτυπώματος', () => {
  it('Φ1 — ίδιο υλικό ⇒ ίδια συμβολοσειρά, ΑΝΕΞΑΡΤΗΤΑ από τη σειρά των κλειδιών', () => {
    const forward = photo('a', { focalPoint: { x: 0.2, y: 0.8 } });
    const reversed = photo('a', { focalPoint: { y: 0.8, x: 0.2 } });

    expect(mediaFingerprintInput([forward])).toBe(mediaFingerprintInput([reversed]));
  });

  it('🔴 Φ2 — η ΣΕΙΡΑ των μέσων είναι υλικό: αλλαγή σειράς ⇒ άλλη συμβολοσειρά', () => {
    expect(mediaFingerprintInput([photo('a'), photo('b')]))
      .not.toBe(mediaFingerprintInput([photo('b'), photo('a')]));
  });

  it('🔴 Φ3 — ΚΑΘΕ πεδίο της πηγής μετράει, όχι επιλεγμένα: εστίαση · είδος · αρχείο που έφυγε', () => {
    const base = mediaFingerprintInput([photo('a'), photo('b')]);

    expect(mediaFingerprintInput([photo('a', { focalPoint: { x: 0.5, y: 0.5 } }), photo('b')])).not.toBe(base);
    expect(mediaFingerprintInput([photo('a', { material: 'floorplan' }), photo('b')])).not.toBe(base);
    expect(mediaFingerprintInput([photo('a')])).not.toBe(base);
  });

  it('🔑 Φ4 — πεδίο που προστίθεται ΑΥΡΙΟ στην πηγή μπαίνει χωρίς να το θυμηθεί κανείς', () => {
    expect(mediaFingerprintInput([photo('a', { fieldOfTomorrow: 1 })]))
      .not.toBe(mediaFingerprintInput([photo('a')]));
  });
});

const SRC_A = 'a'.repeat(64);
const SRC_B = 'b'.repeat(64);
const RCP_1 = '1'.repeat(64);
const RCP_2 = '2'.repeat(64);

describe('ADR-845 §7.17 Α5 — τρεις απαντήσεις, και η απουσία δεν είναι «συμφωνεί»', () => {
  const current = stampOf(SRC_A, RCP_1);

  it('Φ5 — ίδιο υλικό ⇒ `current` · άλλο ⇒ `stale`', () => {
    expect(current).toBe(`v3:${SRC_A}:${RCP_1}`);
    expect(mediaAgreement(stampOf(SRC_A, RCP_1), current)).toBe('current');
    expect(mediaAgreement(stampOf(SRC_B, RCP_1), current)).toBe('stale');
  });

  it('🔴 Φ6 — απόν · άκυρο · ΑΛΛΗΣ έκδοσης ⇒ `unknown`, ΠΟΤΕ `current` και ΠΟΤΕ `stale`', () => {
    expect(mediaAgreement(undefined, current)).toBe('unknown');
    expect(mediaAgreement(null, current)).toBe('unknown');
    expect(mediaAgreement(42, current)).toBe('unknown');
    expect(mediaAgreement(`v0:${SRC_A}`, current)).toBe('unknown');
    expect(mediaAgreement(SRC_A, current)).toBe('unknown');
    expect(mediaAgreement(`v3:${SRC_A}`, current)).toBe('unknown');
    expect(mediaAgreement(`v2:${SRC_A}:${RCP_1}`, current)).toBe('unknown');
    expect(mediaAgreement(`v3:${SRC_A}:${RCP_1}:x`, current)).toBe('unknown');
  });
});

describe('ADR-920 §14.9 Γ — η ΣΥΝΤΑΓΗ είναι άλλη ερώτηση από το ΥΛΙΚΟ', () => {
  const current = stampOf(SRC_A, RCP_1);

  it('🏆 Φ7 — άλλαξε ΜΟΝΟ η συνταγή ⇒ υλικό `current` (κανένας ψευδής συναγερμός) · συνταγή `outdated`', () => {
    const stored = stampOf(SRC_A, RCP_2);
    expect(mediaAgreement(stored, current)).toBe('current');
    expect(recipeAgreement(stored, current)).toBe('outdated');
    expect(recipeAgreement(current, current)).toBe('current');
  });

  it('🔑 Φ8 — ένα v2 (πριν από τις συνταγές) συγκρίνεται στο υλικό κανονικά · η συνταγή του είναι `outdated`', () => {
    expect(mediaAgreement(`v2:${SRC_A}`, current)).toBe('current');
    expect(mediaAgreement(`v2:${SRC_B}`, current)).toBe('stale');
    expect(recipeAgreement(`v2:${SRC_A}`, current)).toBe('outdated');
  });

  it('🔴 Φ9 — ό,τι δεν διαβάζεται ⇒ συνταγή `outdated`, ΠΟΤΕ `current`', () => {
    for (const stored of [undefined, null, 42, '', `v3:${SRC_A}`]) expect(recipeAgreement(stored, current)).toBe('outdated');
  });

  it('Φ10 — οι συνταγές είναι ανά πηγή, με τη ΣΕΙΡΑ της', () => {
    expect(mediaRecipesInput([['a'], ['b']])).not.toBe(mediaRecipesInput([['b'], ['a']]));
    expect(mediaRecipesInput([['a', 'b']])).not.toBe(mediaRecipesInput([['a'], ['b']]));
  });
});
