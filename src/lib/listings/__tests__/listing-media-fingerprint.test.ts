/**
 * @fileoverview 🧬 **ΤΟ ΑΠΟΤΥΠΩΜΑ ΜΕΣΩΝ** — ADR-845 §7.17 Α5 (κλάση Ο-35).
 * @related lib/listings/listing-media-fingerprint.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: το αποτύπωμα είναι ο τρόπος με τον οποίο η συμφιλίωση λέει *«συμφωνεί»*. Αν
 * αλλάξει χωρίς να αλλάξει το υλικό, κάθε αγγελία ξαναψήνεται κάθε βράδυ· αν **δεν** αλλάξει όταν
 * αλλάζει το υλικό, η πόρτα που ξέφυγε μένει αόρατη.
 */

import { mediaAgreement, mediaFingerprintInput, stampOf } from '../listing-media-fingerprint';

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

describe('ADR-845 §7.17 Α5 — τρεις απαντήσεις, και η απουσία δεν είναι «συμφωνεί»', () => {
  const current = stampOf('abc');

  it('Φ5 — ίδιο αποτύπωμα ⇒ `current` · άλλο ⇒ `stale`', () => {
    expect(mediaAgreement(stampOf('abc'), current)).toBe('current');
    expect(mediaAgreement(stampOf('def'), current)).toBe('stale');
  });

  it('🔴 Φ6 — απόν · άκυρο · ΑΛΛΗΣ έκδοσης ⇒ `unknown`, ΠΟΤΕ `current` και ΠΟΤΕ `stale`', () => {
    expect(mediaAgreement(undefined, current)).toBe('unknown');
    expect(mediaAgreement(null, current)).toBe('unknown');
    expect(mediaAgreement(42, current)).toBe('unknown');
    expect(mediaAgreement('v0:abc', current)).toBe('unknown');
    expect(mediaAgreement('abc', current)).toBe('unknown');
  });
});
