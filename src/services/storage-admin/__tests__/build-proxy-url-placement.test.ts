/**
 * ADR-895 Φ0 — άγκυρα: το proxy URL μεταφέρει τη θέση bytes **μόνο** όταν δεν είναι legacy.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: legacy URL αποκτά παράμετρο (σπάει κάθε αποθηκευμένο `downloadUrl`) ·
 * URL ΕΕ χωρίς παράμετρο (ο proxy θα διάβαζε τον κανονικό κάδο ⇒ σιωπηλό 404).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: jest.fn(),
  getAdminFirestore: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn() },
}));

import { API_ROUTES } from '@/config/domain-constants';
import { FILE_STORAGE_PLACEMENT_QUERY_PARAM, fileStoragePlacementOf } from '@/lib/files/file-storage-placement';
import { buildProxyUrl } from '../public-upload.service';

const PATH = 'companies/c1/entities/project/p1/domains/media/files/file_1 photo.jpg';

describe('buildProxyUrl — η θέση ταξιδεύει μέσα στο URL (ADR-895)', () => {
  test('Υ1 legacy (ρητά ή σιωπηρά) ⇒ το URL πριν το ADR-895, αυτολεξεί', () => {
    const expected = `${API_ROUTES.STORAGE_FILE}/companies/c1/entities/project/p1/domains/media/files/file_1%20photo.jpg`;
    expect(buildProxyUrl(PATH)).toBe(expected);
    expect(buildProxyUrl(PATH, 'legacy-default')).toBe(expected);
  });

  test('🔴 Υ2 ΕΕ ⇒ η παράμετρος υπάρχει και ο κριτής τη διαβάζει πίσω ως την ίδια θέση', () => {
    const url = new URL(buildProxyUrl(PATH, 'eu-originals'), 'https://nestor.test');
    const carried = url.searchParams.get(FILE_STORAGE_PLACEMENT_QUERY_PARAM);
    expect(carried).toBe('eu-originals');
    expect(fileStoragePlacementOf({ storagePlacement: carried })).toBe('eu-originals');
  });
});
