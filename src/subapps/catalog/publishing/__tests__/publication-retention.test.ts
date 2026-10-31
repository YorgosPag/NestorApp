/**
 * ADR-923 §5.6.1 — ο πίνακας διατήρησης των PDF. Κάθε γραμμή του έχει εδώ την άγκυρά της, γιατί ένα λάθος σε αυτόν τον κριτή
 * σβήνει τεκμήριο τιμών χωρίς να το δει κανείς.
 */
import { EMPTY_PUBLICATION_RETENTION, type PublicationRetention } from '../../types/publication';
import {
  canDeletePublicationByHand,
  canHoldPublication,
  isPublicationRunReusable,
  priceVersionEndedAt,
  publicationDispositionDueAt,
  publicationRetentionStepOf,
  publicationRunOf,
  retentionPatch,
} from '../publication-retention';

const SUPERSEDED = '2026-03-10T10:00:00.000Z';
const HOLD = { placedBy: 'u', placedAt: SUPERSEDED, reason: 'δίκη' };
const DISPOSAL = { disposedAt: SUPERSEDED, disposedBy: 'u', cause: 'manual', ruleId: 'r' } as const;

const run = (patch: Partial<PublicationRetention>, priced = false, status: 'ready' | 'failed' = 'ready') => ({
  status,
  priced,
  retention: { ...EMPTY_PUBLICATION_RETENTION, supersededAt: SUPERSEDED, ...patch },
});
const downloaded = { downloadCount: 2, firstDownloadedAt: SUPERSEDED };

describe('publicationDispositionDueAt: πότε τρέχει το ρολόι', () => {
  it('η τελευταία έκδοση της συνταγής δεν έχει ρολόι', () => {
    expect(publicationDispositionDueAt(run({ supersededAt: null }))).toBeNull();
    expect(publicationDispositionDueAt(run({ supersededAt: null, ...downloaded }, true))).toBeNull();
  });

  it('δεν κατέβηκε ποτέ: 90 ημέρες, με τιμές ή χωρίς', () => {
    expect(publicationDispositionDueAt(run({}))).toBe('2026-06-08T10:00:00.000Z');
    expect(publicationDispositionDueAt(run({}, true))).toBe('2026-06-08T10:00:00.000Z');
  });

  it('κατέβηκε χωρίς τιμές: 24 μήνες, με ακρίβεια ημέρας', () => {
    expect(publicationDispositionDueAt(run(downloaded))).toBe('2028-03-10T00:00:00.000Z');
  });

  it('κατέβηκε με τιμές: τέλος του έτους + 5 έτη, ώρα Αθήνας', () => {
    expect(publicationDispositionDueAt(run(downloaded, true))).toBe('2031-12-31T22:00:00.000Z');
  });

  it('δέσμευση, διάθεση ή αποτυχία σταματούν το ρολόι', () => {
    expect(publicationDispositionDueAt(run({ legalHold: HOLD }))).toBeNull();
    expect(publicationDispositionDueAt(run({ disposal: DISPOSAL }))).toBeNull();
    expect(publicationDispositionDueAt(run({}, false, 'failed'))).toBeNull();
  });

  it('το retentionPatch γράφει διατήρηση και προθεσμία μαζί', () => {
    const patched = retentionPatch(run({ supersededAt: null }), { supersededAt: SUPERSEDED });
    expect(patched.dispositionDueAt).toBe('2026-06-08T10:00:00.000Z');
    expect(retentionPatch(run({}), { legalHold: HOLD }).dispositionDueAt).toBeNull();
  });
});

describe('publicationRetentionStepOf: η κρίση της σάρωσης', () => {
  const after = (iso: string) => new Date(Date.parse(iso) + 1000).toISOString();

  it('χωρίς τιμές, μετά την προθεσμία ⇒ διάθεση · πριν ⇒ αναβολή', () => {
    expect(publicationRetentionStepOf(run({}), null, after('2026-06-08T10:00:00.000Z')).kind).toBe('dispose');
    expect(publicationRetentionStepOf(run({}), null, '2026-06-01T00:00:00.000Z')).toEqual({ kind: 'defer', dueAt: '2026-06-08T10:00:00.000Z' });
  });

  it('ποτέ διάθεση όσο η έκδοση τιμών ισχύει, όσο παλιό κι αν είναι το αρχείο', () => {
    const step = publicationRetentionStepOf(run(downloaded, true), null, '2040-01-01T00:00:00.000Z');
    expect(step).toEqual({ kind: 'defer', dueAt: '2041-01-01T00:00:00.000Z' });
  });

  it('το ρολόι μετρά από τη λήξη της έκδοσης τιμών, όχι από την αντικατάσταση του PDF', () => {
    const step = publicationRetentionStepOf(run(downloaded, true), '2029-05-01T00:00:00.000Z', '2032-06-01T00:00:00.000Z');
    expect(step).toEqual({ kind: 'defer', dueAt: '2034-12-31T22:00:00.000Z' });
    expect(publicationRetentionStepOf(run(downloaded, true), '2029-05-01T00:00:00.000Z', '2035-01-01T00:00:00.000Z').kind).toBe('dispose');
  });

  it('η δέσμευση υπερισχύει κάθε προθεσμίας', () => {
    expect(publicationRetentionStepOf(run({ legalHold: HOLD, ...downloaded }), null, '2050-01-01T00:00:00.000Z').kind).toBe('keep');
  });
});

describe('publicationRunOf', () => {
  it('έγγραφο από πριν από τη διατήρηση διαβάζεται χωρίς να ρίξει κανέναν αναγνώστη', () => {
    const old = publicationRunOf({ id: 'r1', status: 'failed' as const });
    expect(old.retention).toEqual(EMPTY_PUBLICATION_RETENTION);
    expect(old.dispositionDueAt).toBeNull();
    expect(old.priceVersion).toBeNull();
    expect(isPublicationRunReusable(old)).toBe(false);
  });

  it('ό,τι είναι γραμμένο μένει ως έχει', () => {
    const retention = { ...EMPTY_PUBLICATION_RETENTION, downloadCount: 3 };
    expect(publicationRunOf({ retention, dispositionDueAt: 'x' })).toMatchObject({ retention, dispositionDueAt: 'x' });
  });
});

describe('isPublicationRunReusable', () => {
  it('σβησμένο PDF ξαναποδίδεται αντί να λέει «έτοιμη» χωρίς αρχείο', () => {
    expect(isPublicationRunReusable(run({}))).toBe(true);
    expect(isPublicationRunReusable(run({ disposal: DISPOSAL }))).toBe(false);
    expect(isPublicationRunReusable(run({}, false, 'failed'))).toBe(false);
  });
});

describe('χειροκίνητες πράξεις', () => {
  it('διαγραφή μόνο ό,τι δεν κατέβηκε, ακόμη και η τελευταία', () => {
    expect(canDeletePublicationByHand(run({ supersededAt: null }))).toBe(true);
    expect(canDeletePublicationByHand(run(downloaded))).toBe(false);
    expect(canDeletePublicationByHand(run({ legalHold: HOLD }))).toBe(false);
    expect(canDeletePublicationByHand(run({ disposal: DISPOSAL }))).toBe(false);
    expect(canDeletePublicationByHand(run({}, false, 'failed'))).toBe(false);
  });

  it('δέσμευση μόνο σε έκδοση που έχει ακόμη αρχείο', () => {
    expect(canHoldPublication(run(downloaded))).toBe(true);
    expect(canHoldPublication(run({ disposal: DISPOSAL }))).toBe(false);
  });
});

describe('priceVersionEndedAt', () => {
  const versions = [
    { id: 'v1', status: 'superseded', validFrom: '2026-01-01T00:00:00.000Z' },
    { id: 'v2', status: 'published', validFrom: '2026-06-01T00:00:00.000Z' },
    { id: 'v3', status: 'published', validFrom: '2026-09-01T00:00:00.000Z' },
    { id: 'draft', status: 'draft', validFrom: '2026-02-01T00:00:00.000Z' },
    { id: 'gone', status: 'discarded', validFrom: '2026-03-01T00:00:00.000Z' },
  ];

  it('τελειώνει όταν ξεκινά η αμέσως επόμενη, και πρόχειρο ή απορριφθέν δεν μετρούν', () => {
    expect(priceVersionEndedAt(versions, 'v1')).toBe('2026-06-01T00:00:00.000Z');
  });

  it('η τελευταία ισχύει ακόμη · άγνωστη έκδοση ⇒ καμία λήξη, άρα περισσότερη διατήρηση', () => {
    expect(priceVersionEndedAt(versions, 'v3')).toBeNull();
    expect(priceVersionEndedAt(versions, 'unknown')).toBeNull();
  });
});
