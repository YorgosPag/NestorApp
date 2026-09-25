/**
 * ⚓ ADR-841 Α9.1/Α9.2 · ADR-884 #2 — ο αναγνώστης της απόδειξης (μετακόμισε από το showcase-read)
 * και ο πήχης «εγγραφή σε ΑΥΤΗ την αρχή».
 */

import { attestsNationalRegistry, readProfessionalAttestation } from '../professional-attestation';

describe('readProfessionalAttestation', () => {
  it('απουσία ⇒ unknown (σιωπή, όχι άρνηση)', () => {
    expect(readProfessionalAttestation(undefined)).toEqual({ state: 'unknown' });
  });

  it('εθνική αρχή: αριθμός αρκεί', () => {
    expect(readProfessionalAttestation({ state: 'declared', registration: { authority: 'tee', number: ' 123 ' } }))
      .toEqual({ state: 'declared', registration: { authorityKind: 'national', authority: 'tee', number: '123' } });
  });

  it('🔴 αρχή με συλλόγους χωρίς σύλλογο ⇒ null (Α9.1: «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται)', () => {
    expect(readProfessionalAttestation({ state: 'declared', registration: { authority: 'bar-association', number: '1' } }))
      .toBeNull();
  });

  it('🔴 άγνωστη κατάσταση ή αρχή ⇒ null', () => {
    expect(readProfessionalAttestation({ state: 'trusted', registration: { authority: 'tee', number: '1' } })).toBeNull();
    expect(readProfessionalAttestation({ state: 'declared', registration: { authority: 'nasa', number: '1' } })).toBeNull();
  });
});

describe('attestsNationalRegistry', () => {
  const tee = { authorityKind: 'national', authority: 'tee', number: '123' } as const;

  it('declared ή verified στην ίδια αρχή ⇒ περνά', () => {
    expect(attestsNationalRegistry({ state: 'declared', registration: tee }, 'tee')).toBe(true);
    expect(attestsNationalRegistry({ state: 'verified', registration: tee }, 'tee')).toBe(true);
  });

  it('🔴 unknown · άλλη αρχή ⇒ δεν περνά', () => {
    expect(attestsNationalRegistry({ state: 'unknown' }, 'tee')).toBe(false);
    expect(attestsNationalRegistry({ state: 'declared', registration: { ...tee, authority: 'gemi' } }, 'tee')).toBe(false);
  });
});
