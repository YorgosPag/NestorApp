/**
 * @jest-environment node
 *
 * @fileoverview ADR-934 §5.2.2 Μ-β5 — **η αποδέσμευση της καραντίνας και το δίχτυ της**, με ψεύτικη βάση και πραγματικούς κριτές:
 *   • παρτίδα τελείωσε ⇒ ό,τι κατέβασε πάει στον κάδο με \`purgeAt\` +30 ημέρες, ίχνος \`delete\` από τον δράστη συστήματος·
 *   • 🔑 περιεχόμενο που κρατά ΑΛΛΗ ανοιχτή παρτίδα ⇒ μένει ζωντανό·
 *   • ιδεμπότητα: δεύτερη αποδέσμευση δεν μεταθέτει το ρολόι, δεν γράφει δεύτερο ίχνος·
 *   • ξένος χώρος / αποτυχημένη λήψη ⇒ ανέγγιχτα·
 *   • δίχτυ Α (παρτίδες στο παράθυρο) · Β (ορφανά στο παράθυρο, μόνο χωρίς καμία λήψη).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

const fake = new FakeFirestore();
const mockAudits: Array<Record<string, unknown>> = [];

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  FieldValue: { serverTimestamp: () => '2026-11-09T10:00:00.000Z' },
  getAdminFirestore: (): Firestore => fake as unknown as Firestore,
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async (input: Record<string, unknown>) => {
    mockAudits.push(input);
    return 'audit';
  }),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί ο γραφέας */
import { MEDIA_RELEASE_ACTOR, mediaContentHold, releaseBatchMedia } from '../media-quarantine-release.server';
import { sweepMediaQuarantine } from '../media-quarantine-sweep.server';
/* eslint-enable import/first */

// ADR-934 §5.2.2 Μ-β6 — η καραντίνα ζει στον χώρο συστήματος, ποτέ στο `files` του ανθρώπου.
const SYSTEM_FILES = COLLECTIONS.FILES_SYSTEM;
const FETCHES = COLLECTIONS.CATALOG_IMPORT_ASSET_FETCHES;
const BATCHES = COLLECTIONS.CATALOG_IMPORT_BATCHES;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const DAY = 86_400_000;

const content = (fileId: string, sha256: string, extra: Record<string, unknown> = {}) => ({
  companyId: 'comp_1', entityType: 'catalog_media_content', entityId: sha256, status: 'ready', isDeleted: false,
  storagePath: `companies/comp_1/catalog/documents/${fileId}.pdf`, contentType: 'application/pdf', ...extra,
});
const batch = (status: string, extra: Record<string, unknown> = {}) => ({
  companyId: 'comp_1', status, isDeleted: false, revision: 1, updatedAt: '2026-11-09T10:00:00.000Z', ...extra,
});
const fetchDoc = (batchId: string, fileId: string, sha256: string, extra: Record<string, unknown> = {}) => ({
  companyId: 'comp_1', batchId, uri: `https://cdn.example.com/${fileId}`, status: 'ready', content: { fileId, sha256 }, ...extra,
});

beforeEach(() => {
  fake.reset();
  mockAudits.length = 0;
});

describe('releaseBatchMedia — κύριος δρόμος', () => {
  it('παρτίδα εγκαταλείφθηκε ⇒ το περιεχόμενό της στον κάδο, +30 ημέρες, δράστης συστήματος, ίχνος `delete`', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A));
    expect(await releaseBatchMedia('comp_1', 'cibat_1')).toEqual({ released: 1, held: 0, checked: 1 });
    const record = fake.getAllDocs(SYSTEM_FILES).file_a;
    expect(record).toMatchObject({ isDeleted: true, lifecycleState: 'trashed', trashedBy: MEDIA_RELEASE_ACTOR });
    const days = (Date.parse(String(record.purgeAt)) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(mockAudits).toEqual([expect.objectContaining({ fileId: 'file_a', action: 'delete', performedBy: MEDIA_RELEASE_ACTOR, companyId: 'comp_1' })]);
  });

  it('🔑 ίδια bytes κρατά ΑΛΛΗ ανοιχτή παρτίδα ⇒ μένουν ζωντανά', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(BATCHES, 'cibat_2', batch('reviewing'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A));
    fake.seed(FETCHES, 'f2', fetchDoc('cibat_2', 'file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A));
    expect(await releaseBatchMedia('comp_1', 'cibat_1')).toEqual({ released: 0, held: 1, checked: 1 });
    expect(fake.getAllDocs(SYSTEM_FILES).file_a.isDeleted).toBe(false);
    expect(await mediaContentHold('comp_1', 'file_a')).toBe('openBatch');
  });

  it('η άλλη παρτίδα είναι κι αυτή τελειωμένη (ή σβησμένη) ⇒ στον κάδο', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(BATCHES, 'cibat_2', batch('closed'));
    fake.seed(BATCHES, 'cibat_3', batch('reviewing', { isDeleted: true }));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A));
    fake.seed(FETCHES, 'f2', fetchDoc('cibat_2', 'file_a', SHA_A));
    fake.seed(FETCHES, 'f3', fetchDoc('cibat_3', 'file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A));
    expect((await releaseBatchMedia('comp_1', 'cibat_1')).released).toBe(1);
  });

  it('🔑 ιδεμπότητο: δεύτερη αποδέσμευση δεν μεταθέτει το `purgeAt`, δεν γράφει δεύτερο ίχνος', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A));
    await releaseBatchMedia('comp_1', 'cibat_1');
    const first = fake.getAllDocs(SYSTEM_FILES).file_a.purgeAt;
    expect(await releaseBatchMedia('comp_1', 'cibat_1')).toEqual({ released: 0, held: 0, checked: 1 });
    expect(fake.getAllDocs(SYSTEM_FILES).file_a.purgeAt).toBe(first);
    expect(mockAudits).toHaveLength(1);
  });

  it('αποτυχημένες λήψεις και ξένος χώρος ⇒ ανέγγιχτα', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A, { status: 'failed' }));
    fake.seed(FETCHES, 'f2', fetchDoc('cibat_1', 'file_b', SHA_B, { companyId: 'comp_2' }));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_b', content('file_b', SHA_B, { companyId: 'comp_2' }));
    expect(await releaseBatchMedia('comp_1', 'cibat_1')).toEqual({ released: 0, held: 0, checked: 0 });
    expect(fake.getAllDocs(SYSTEM_FILES).file_b.isDeleted).toBe(false);
  });

  it('🔴 εγγραφή με ΑΛΛΑ bytes στο κλειδί ⇒ δεν πετιέται (ο κριτής κατάστασης λέει foreign)', async () => {
    fake.seed(BATCHES, 'cibat_1', batch('discarded'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_1', 'file_a', SHA_A));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_B));
    expect((await releaseBatchMedia('comp_1', 'cibat_1')).released).toBe(0);
    expect(fake.getAllDocs(SYSTEM_FILES).file_a.isDeleted).toBe(false);
  });
});

describe('sweepMediaQuarantine — το δίχτυ', () => {
  const NOW = Date.parse('2026-11-20T04:39:00.000Z');
  const iso = (ms: number) => new Date(ms).toISOString();

  it('Α: τελειωμένη παρτίδα ΜΕΣΑ στο παράθυρο ⇒ αποδεσμεύεται· έξω από αυτό (πολύ νέα / πολύ παλιά) ⇒ όχι', async () => {
    fake.seed(BATCHES, 'cibat_in', batch('discarded', { updatedAt: iso(NOW - 3 * DAY) }));
    fake.seed(BATCHES, 'cibat_new', batch('discarded', { updatedAt: iso(NOW - 2 * 3_600_000) }));
    fake.seed(BATCHES, 'cibat_old', batch('closed', { updatedAt: iso(NOW - 20 * DAY) }));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_in', 'file_a', SHA_A));
    fake.seed(FETCHES, 'f2', fetchDoc('cibat_new', 'file_b', SHA_B));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A, { createdAt: new Date(NOW - 3 * DAY) }));
    fake.seed(SYSTEM_FILES, 'file_b', content('file_b', SHA_B, { createdAt: new Date(NOW - 3 * DAY) }));
    const metrics = await sweepMediaQuarantine(fake as unknown as Firestore, NOW);
    expect(metrics).toMatchObject({ batches: 1, released: 1 });
    expect(fake.getAllDocs(SYSTEM_FILES).file_a.isDeleted).toBe(true);
    expect(fake.getAllDocs(SYSTEM_FILES).file_b.isDeleted).toBe(false);
  });

  it('Β: ορφανό (καμία λήψη) στο παράθυρο ⇒ κάδος· με λήψη ανοιχτής παρτίδας ⇒ μένει· πολύ νέο ⇒ ανέγγιχτο', async () => {
    fake.seed(BATCHES, 'cibat_open', batch('reviewing'));
    fake.seed(FETCHES, 'f1', fetchDoc('cibat_open', 'file_b', SHA_B));
    fake.seed(SYSTEM_FILES, 'file_a', content('file_a', SHA_A, { createdAt: new Date(NOW - 8 * DAY) }));
    fake.seed(SYSTEM_FILES, 'file_b', content('file_b', SHA_B, { createdAt: new Date(NOW - 8 * DAY) }));
    fake.seed(SYSTEM_FILES, 'file_c', content('file_c', 'c'.repeat(64), { createdAt: new Date(NOW - 2 * DAY) }));
    const metrics = await sweepMediaQuarantine(fake as unknown as Firestore, NOW);
    expect(metrics).toMatchObject({ orphansChecked: 2, orphansReleased: 1 });
    expect(fake.getAllDocs(SYSTEM_FILES).file_a).toMatchObject({ isDeleted: true, trashedBy: MEDIA_RELEASE_ACTOR });
    expect(fake.getAllDocs(SYSTEM_FILES).file_b.isDeleted).toBe(false);
    expect(fake.getAllDocs(SYSTEM_FILES).file_c.isDeleted).toBe(false);
    expect(mockAudits).toEqual([expect.objectContaining({ fileId: 'file_a', metadata: expect.objectContaining({ reason: 'catalog-media-orphan' }) })]);
  });
});
