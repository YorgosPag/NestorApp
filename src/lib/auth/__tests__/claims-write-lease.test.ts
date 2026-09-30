/**
 * @fileoverview ADR-894 §10.7 — το lease εγγραφής claims: ένας γραφέας τη φορά, ανά άνθρωπο.
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Λ1 🔴 | δύο ταυτόχρονες εργασίες για τον ΙΔΙΟ άνθρωπο ΔΕΝ επικαλύπτονται · για ΔΙΑΦΟΡΕΤΙΚΟΥΣ τρέχουν μαζί |
 * | Λ2 | εγκαταλειμμένο (ληγμένο) lease ⇒ το παίρνει ο επόμενος — κανείς δεν κλειδώνει για πάντα |
 * | Λ3 🔴 | ο πρώην κάτοχος (που το έχασε στη λήξη) ΔΕΝ ελευθερώνει το lease του επόμενου |
 * | Λ4 | απασχολημένο πέρα από την προθεσμία ⇒ ρίχνει με όνομα (fail-closed), δεν γράφει στα τυφλά |
 */

jest.mock('server-only', () => ({}));

import { Timestamp } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fake }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import {
  CLAIMS_WRITE_LEASE_DOC_ID,
  CLAIMS_WRITE_LEASE_TTL_MS,
  ClaimsWriteLeaseTimeout,
  withClaimsWriteLease,
} from '../claims-write-lease';

const leaseDoc = (uid: string) =>
  fake.collection('users').doc(uid).collection('security').doc(CLAIMS_WRITE_LEASE_DOC_ID);
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => fake.reset());

describe('withClaimsWriteLease', () => {
  it('Λ1 🔴 ίδιος άνθρωπος ⇒ σειριακά· διαφορετικοί ⇒ παράλληλα', async () => {
    const log: string[] = [];
    const work = (name: string) => async () => { log.push(`${name}+`); await tick(30); log.push(`${name}-`); };
    await Promise.all([withClaimsWriteLease('u1', work('a')), withClaimsWriteLease('u1', work('b'))]);
    expect(['a+ a- b+ b-', 'b+ b- a+ a-']).toContain(log.join(' '));

    log.length = 0;
    await Promise.all([withClaimsWriteLease('u1', work('a')), withClaimsWriteLease('u2', work('c'))]);
    expect(log.slice(0, 2).sort()).toEqual(['a+', 'c+']);
  });

  it('Λ2 — εγκαταλειμμένο lease (ληγμένο) ⇒ το παίρνει ο επόμενος, και το ελευθερώνει μετά', async () => {
    await leaseDoc('u1').set({ holder: 'crashed', expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    await expect(withClaimsWriteLease('u1', async () => 'done')).resolves.toBe('done');
    expect((await leaseDoc('u1').get()).exists).toBe(false);
  });

  it('Λ3 🔴 ο πρώην κάτοχος ΔΕΝ ελευθερώνει το lease του επόμενου', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    await withClaimsWriteLease('u1', async () => {
      clock += CLAIMS_WRITE_LEASE_TTL_MS + 1; // το lease μας έληξε· ο επόμενος το πήρε
      await leaseDoc('u1').set({ holder: 'next', expiresAt: Timestamp.fromMillis(clock + CLAIMS_WRITE_LEASE_TTL_MS) });
    }, now);
    expect((await leaseDoc('u1').get()).data()?.holder).toBe('next');
  });

  it('Λ4 — απασχολημένο πέρα από την προθεσμία ⇒ ClaimsWriteLeaseTimeout, η εργασία ΔΕΝ τρέχει', async () => {
    let clock = 1_000_000;
    await leaseDoc('u1').set({ holder: 'other', expiresAt: Timestamp.fromMillis(clock + 10 * CLAIMS_WRITE_LEASE_TTL_MS) });
    const work = jest.fn(async () => undefined);
    const now = () => { clock += CLAIMS_WRITE_LEASE_TTL_MS; return clock; };
    await expect(withClaimsWriteLease('u1', work, now)).rejects.toBeInstanceOf(ClaimsWriteLeaseTimeout);
    expect(work).not.toHaveBeenCalled();
  });
});
