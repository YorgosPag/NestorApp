/**
 * «Διπλή κλήση» και **ανακατεμένη σειρά** για το ευρετήριο αναζήτησης
 * (ADR-873 Φ1 Στάδιο 1 — ζητούμενο Giorgio).
 *
 * Το σειριακό διπλότυπο είναι το εύκολο μισό. Το **ανακατεμένο** (E1 → E2 → καθυστερημένο E1)
 * είναι το μόνο test που πιάνει το **Ε-873.3**, και το μόνο που αποδεικνύει ότι η ταφόπλακα
 * κάνει τη δουλειά της: χωρίς αυτήν, ένα καθυστερημένο CREATE μετά από DELETE αφήνει
 * **μόνιμο φάντασμα** — διαγραμμένη οντότητα που μένει για πάντα στην αναζήτηση.
 *
 * @module functions/search/__tests__/search-index-writer
 */

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => ({}), {
    Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
    FieldValue: { serverTimestamp: () => '__server_ts' },
  }),
}));

import { SEARCH_TOMBSTONE_TTL_MS } from '../../generated/lib/search/search-index-version';
import { asFirestore, FakeFirestore } from '../../shared/__tests__/fake-firestore';
import { applySearchIndexTombstone, applySearchIndexWrite } from '../search-index-writer';
import type { SearchDocument } from '../indexBuilder';

const NOW = 1_758_000_000_000;
const PATH = 'search_documents/contact_c1';
const IDENTITY = { tenantId: 'comp_1', entityType: 'contact', entityId: 'c1' };

const v = (seconds: number) => ({ seconds, nanoseconds: 0 });

const docOf = (title: string): SearchDocument =>
  ({
    tenantId: 'comp_1',
    entityType: 'contact',
    entityId: 'c1',
    title,
    subtitle: '',
    status: 'active',
    search: { normalized: title.toLowerCase(), prefixes: [title.toLowerCase()] },
    audience: 'internal',
    requiredPermission: 'contacts:read',
    links: { href: '/contacts/c1', routeParams: { id: 'c1' } },
  }) as unknown as SearchDocument;

const freshStore = () => new FakeFirestore({});
const refOf = (db: FakeFirestore) => db.doc(PATH) as unknown as Parameters<typeof applySearchIndexWrite>[0];

const write = (db: FakeFirestore, title: string, version: number) =>
  applySearchIndexWrite(refOf(db), docOf(title), v(version));

const tombstone = (db: FakeFirestore, version: number | null) =>
  applySearchIndexTombstone(refOf(db), IDENTITY, version === null ? null : v(version), NOW);

// Ο fake δέχεται δομικά ό,τι επιφάνεια χρησιμοποιεί ο γραφέας· το `asFirestore` υπάρχει για τους
// καλούντες που παίρνουν ολόκληρο το `Firestore`, όχι για τον γραφέα που παίρνει `ref`.
void asFirestore;

describe('applySearchIndexWrite — το ίδιο γεγονός δύο φορές', () => {
  it('γράφει στο κενό ευρετήριο και σφραγίζει την έκδοση', async () => {
    const db = freshStore();
    expect(await write(db, 'Νέστωρ', 10)).toBe('applied');
    expect(db.read(PATH)).toMatchObject({ title: 'Νέστωρ', sourceUpdateTime: v(10) });
  });

  it('η δεύτερη παράδοση του ΙΔΙΟΥ commit δεν ξαναγράφει', async () => {
    const db = freshStore();
    await write(db, 'Νέστωρ', 10);
    expect(await write(db, 'Νέστωρ', 10)).toBe('stale');
  });

  it('νεότερο commit περνά', async () => {
    const db = freshStore();
    await write(db, 'Νέστωρ', 10);
    expect(await write(db, 'Νέστωρ Β', 11)).toBe('applied');
    expect(db.read(PATH)?.title).toBe('Νέστωρ Β');
  });
});

describe('applySearchIndexWrite — ΑΝΑΚΑΤΕΜΕΝΗ σειρά (E1 → E2 → καθυστερημένο E1)', () => {
  it('🔴 το καθυστερημένο E1 ΔΕΝ πατάει πάνω στο E2', async () => {
    const db = freshStore();

    await write(db, 'Παλιό όνομα', 10); // E1
    await write(db, 'Νέο όνομα', 11); // E2
    const late = await write(db, 'Παλιό όνομα', 10); // καθυστερημένο διπλότυπο του E1

    expect(late).toBe('stale');
    expect(db.read(PATH)?.title).toBe('Νέο όνομα');
  });
});

describe('applySearchIndexTombstone — η διαγραφή που δεν καταστρέφει την έκδοση', () => {
  it('αφήνει ταφόπλακα με ΚΕΝΑ prefixes — δομικά αόρατη στο ερώτημα', async () => {
    const db = freshStore();
    await write(db, 'Νέστωρ', 10);

    expect(await tombstone(db, 11)).toBe('applied');
    expect(db.read(PATH)).toMatchObject({
      deleted: true,
      tenantId: 'comp_1',
      search: { normalized: '', prefixes: [] },
      sourceUpdateTime: v(11),
      expiresAt: { __ts: NOW + SEARCH_TOMBSTONE_TTL_MS },
    });
  });

  it('🏆 γράφει ταφόπλακα ΚΑΙ σε κενό ευρετήριο — εκεί σταματά η Elasticsearch', async () => {
    const db = freshStore();
    expect(await tombstone(db, 11)).toBe('applied');
    expect(db.read(PATH)).toMatchObject({ deleted: true });
  });

  it('🔴 Ε-873.3: καθυστερημένο DELETE ΔΕΝ σβήνει έγκυρο ευρετήριο μετά από επαναδημιουργία', async () => {
    const db = freshStore();
    await write(db, 'Παλιό', 10); // E1: δημιουργία
    // E2: διαγραφή (v11) — και μετά E3: επαναδημιουργία (v12)
    await tombstone(db, 11);
    await write(db, 'Ξαναγεννήθηκε', 12);

    const lateDelete = await tombstone(db, 11); // το καθυστερημένο διπλότυπο του E2

    expect(lateDelete).toBe('stale');
    expect(db.read(PATH)).toMatchObject({ title: 'Ξαναγεννήθηκε' });
    expect(db.read(PATH)?.deleted).toBeUndefined();
  });

  it('η δεύτερη παράδοση της ΙΔΙΑΣ διαγραφής δεν ξαναγράφει ταφόπλακα', async () => {
    const db = freshStore();
    await write(db, 'Νέστωρ', 10);
    await tombstone(db, 11);
    expect(await tombstone(db, 11)).toBe('stale');
  });

  it('η επαναδημιουργία καθαρίζει ΟΛΑ τα πεδία της ταφόπλακας (πλήρες set, όχι merge)', async () => {
    const db = freshStore();
    await tombstone(db, 11);
    await write(db, 'Ξανά', 12);

    const stored = db.read(PATH) ?? {};
    expect(stored.deleted).toBeUndefined();
    expect(stored.expiresAt).toBeUndefined();
    expect(stored.title).toBe('Ξανά');
  });
});

describe('🏆 Το μόνιμο φάντασμα — η δοκιμασία που δικαιολογεί την ταφόπλακα', () => {
  it('καθυστερημένο CREATE μετά από DELETE ΔΕΝ ανασταίνει διαγραμμένη οντότητα', async () => {
    const db = freshStore();

    await write(db, 'Διαγραπτέο', 10); // E1: υπάρχει
    await tombstone(db, 11); // E2: διαγράφηκε οριστικά

    // Καθυστερημένο διπλότυπο του E1. Με σκληρή διαγραφή, εδώ δεν θα υπήρχε τίποτα να
    // συγκριθεί: το έγγραφο θα ξαναγραφόταν και καμία επόμενη αλλαγή δεν θα ερχόταν ποτέ
    // να το διορθώσει — η οντότητα δεν υπάρχει πια.
    const ghost = await write(db, 'Διαγραπτέο', 10);

    expect(ghost).toBe('stale');
    expect(db.read(PATH)).toMatchObject({ deleted: true });
  });

  it('έγγραφο χωρίς έκδοση (πριν το ADR-873) δέχεται τη γραφή — ποτέ σιωπηλή παράλειψη', async () => {
    const db = new FakeFirestore({ [PATH]: { title: 'Παλιό, χωρίς σφραγίδα' } });
    expect(await write(db, 'Με σφραγίδα', 10)).toBe('applied');
    expect(db.read(PATH)).toMatchObject({ title: 'Με σφραγίδα', sourceUpdateTime: v(10) });
  });
});
