/**
 * @jest-environment node
 *
 * ADR-923 §5.13 Ε6δ / Τ6 — `liveSupplyRequestHref`: προαιρετικό βήμα μετά την πράξη. Βλάβη ανάγνωσης ή υπογραφής δίνει `null`,
 * ποτέ σφάλμα που θα έριχνε την απάντηση ενός RFQ που ήδη γράφτηκε.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import type { Firestore } from 'firebase-admin/firestore';
import { liveSupplyRequestHref } from '../supply-request-link.server';
/* eslint-enable import/first */

const dbWith = (get: () => Promise<{ data: () => unknown }>) =>
  ({ collection: () => ({ doc: () => ({ get }) }) }) as unknown as Firestore;

const LIVE = { id: 'srl_1', companyId: 'comp_a', generation: 1, state: 'live' };
const previousSecret = process.env.SUPPLY_REQUEST_LINK_SECRET;
afterEach(() => { process.env.SUPPLY_REQUEST_LINK_SECRET = previousSecret; });

describe('liveSupplyRequestHref', () => {
  it('ζωντανός σύνδεσμος ⇒ η σελίδα-πύλη του', async () => {
    process.env.SUPPLY_REQUEST_LINK_SECRET = 'test-secret-for-supply-request-links-0123456789';
    await expect(liveSupplyRequestHref(dbWith(async () => ({ data: () => LIVE })), 'comp_a')).resolves.toMatch(/^\/supply-request\/.+/);
  });

  it('ανακλημένος ή ανύπαρκτος ⇒ null', async () => {
    process.env.SUPPLY_REQUEST_LINK_SECRET = 'test-secret-for-supply-request-links-0123456789';
    await expect(liveSupplyRequestHref(dbWith(async () => ({ data: () => ({ ...LIVE, state: 'revoked' }) })), 'comp_a')).resolves.toBeNull();
    await expect(liveSupplyRequestHref(dbWith(async () => ({ data: () => undefined })), 'comp_a')).resolves.toBeNull();
  });

  it('βλάβη της ανάγνωσης ⇒ null, όχι σφάλμα', async () => {
    await expect(liveSupplyRequestHref(dbWith(async () => { throw new Error('UNAVAILABLE'); }), 'comp_a')).resolves.toBeNull();
  });

  it('χωρίς μυστικό υπογραφής ⇒ null, όχι σφάλμα', async () => {
    delete process.env.SUPPLY_REQUEST_LINK_SECRET;
    await expect(liveSupplyRequestHref(dbWith(async () => ({ data: () => LIVE })), 'comp_a')).resolves.toBeNull();
  });
});
