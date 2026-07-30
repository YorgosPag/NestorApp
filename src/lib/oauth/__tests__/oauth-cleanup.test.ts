/**
 * Tests — εκκαθάριση ληγμένων εγγράφων OAuth (ADR-738 §10)
 *
 * Το κρίσιμο ερώτημα εδώ **δεν** είναι «σβήνει ό,τι έληξε;» — αυτό είναι το
 * εύκολο μισό. Είναι: **επιβιώνουν οι δύο ανιχνευτές κλοπής;** Ένας εξαργυρωμένος
 * authorization code και ένα ανακλημένο refresh token είναι, μετά τη λήξη τους,
 * φαινομενικά σκουπίδια — στην πραγματικότητα είναι τα μόνα αποδεικτικά που
 * μετατρέπουν μια επανάληψη σε «σήμα κλοπής» αντί για «άγνωστο διαπιστευτήριο».
 * Μια εκκαθάριση που τα σβήνει νωρίς αφαιρεί μηχανισμό ασφαλείας χωρίς να
 * κοκκινίσει τίποτα.
 */

import { Timestamp } from 'firebase-admin/firestore';

import { FakeFirestore } from './fake-firestore';

const fakeDb = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fakeDb,
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  CLEANUP_BATCH_LIMIT,
  CLOCK_SKEW_GRACE_MS,
  REUSE_DETECTION_RETENTION_MS,
  cleanupExpiredOAuthDocuments,
} from '../oauth-cleanup';

const NOW = 1_800_000_000_000;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

function seed(collection: string, id: string, expiresAtMs: number): void {
  void fakeDb.collection(collection).doc(id).set({
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  });
}

function idsIn(collection: string): string[] {
  return [...fakeDb.dump(collection).keys()].sort();
}

function clear(collection: string): void {
  [...fakeDb.dump(collection).keys()].forEach((id) => {
    void fakeDb.collection(collection).doc(id).delete();
  });
}

beforeEach(() => {
  [
    COLLECTIONS.OAUTH_AUTH_REQUESTS,
    COLLECTIONS.OAUTH_CODES,
    COLLECTIONS.OAUTH_TOKENS,
    COLLECTIONS.OAUTH_CONSENTS,
  ].forEach(clear);
});

// ============================================================================
// ΟΙ ΔΥΟ ΑΝΙΧΝΕΥΤΕΣ — Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΤΟ ΠΑΡΑΘΥΡΟ
// ============================================================================

describe('διατήρηση των ανιχνευτών επαναχρησιμοποίησης', () => {
  it('ΔΕΝ σβήνει authorization code που μόλις έληξε — είναι ο ανιχνευτής επανάληψης', async () => {
    // Ο code ζει 60 δευτερόλεπτα. Αν έφευγε στη λήξη του, μια επανάληψη μία ώρα
    // αργότερα θα διαβαζόταν ως `not_found` αντί για `already_redeemed`, και η
    // οικογένεια tokens που γέννησε δεν θα έπεφτε ποτέ.
    seed(COLLECTIONS.OAUTH_CODES, 'code_recent', NOW - HOUR_MS);

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_CODES)).toEqual(['code_recent']);
  });

  it('ΔΕΝ σβήνει token που έληξε πριν λιγότερο από το παράθυρο διατήρησης', async () => {
    seed(COLLECTIONS.OAUTH_TOKENS, 'tok_yesterday', NOW - DAY_MS);
    seed(COLLECTIONS.OAUTH_TOKENS, 'tok_almost', NOW - REUSE_DETECTION_RETENTION_MS + HOUR_MS);

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_TOKENS)).toEqual(['tok_almost', 'tok_yesterday']);
  });

  it('σβήνει code και token μόλις περάσει το παράθυρο', async () => {
    seed(COLLECTIONS.OAUTH_CODES, 'code_old', NOW - REUSE_DETECTION_RETENTION_MS - 1);
    seed(COLLECTIONS.OAUTH_TOKENS, 'tok_old', NOW - REUSE_DETECTION_RETENTION_MS - 1);

    const report = await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_CODES)).toEqual([]);
    expect(idsIn(COLLECTIONS.OAUTH_TOKENS)).toEqual([]);
    expect(report.totalDeleted).toBe(2);
  });

  it('το παράθυρο ισούται με τη ζωή ενός refresh token — 30 ημέρες', () => {
    // Δεμένο στο OAUTH_TTL, όχι σε σταθερά γραμμένη ξανά: αν αλλάξει η διάρκεια
    // του refresh, το παράθυρο ακολουθεί μόνο του.
    expect(REUSE_DETECTION_RETENTION_MS).toBe(30 * DAY_MS);
  });
});

// ============================================================================
// ΕΚΚΡΕΜΗ ΑΙΤΗΜΑΤΑ — ΔΙΑΦΟΡΕΤΙΚΟ ΚΡΙΤΗΡΙΟ, ΚΑΙ ΣΩΣΤΑ
// ============================================================================

describe('εκκρεμή αιτήματα εξουσιοδότησης', () => {
  it('σβήνονται με τη λήξη τους συν το περιθώριο ρολογιού', async () => {
    seed(COLLECTIONS.OAUTH_AUTH_REQUESTS, 'req_old', NOW - CLOCK_SKEW_GRACE_MS - 1);

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_AUTH_REQUESTS)).toEqual([]);
  });

  it('ΔΕΝ σβήνονται μέσα στο περιθώριο ρολογιού', async () => {
    // Ένας server με ελαφρώς πίσω ρολόι μπορεί ακόμη να το θεωρεί έγκυρο.
    seed(COLLECTIONS.OAUTH_AUTH_REQUESTS, 'req_fresh', NOW - 60_000);

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_AUTH_REQUESTS)).toEqual(['req_fresh']);
  });

  it('έχουν ΜΙΚΡΟΤΕΡΟ παράθυρο από codes/tokens — δεν φέρουν ανίχνευση', async () => {
    const expiry = NOW - DAY_MS;
    seed(COLLECTIONS.OAUTH_AUTH_REQUESTS, 'req', expiry);
    seed(COLLECTIONS.OAUTH_CODES, 'code', expiry);
    seed(COLLECTIONS.OAUTH_TOKENS, 'tok', expiry);

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_AUTH_REQUESTS)).toEqual([]);
    expect(idsIn(COLLECTIONS.OAUTH_CODES)).toEqual(['code']);
    expect(idsIn(COLLECTIONS.OAUTH_TOKENS)).toEqual(['tok']);
  });
});

// ============================================================================
// ΤΙ ΔΕΝ ΑΓΓΙΖΕΤΑΙ
// ============================================================================

describe('όρια της εκκαθάρισης', () => {
  it('ΔΕΝ αγγίζει ποτέ τις συγκαταθέσεις — είναι το ελεγκτικό ίχνος', async () => {
    // ⚠️ Το έγγραφο σπέρνεται **με** `expiresAt`, και μάλιστα αρχαίο, παρότι οι
    // πραγματικές συγκαταθέσεις δεν έχουν τέτοιο πεδίο. Χωρίς αυτό το test
    // περνούσε για λάθος λόγο: ένα range query δεν επιστρέφει έγγραφα που δεν
    // έχουν το πεδίο, οπότε η συλλογή έμοιαζε «προστατευμένη» ενώ απλώς ήταν
    // αόρατη. Έτσι ο έλεγχος πιάνει και την περίπτωση που κάποιος προσθέσει
    // αύριο `expiresAt` στα consents. (Μετάλλαξη 21 — επιβίωσε στην πρώτη γραφή.)
    void fakeDb.collection(COLLECTIONS.OAUTH_CONSENTS).doc('oacons_1').set({
      uid: 'usr_1',
      revokedAt: Timestamp.fromMillis(NOW - 10 * REUSE_DETECTION_RETENTION_MS),
      expiresAt: Timestamp.fromMillis(NOW - 10 * REUSE_DETECTION_RETENTION_MS),
    });

    await cleanupExpiredOAuthDocuments(NOW);

    expect(idsIn(COLLECTIONS.OAUTH_CONSENTS)).toEqual(['oacons_1']);
  });

  it('η αναφορά ΔΕΝ περιλαμβάνει τις συγκαταθέσεις σε καμία εκτέλεση', async () => {
    const report = await cleanupExpiredOAuthDocuments(NOW);

    expect(report.results.map((r) => r.collection)).not.toContain(COLLECTIONS.OAUTH_CONSENTS);
  });

  it('ΔΕΝ σβήνει έγγραφα που δεν έχουν λήξει ακόμη', async () => {
    seed(COLLECTIONS.OAUTH_TOKENS, 'tok_live', NOW + HOUR_MS);
    seed(COLLECTIONS.OAUTH_CODES, 'code_live', NOW + 30_000);
    seed(COLLECTIONS.OAUTH_AUTH_REQUESTS, 'req_live', NOW + 5 * 60_000);

    const report = await cleanupExpiredOAuthDocuments(NOW);

    expect(report.totalDeleted).toBe(0);
    expect(idsIn(COLLECTIONS.OAUTH_TOKENS)).toEqual(['tok_live']);
    expect(idsIn(COLLECTIONS.OAUTH_CODES)).toEqual(['code_live']);
    expect(idsIn(COLLECTIONS.OAUTH_AUTH_REQUESTS)).toEqual(['req_live']);
  });
});

// ============================================================================
// ΑΝΑΦΟΡΑ
// ============================================================================

describe('αναφορά', () => {
  it('σημαίνει hasMore όταν γεμίσει το batch — ώστε να μη μοιάζει τελειωμένο', async () => {
    for (let i = 0; i < CLEANUP_BATCH_LIMIT + 5; i++) {
      seed(COLLECTIONS.OAUTH_AUTH_REQUESTS, `req_${i}`, NOW - 10 * DAY_MS);
    }

    const report = await cleanupExpiredOAuthDocuments(NOW);
    const requests = report.results.find((r) => r.collection === COLLECTIONS.OAUTH_AUTH_REQUESTS);

    expect(requests?.deleted).toBe(CLEANUP_BATCH_LIMIT);
    expect(requests?.hasMore).toBe(true);
    // Τα υπόλοιπα 5 περιμένουν την επόμενη εκτέλεση — δεν χάθηκαν.
    expect(idsIn(COLLECTIONS.OAUTH_AUTH_REQUESTS)).toHaveLength(5);
  });

  it('αναφέρει και τις τρεις συλλογές ακόμη κι όταν δεν σβήστηκε τίποτα', async () => {
    const report = await cleanupExpiredOAuthDocuments(NOW);

    expect(report.results.map((r) => r.collection).sort()).toEqual(
      [
        COLLECTIONS.OAUTH_AUTH_REQUESTS,
        COLLECTIONS.OAUTH_CODES,
        COLLECTIONS.OAUTH_TOKENS,
      ].sort(),
    );
  });
});
