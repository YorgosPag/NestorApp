/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΝΑΝΕΩΣΗ ΤΟΥ ΟΝΟΜΑΤΟΣ ΔΕΝ ΠΕΤΑ ΠΟΤΕ** — ADR-841 §7 Α1.6 · Α22.
 * @related services/listings/agency-name-refresh.ts
 *
 * 🔴 **Τι φυλά**: τρεις πράξεις *(μετονομασία, δημοσίευση βιτρίνας, απόσυρση/ανάκληση)*
 * καλούν αυτή τη συνάρτηση **αφού** η αλήθεια γράφτηκε. Αν πέταγε, μια αστοχία παραγώγου
 * θα ακύρωνε ρυθμιστική απόφαση (Π2) ή θα έριχνε 500 σε αποθήκευση που **πέτυχε**.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const republishMock = jest.fn();
jest.mock('@/services/listings/rebuild-public-listings.service', () => ({
  republishListingsForCompany: (...args: unknown[]) => republishMock(...args),
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { refreshAgencyNameOnListings } from '@/services/listings/agency-name-refresh';

const DB = {} as unknown as AdminFirestore;

const REPORT = {
  companyId: 'comp_alfa',
  scannedProperties: 2,
  scannedOwnerProperties: 1,
  published: 3,
  withdrawn: 0,
  failed: 0,
  balanced: true,
};

beforeEach(() => jest.clearAllMocks());

describe('refreshAgencyNameOnListings', () => {
  it('Α1 — ρωτά ΤΟΝ ΕΝΑ βρόχο του οργανισμού και επιστρέφει τη λογιστική του', async () => {
    republishMock.mockResolvedValue(REPORT);

    const report = await refreshAgencyNameOnListings(DB, 'comp_alfa', 'showcase-published');

    expect(republishMock).toHaveBeenCalledWith(DB, 'comp_alfa');
    expect(report).toEqual(REPORT);
  });

  it('🔴 Α2 — ΒΛΑΒΗ του περάσματος ⇒ `null`, ΠΟΤΕ εξαίρεση', async () => {
    republishMock.mockRejectedValue(new Error('DEADLINE_EXCEEDED'));

    await expect(refreshAgencyNameOnListings(DB, 'comp_alfa', 'showcase-withdrawn')).resolves.toBeNull();
  });

  it('🔑 Α3 — ΜΕΡΙΚΗ αποτυχία ΕΠΙΣΤΡΕΦΕΤΑΙ όπως είναι: ο καλών βλέπει τα `failed`', async () => {
    const partial = { ...REPORT, published: 2, failed: 1 };
    republishMock.mockResolvedValue(partial);

    await expect(refreshAgencyNameOnListings(DB, 'comp_alfa', 'company-renamed')).resolves.toEqual(partial);
  });
});
