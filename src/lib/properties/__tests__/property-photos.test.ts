/**
 * 📷 Η ΑΓΚΥΡΑ ΤΗΣ ΣΕΙΡΑΣ ΤΩΝ ΦΩΤΟΓΡΑΦΙΩΝ ΤΟΥ ΑΚΙΝΗΤΟΥ (ADR-777 §8.30).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Φ1: η δηλωμένη σειρά (εξώφυλλο) αγνοείται ⇒ η κεφαλίδα δείχνει πρώτη άλλη φωτογραφία από την αγγελία.
 * - Φ2: εγγραφή χωρίς `downloadUrl` πετιέται ⇒ το σύμπτωμα του 2026-10-01 (εικονίδιο-σπίτι).
 * - Φ3: φωτογραφία που δεν δείχνεται χάνεται σιωπηλά αντί να ονομαστεί.
 */

import { buildProxyUrl } from '@/lib/storage/storage-object-url';

import { propertyPhotosOf } from '../property-photos';

const pathOf = (id: string): string => `companies/c1/entities/property/p1/domains/sales/categories/photos/files/${id}.jpg`;
const SPOT = { floorplanFileId: 'plan_1', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 };

const FILES = [
  { id: 'file_a', displayName: 'Εσωτερικό', storagePath: pathOf('file_a') },
  { id: 'file_b', displayName: 'Εξωτερικό', storagePath: pathOf('file_b'), downloadUrl: 'https://x.test/b.jpg' },
  { id: 'file_c', displayName: 'Κουζίνα', storagePath: pathOf('file_c') },
];

describe('propertyPhotosOf', () => {
  test('🔴 Φ1 η δηλωμένη σειρά νικά· οι υπόλοιπες μένουν με τη σειρά ανάγνωσης', () => {
    const { photos } = propertyPhotosOf(FILES, { publishedMediaOrder: ['file_c'] });
    expect(photos.map((p) => p.fileId)).toEqual(['file_c', 'file_a', 'file_b']);
  });

  test('🔴 Φ2 εγγραφή χωρίς downloadUrl φαίνεται, με URL από το storagePath', () => {
    const { photos } = propertyPhotosOf(FILES, {});
    expect(photos[0]).toEqual({ fileId: 'file_a', url: buildProxyUrl(pathOf('file_a')), preview: null, title: 'Εσωτερικό', hasCaptureSpot: false });
    expect(photos[1].url).toBe('https://x.test/b.jpg');
  });

  test('🔴 Φ3 ό,τι δεν δείχνεται ονομάζεται', () => {
    const { photos, unavailable } = propertyPhotosOf([...FILES, { id: 'file_d', storagePath: '' }], {});
    expect(photos).toHaveLength(3);
    expect(unavailable).toEqual([{ fileId: 'file_d', why: 'no-storage-path' }]);
  });

  test('Φ4 το σημείο λήψης (ADR-897) σημαίνεται ανά φωτογραφία', () => {
    const { photos } = propertyPhotosOf(FILES, { publishedPhotoCaptureSpots: { file_b: SPOT } });
    expect(photos.map((p) => p.hasCaptureSpot)).toEqual([false, true, false]);
  });
});
