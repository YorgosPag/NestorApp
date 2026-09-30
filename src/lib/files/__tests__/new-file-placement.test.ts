/**
 * ADR-895 §4 · Φ3 — άγκυρες της ΜΙΑΣ πολιτικής θέσης νέου αρχείου.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: `tour-eu` ⇒ legacy (τα πρώτα bytes ΕΕ δεν φτάνουν ποτέ) · legacy ⇒ ΕΕ (bytes ΕΕ
 * περνούν από τις ΗΠΑ πριν φτάσουν, τα πλακίδια μένουν εκεί) · απάντηση εκτός λεξιλογίου.
 */

import { TOUR_MEDIA_PLACEMENTS, TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS } from '@/constants/spatial-tour-vocabulary';
import { FILE_STORAGE_PLACEMENTS } from '@/lib/files/file-storage-placement';
import { placementForNewFile } from '@/lib/files/new-file-placement';

describe('placementForNewFile — λήψη περιήγησης', () => {
  test('🔴 καραντίνα στον κάδο μέσων ΕΕ (`tour-eu`) ⇒ `eu-originals`', () => {
    expect(placementForNewFile({ kind: 'tour-capture', ingestPlacement: 'tour-eu' })).toBe('eu-originals');
  });

  test('🔴 καραντίνα στον κανονικό κάδο ⇒ `legacy-default` — ποτέ ΕΕ με bytes που πέρασαν από τις ΗΠΑ', () => {
    expect(placementForNewFile({ kind: 'tour-capture', ingestPlacement: 'legacy-default' })).toBe('legacy-default');
  });

  test('κάθε νέα περιήγηση (`tour-genesis`) ⇒ πανοράματα στην ΕΕ', () => {
    expect(placementForNewFile({ kind: 'tour-capture', ingestPlacement: TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS })).toBe('eu-originals');
  });

  test.each(TOUR_MEDIA_PLACEMENTS)('θέση μέσων `%s` ⇒ απάντηση ΜΕΣΑ στο λεξιλόγιο θέσεων αρχείου', (ingestPlacement) => {
    expect(FILE_STORAGE_PLACEMENTS).toContain(placementForNewFile({ kind: 'tour-capture', ingestPlacement }));
  });
});
