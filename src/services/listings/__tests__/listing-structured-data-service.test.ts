/**
 * @fileoverview **Η φόρτωση των δομημένων δεδομένων στον διακομιστή** (ADR-907 §10.10).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Λ1: αποτυχία ανάγνωσης ρίχνει τη σελίδα της αγγελίας (5xx) αντί να σιωπήσει.
 * - Λ2: αγγελία που δεν είναι δημοσιευμένη δίνει κάτι άλλο από `null`.
 * - Λ3: η ανάγνωση δεν περνά από τον αναγνώστη του συνόρου (CHECK 3.74).
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';

import { loadListingStructuredData } from '../listing-structured-data.service';
import { readPublicListingById } from '../public-listing-by-id.reader';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('../public-listing-by-id.reader', () => ({ readPublicListingById: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const reader = readPublicListingById as jest.MockedFunction<typeof readPublicListingById>;
const adminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;
const ADMIN_DB = { marker: 'admin-db' } as never;

const SHELF = 'https://storage.googleapis.com/public-shelf/listings/l1';
const VIDEO = {
  provenance: 'declared',
  at: '2026-10-09T18:30:00.000Z',
  value: {
    url: `${SHELF}/clip.mp4`,
    altKey: 'listing-detail:video.alt.agency',
    width: 1024,
    height: 464,
    durationSec: 9,
    poster: { url: `${SHELF}/poster.webp`, width: 1024, height: 464, altKey: 'k', sources: [{ url: `${SHELF}/poster.webp`, width: 1024 }] },
  },
};

describe('loadListingStructuredData', () => {
  beforeEach(() => {
    reader.mockReset();
    adminFirestore.mockReset();
    adminFirestore.mockReturnValue(ADMIN_DB);
  });

  it('🔴 Λ3 διαβάζει μέσα από τον αναγνώστη του συνόρου και δηλώνει το βίντεο', async () => {
    reader.mockResolvedValue({ id: 'l1', title: 'Μεζονέτα', videos: [VIDEO] } as never);

    await expect(loadListingStructuredData('l1')).resolves.toMatchObject({
      '@type': 'VideoObject',
      contentUrl: `${SHELF}/clip.mp4`,
    });
    expect(reader).toHaveBeenCalledWith(ADMIN_DB, 'l1');
  });

  it('🔴 Λ2 αγγελία που δεν είναι δημοσιευμένη ⇒ null', async () => {
    reader.mockResolvedValue(null);
    await expect(loadListingStructuredData('l1')).resolves.toBeNull();
  });

  it('αγγελία χωρίς βίντεο ⇒ null', async () => {
    reader.mockResolvedValue({ id: 'l1', title: 'Μεζονέτα', videos: [] } as never);
    await expect(loadListingStructuredData('l1')).resolves.toBeNull();
  });

  it('🔴 Λ1 διακομιστής χωρίς διαπιστευτήρια Admin ⇒ null, ποτέ εξαίρεση προς τη σελίδα', async () => {
    adminFirestore.mockImplementation(() => {
      throw new Error('no credentials');
    });
    await expect(loadListingStructuredData('l1')).resolves.toBeNull();
    expect(reader).not.toHaveBeenCalled();
  });

  it('🔴 Λ1 αποτυχία ανάγνωσης ⇒ null, ποτέ εξαίρεση προς τη σελίδα', async () => {
    reader.mockRejectedValue(new Error('UNAVAILABLE'));
    await expect(loadListingStructuredData('l1')).resolves.toBeNull();
  });
});
