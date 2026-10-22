/**
 * @fileoverview ADR-916 §7 Γ43 (Φ-Γ2 Σ6) — **ο έλεγχος πακέτου** (BagIt RFC 8493): ταίριασμα κατά **περιεχόμενο**, όχι
 * κατά όνομα· το όνομα λέει μόνο **ποια** γραμμή διαφέρει· ό,τι δεν κατακερματίστηκε δεν «ταιριάζει» ποτέ.
 */

import { handoverPackageCheckOf, type HandoverPackageFileEvidence } from '../handover-protocol-package-check';
import type { HandoverProtocolManifestFile } from '../handover-protocol-manifest-parse';

const FILES: readonly HandoverProtocolManifestFile[] = [
  { sourceFileId: 's1', copyFileId: 'c1', sha256: '1'.repeat(64), size: 10, name: 'Άδεια.pdf' },
  { sourceFileId: 's2', copyFileId: 'c2', sha256: '2'.repeat(64), size: 20, name: 'Κάτοψη.dwg' },
  { sourceFileId: 's3', copyFileId: 'c3', sha256: '3'.repeat(64), size: 30, name: null },
];

const given = (name: string, sha256: string | null): HandoverPackageFileEvidence => ({ name, size: 1, sha256 });

describe('Γ43 — έλεγχος πακέτου', () => {
  it('όλα τα bytes ταιριάζουν, ανεξάρτητα ονόματος ⇒ complete', () => {
    const check = handoverPackageCheckOf(FILES, [given('x.pdf', '1'.repeat(64)), given('y', '2'.repeat(64)), given('z', '3'.repeat(64))]);
    expect(check.rows.map((row) => row.status)).toEqual(['match', 'match', 'match']);
    expect(check.rows[0].providedName).toBe('x.pdf');
    expect(check.complete).toBe(true);
    expect(check.extras).toEqual([]);
  });

  it('🔴 ομώνυμο με άλλα bytes ⇒ differs, ΟΧΙ match', () => {
    const check = handoverPackageCheckOf(FILES, [given('Άδεια.pdf', 'f'.repeat(64))]);
    expect(check.rows[0]).toMatchObject({ status: 'differs', providedName: 'Άδεια.pdf' });
    expect(check.complete).toBe(false);
  });

  it('🔴 ομώνυμο ΔΕΝ κλέβει το σωστό αρχείο άλλης γραμμής', () => {
    // Το αρχείο με όνομα «Άδεια.pdf» έχει τα bytes της γραμμής 2· η γραμμή 1 δεν δόθηκε.
    const check = handoverPackageCheckOf(FILES, [given('Άδεια.pdf', '2'.repeat(64))]);
    expect(check.rows.map((row) => row.status)).toEqual(['not-provided', 'match', 'not-provided']);
  });

  it('πολύ μεγάλο για τον browser ⇒ unchecked (γραμμή) ή extra unchecked — ποτέ match', () => {
    const check = handoverPackageCheckOf(FILES, [given('Κάτοψη.dwg', null), given('video.mp4', null)]);
    expect(check.rows[1].status).toBe('unchecked');
    expect(check.extras).toEqual([{ name: 'video.mp4', reason: 'unchecked' }]);
    expect(check.complete).toBe(false);
  });

  it('αρχείο εκτός πίνακα ⇒ extra not-in-protocol· δύο ίδια bytes σε δύο γραμμές ⇒ δύο αρχεία χρειάζονται', () => {
    const twin: readonly HandoverProtocolManifestFile[] = [FILES[0], { ...FILES[0], sourceFileId: 's9', copyFileId: 'c9' }];
    const check = handoverPackageCheckOf(twin, [given('a', '1'.repeat(64)), given('zip', '9'.repeat(64))]);
    expect(check.rows.map((row) => row.status)).toEqual(['match', 'not-provided']);
    expect(check.extras).toEqual([{ name: 'zip', reason: 'not-in-protocol' }]);
  });
});
