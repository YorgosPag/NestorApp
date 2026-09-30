/**
 * ADR-895 Α1/Α2 — άγκυρες του καθαρού κριτή θέσης bytes.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: άγνωστη τιμή ⇒ legacy (σιωπηλό fallback) · απόν ⇒ ΕΕ ·
 * ανταλλαγή ονομάτων κάδων · ξένος κάδος αναγνωρίζεται ως δικός μας.
 */

import {
  FILE_STORAGE_PLACEMENTS,
  FILE_STORAGE_PLACEMENT_LEGACY,
  UnknownFileStoragePlacementError,
  fileStorageBucketNameOf,
  fileStoragePlacementOf,
  fileStoragePlacementOfBucketName,
  isFileStoragePlacement,
  type FileStorageBucketNames,
} from '@/lib/files/file-storage-placement';

const NAMES: FileStorageBucketNames = { 'legacy-default': 'proj.firebasestorage.app', 'eu-originals': 'proj-files-eu' };

describe('fileStoragePlacementOf — η θέση που ισχύει', () => {
  test('Θ1 απόν / null ⇒ legacy (κάθε εγγραφή πριν το ADR-895, κανένα backfill)', () => {
    expect(fileStoragePlacementOf({})).toBe('legacy-default');
    expect(fileStoragePlacementOf({ storagePlacement: undefined })).toBe('legacy-default');
    expect(fileStoragePlacementOf({ storagePlacement: null })).toBe(FILE_STORAGE_PLACEMENT_LEGACY);
  });

  test('Θ2 γνωστή θέση ⇒ αυτή', () => {
    for (const placement of FILE_STORAGE_PLACEMENTS) {
      expect(fileStoragePlacementOf({ storagePlacement: placement })).toBe(placement);
    }
  });

  test.each([['tour-eu'], [''], ['EU-ORIGINALS'], [42], [{}]])(
    '🔴 Θ3 άγνωστη τιμή %p ⇒ ΠΕΤΑ, ποτέ σιωπηλά «κανονικός κάδος»',
    (value) => {
      expect(() => fileStoragePlacementOf({ storagePlacement: value })).toThrow(UnknownFileStoragePlacementError);
    },
  );
});

describe('fileStorageBucketNameOf — όνομα κάδου ανά εγγραφή', () => {
  test('Κ1 legacy ⇒ κανονικός · ΕΕ ⇒ files-eu', () => {
    expect(fileStorageBucketNameOf({}, NAMES)).toBe('proj.firebasestorage.app');
    expect(fileStorageBucketNameOf({ storagePlacement: 'eu-originals' }, NAMES)).toBe('proj-files-eu');
  });

  test('🔴 Κ2 άγνωστη θέση ⇒ πετά και εδώ (κανένα όνομα)', () => {
    expect(() => fileStorageBucketNameOf({ storagePlacement: 'mars' }, NAMES)).toThrow(UnknownFileStoragePlacementError);
  });
});

describe('fileStoragePlacementOfBucketName — αντίστροφη απεικόνιση (SSRF · manifest)', () => {
  test('Α1 κάθε δικός μας κάδος ⇒ η θέση του', () => {
    expect(fileStoragePlacementOfBucketName('proj.firebasestorage.app', NAMES)).toBe('legacy-default');
    expect(fileStoragePlacementOfBucketName('proj-files-eu', NAMES)).toBe('eu-originals');
  });

  test('🔴 Α2 ξένος κάδος (και ο κάδος μέσων περιήγησης) ⇒ null', () => {
    expect(fileStoragePlacementOfBucketName('evil-bucket', NAMES)).toBeNull();
    expect(fileStoragePlacementOfBucketName('proj-tour-media', NAMES)).toBeNull();
  });
});

describe('isFileStoragePlacement', () => {
  test('δέχεται μόνο το λεξιλόγιο', () => {
    expect(isFileStoragePlacement('eu-originals')).toBe(true);
    expect(isFileStoragePlacement('tour-eu')).toBe(false);
    expect(isFileStoragePlacement(undefined)).toBe(false);
  });
});
