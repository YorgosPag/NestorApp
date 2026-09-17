/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α37-Α42 του ADR-864 §20** — πόσο ζει ένα παγωμένο αποδεικτικό, και ποιος το σβήνει.
 *
 * | # | Άγκυρα | Μετάλλαξη που πρέπει να πιάσει |
 * |---|---|---|
 * | Α38 | προθεσμία = 1/1/(έτος λήξης **στην Αθήνα** + 6) 00:00 Αθήνας | 5 αντί για 6 · έτος σε UTC αντί Αθήνας |
 * | Α39 | η **σχέση** κρίνει: ανανέωση ίδιου γραφείου συνεχίζει · απόρριψη/λήξη/ανάκληση τελειώνουν · απουσία = now | ανά εντολή αντί για σχέση · εκκρεμής = λήξη |
 * | Α40 | κλείδωμα **πριν** την απελευθέρωση · bucket χωρίς retention ⇒ hold μένει · επέκταση μόνο προς τα πάνω | απελευθέρωση πριν το κλείδωμα · χωρίς fail-closed |
 * | Α41 | διάθεση μόνο μετά την ημερομηνία, **ποτέ** με δικαστική δέσμευση · ταφόπλακα με αποτύπωμα | διάθεση με legal hold · σβήσιμο εγγραφής |
 * | Α42 | αντικείμενο χωρίς εγγραφή: αναφερόμενο ⇒ υιοθεσία · αδέσποτο ⇒ **ποτέ** διαγραφή | υιοθεσία = διαγραφή |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const recordOwnerPropertyEvidenceEvent = jest.fn<Promise<void>, unknown[]>();
jest.mock('@/services/owner-property/owner-property-audit', () => ({
  recordOwnerPropertyEvidenceEvent: (...args: unknown[]) => recordOwnerPropertyEvidenceEvent(...args),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as typeof import('@/services/places/__tests__/fake-firestore');
const fixtures = require('@/lib/owner-property/__tests__/owner-property-fixtures') as typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { FakeEvidenceBucket } = require('./fake-evidence-bucket') as typeof import('./fake-evidence-bucket');
const retention = require('@/lib/mandate/evidence-retention') as typeof import('@/lib/mandate/evidence-retention');
const service = require('../evidence-retention.service') as typeof import('../evidence-retention.service');
const registry = require('../evidence-registry') as typeof import('../evidence-registry');
/* eslint-enable @typescript-eslint/no-require-imports */

import type { MandateEvidenceRecord } from '@/types/mandate-evidence-record';
import type { AttestationEvidence, BrokeredListingMandate } from '@/types/owner-property-mandate';

const AGENCY = 'comp_alfa';
const PATH = 'mandate-evidence/ownp_a/mevd_1';
const EVIDENCE: AttestationEvidence = { id: 'mevd_1', path: PATH, digest: `sha256:${'c'.repeat(64)}`, sizeBytes: 5, contentType: 'application/pdf', fileName: 'έντυπο.pdf' };

const mandate = (over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate =>
  fixtures.brokeredMandate({
    agencyCompanyId: AGENCY,
    confirmation: 'confirmed',
    expiresAt: '2027-03-01T00:00:00.000Z',
    proof: { via: 'agency-attestation', attestedByUserId: 'agent-1', attestedAt: '2026-09-01T10:00:00.000Z', documentPath: 'companies/x/y.pdf', evidence: EVIDENCE },
    ...over,
  });

const record = (over: Partial<MandateEvidenceRecord> = {}): MandateEvidenceRecord => ({
  ...registry.sealedEvidenceRecord(EVIDENCE, { ownerPropertyId: 'ownp_a', agencyCompanyId: AGENCY, sealedAt: '2026-09-01T10:00:00.000Z' }),
  ...over,
});

function world(mandates: readonly BrokeredListingMandate[], seededRecord: MandateEvidenceRecord | null = record()) {
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_a', fixtures.validOwnerProperty({ authorCompanyId: null, mandates }));
  if (seededRecord !== null) db.seed(COLLECTIONS.MANDATE_EVIDENCE, seededRecord.id, { ...seededRecord });
  const bucket = new FakeEvidenceBucket();
  bucket.put(PATH, 'bytes');
  const object = bucket.objects.get(PATH);
  if (object !== undefined) object.hold = true;
  return { db, typed: db as unknown as AdminFirestore, bucket };
}

const stored = async (db: InstanceType<typeof FakeFirestore>): Promise<Record<string, unknown> | undefined> =>
  (await db.collection(COLLECTIONS.MANDATE_EVIDENCE).doc('mevd_1').get()).data();

beforeEach(() => {
  jest.clearAllMocks();
  recordOwnerPropertyEvidenceEvent.mockResolvedValue(undefined);
});

describe('🏆 Α38 — η προθεσμία: τέλος του έτους λήξης (ΑΚ 253) + 5 ημερολογιακά έτη', () => {
  it('🔴 λήξη μέσα στο έτος ⇒ 1/1/(Υ+6) 00:00 ώρα Αθήνας (= 22:00 UTC της 31/12)', () => {
    expect(retention.retainUntilOf('2027-03-01T00:00:00.000Z')).toBe('2032-12-31T22:00:00.000Z');
  });

  it('🔴 31/12 23:30 UTC είναι ΗΔΗ 1/1 στην Αθήνα ⇒ το έτος μετριέται στην Αθήνα', () => {
    expect(retention.retainUntilOf('2027-12-31T23:30:00.000Z')).toBe('2033-12-31T22:00:00.000Z');
    expect(retention.retainUntilOf('2027-12-31T21:30:00.000Z')).toBe('2032-12-31T22:00:00.000Z');
  });
});

describe('🏆 Α39 — ο άξονας είναι η ΣΧΕΣΗ γραφείου–ακινήτου, όχι η μία εντολή', () => {
  const NOW = '2028-01-10T00:00:00.000Z';

  it('🔴 ζωντανή εντολή ⇒ καμία λήξη · εκκρεμής μετρά ως ζωντανή', () => {
    expect(retention.relationshipEndedAt([mandate({ expiresAt: '2029-01-01T00:00:00.000Z' })], AGENCY, NOW)).toBeNull();
    expect(retention.relationshipEndedAt([mandate({ confirmation: 'pending', expiresAt: '2029-01-01T00:00:00.000Z' })], AGENCY, NOW)).toBeNull();
  });

  it('🔴 ληγμένη ⇒ η λήξη της · απορριφθείσα ⇒ η απόφαση · ανάκληση άδειας ⇒ η ανάκληση · η ΜΕΤΑΓΕΝΕΣΤΕΡΗ κερδίζει', () => {
    expect(retention.relationshipEndedAt([mandate()], AGENCY, NOW)).toBe('2027-03-01T00:00:00.000Z');
    expect(retention.relationshipEndedAt([mandate({ confirmation: 'declined', decidedAt: '2026-10-01T00:00:00.000Z', expiresAt: '2029-01-01T00:00:00.000Z' })], AGENCY, NOW)).toBe('2026-10-01T00:00:00.000Z');
    expect(retention.relationshipEndedAt([mandate({ agencyRevokedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2029-01-01T00:00:00.000Z' })], AGENCY, NOW)).toBe('2026-11-01T00:00:00.000Z');
  });

  it('🔴 ανανέωση από το ΙΔΙΟ γραφείο (η εντολή αντικαταστάθηκε) ⇒ η σχέση ΣΥΝΕΧΙΖΕΤΑΙ', () => {
    const renewed = mandate({ proof: { via: 'owner-consent' }, expiresAt: '2029-06-01T00:00:00.000Z' });
    expect(retention.relationshipEndedAt([renewed], AGENCY, NOW)).toBeNull();
  });

  it('🔴 εντολή ΑΛΛΟΥ γραφείου δεν κρατά ζωντανή τη σχέση του πρώτου · καμία εντολή του ⇒ `now` (συντηρητικά)', () => {
    const other = mandate({ agencyCompanyId: 'comp_beta', expiresAt: '2029-06-01T00:00:00.000Z' });
    expect(retention.relationshipEndedAt([other], AGENCY, NOW)).toBe(NOW);
  });
});

describe('🏆 Α40 — κλείδωμα: Locked ΠΡΩΤΑ, απελευθέρωση ΜΕΤΑ, και ποτέ χωρίς κλειδαριά', () => {
  const NOW = '2027-06-01T00:00:00.000Z';

  it('🔴 η σχέση έληξε ⇒ Locked ως την προθεσμία, hold αφαιρείται, εγγραφή `retained` με κανόνα, ίχνος', async () => {
    const { db, typed, bucket } = world([mandate()]);

    const report = await service.runEvidenceRetention(typed, bucket, NOW);

    expect(report).toMatchObject({ considered: 1, retained: 1, disposed: 0, failed: 0 });
    expect(bucket.objects.get(PATH)).toMatchObject({ hold: false, retainUntil: '2032-12-31T22:00:00.000Z' });
    expect(await stored(db)).toMatchObject({ state: 'retained', relationshipEndedAt: '2027-03-01T00:00:00.000Z', retainUntil: '2032-12-31T22:00:00.000Z', ruleId: retention.EVIDENCE_RETENTION_RULE.id });
    expect(recordOwnerPropertyEvidenceEvent).toHaveBeenCalledWith(expect.anything(), 'evidence_retention_scheduled', service.EVIDENCE_RETENTION_ACTOR, expect.objectContaining({ id: 'mevd_1' }), '2032-12-31T22:00:00.000Z');
  });

  it('🔴 bucket ΧΩΡΙΣ object retention ⇒ fail-closed: hold μένει, εγγραφή μένει `sealed`', async () => {
    const { db, typed, bucket } = world([mandate()]);
    bucket.objectRetentionEnabled = false;

    expect(await service.runEvidenceRetention(typed, bucket, NOW)).toMatchObject({ retained: 0, failed: 1 });
    expect(bucket.objects.get(PATH)).toMatchObject({ hold: true, retainUntil: null });
    expect(await stored(db)).toMatchObject({ state: 'sealed' });
  });

  it('🔴 ζωντανή σχέση ⇒ τίποτα · δικαστική δέσμευση ⇒ Locked ναι, απελευθέρωση ΟΧΙ', async () => {
    const live = world([mandate({ expiresAt: '2029-01-01T00:00:00.000Z' })]);
    expect(await service.runEvidenceRetention(live.typed, live.bucket, NOW)).toMatchObject({ kept: 1, retained: 0 });
    expect(live.bucket.objects.get(PATH)).toMatchObject({ hold: true, retainUntil: null });

    const held = world([mandate()], record({ legalHold: { placedBy: 'admin-1', placedAt: NOW, reason: 'διαφορά' } }));
    await service.runEvidenceRetention(held.typed, held.bucket, NOW);
    expect(held.bucket.objects.get(PATH)).toMatchObject({ hold: true, retainUntil: '2032-12-31T22:00:00.000Z' });
  });

  it('🔴 η σχέση ξανάνοιξε και ξανάληξε αργότερα ⇒ η προθεσμία ΕΠΕΚΤΕΙΝΕΤΑΙ (ποτέ δεν μικραίνει)', async () => {
    const later = mandate({ expiresAt: '2030-02-01T00:00:00.000Z' });
    const { db, typed, bucket } = world([later], record({ state: 'retained', retainUntil: '2032-12-31T22:00:00.000Z', relationshipEndedAt: '2027-03-01T00:00:00.000Z' }));
    const object = bucket.objects.get(PATH);
    if (object !== undefined) Object.assign(object, { hold: false, retainUntil: '2032-12-31T22:00:00.000Z' });

    await service.runEvidenceRetention(typed, bucket, '2030-03-01T00:00:00.000Z');

    expect(bucket.objects.get(PATH)?.retainUntil).toBe('2035-12-31T22:00:00.000Z');
    expect(await stored(db)).toMatchObject({ retainUntil: '2035-12-31T22:00:00.000Z' });
  });
});

describe('🏆 Α41 — διάθεση: μετά την ημερομηνία, ποτέ με δέσμευση, και μένει ταφόπλακα', () => {
  const retained = (over: Partial<MandateEvidenceRecord> = {}) =>
    record({ state: 'retained', retainUntil: '2032-12-31T22:00:00.000Z', relationshipEndedAt: '2027-03-01T00:00:00.000Z', ruleId: retention.EVIDENCE_RETENTION_RULE.id, ...over });
  const lockedWorld = (over: Partial<MandateEvidenceRecord> = {}) => {
    const built = world([mandate()], retained(over));
    const object = built.bucket.objects.get(PATH);
    if (object !== undefined) Object.assign(object, { hold: false, retainUntil: '2032-12-31T22:00:00.000Z' });
    return built;
  };

  it('🔴 πριν την ημερομηνία ⇒ τίποτα', async () => {
    const { typed, bucket } = lockedWorld();
    expect(await service.runEvidenceRetention(typed, bucket, '2032-06-01T00:00:00.000Z')).toMatchObject({ kept: 1, disposed: 0 });
    expect(bucket.objects.has(PATH)).toBe(true);
  });

  it('🔴 μετά ⇒ bytes σβήνονται, η εγγραφή ΜΕΝΕΙ `disposed` με το αποτύπωμα, ίχνος', async () => {
    const { db, typed, bucket } = lockedWorld();
    bucket.nowISO = '2033-01-02T00:00:00.000Z';

    expect(await service.runEvidenceRetention(typed, bucket, '2033-01-02T00:00:00.000Z')).toMatchObject({ disposed: 1 });
    expect(bucket.objects.has(PATH)).toBe(false);
    expect(await stored(db)).toMatchObject({ state: 'disposed', disposedAt: '2033-01-02T00:00:00.000Z', digest: EVIDENCE.digest });
    expect(recordOwnerPropertyEvidenceEvent).toHaveBeenCalledWith(expect.anything(), 'evidence_disposed', service.EVIDENCE_RETENTION_ACTOR, expect.objectContaining({ id: 'mevd_1' }), EVIDENCE.digest);
  });

  it('🔴 δικαστική δέσμευση ⇒ ΠΟΤΕ διάθεση, όσο κι αν πέρασε η ημερομηνία', async () => {
    const { db, typed, bucket } = lockedWorld({ legalHold: { placedBy: 'admin-1', placedAt: '2032-01-01T00:00:00.000Z', reason: 'αγωγή' } });
    bucket.nowISO = '2040-01-01T00:00:00.000Z';

    expect(await service.runEvidenceRetention(typed, bucket, '2040-01-01T00:00:00.000Z')).toMatchObject({ disposed: 0, kept: 1 });
    expect(bucket.objects.has(PATH)).toBe(true);
    expect(await stored(db)).toMatchObject({ state: 'retained' });
  });

  it('🔴 legal hold: τοποθέτηση βάζει hold ΣΤΗΝ ΠΛΑΤΦΟΡΜΑ · αφαίρεση σε `retained` το βγάζει', async () => {
    const { db, typed, bucket } = lockedWorld();

    expect(await service.placeEvidenceLegalHold(typed, bucket, { evidenceId: 'mevd_1', placedBy: 'admin-1', reason: 'αγωγή', nowISO: '2030-01-01T00:00:00.000Z' })).toEqual({ kind: 'placed' });
    expect(bucket.objects.get(PATH)?.hold).toBe(true);
    expect((await stored(db))?.legalHold).toMatchObject({ placedBy: 'admin-1', reason: 'αγωγή' });

    expect(await service.releaseEvidenceLegalHold(typed, bucket, { evidenceId: 'mevd_1' })).toEqual({ kind: 'released' });
    expect(bucket.objects.get(PATH)?.hold).toBe(false);
    expect((await stored(db))?.legalHold).toBeNull();
  });
});

describe('🏆 Α42 — υιοθεσία: ό,τι λείπει από το μητρώο βρίσκεται, ό,τι είναι αδέσποτο ΔΕΝ σβήνεται', () => {
  it('🔴 αντικείμενο που η εντολή αναφέρει ⇒ εγγραφή με το γραφείο της εντολής', async () => {
    const { db, typed, bucket } = world([mandate({ expiresAt: '2029-01-01T00:00:00.000Z' })], null);

    expect(await service.runEvidenceRetention(typed, bucket, '2027-01-01T00:00:00.000Z')).toMatchObject({ adopted: 1, stray: 0, considered: 1 });
    expect(await stored(db)).toMatchObject({ state: 'sealed', agencyCompanyId: AGENCY, digest: EVIDENCE.digest });
  });

  it('🔴 αντικείμενο που ΚΑΝΕΙΣ δεν αναφέρει ⇒ αναφέρεται, μένει ανέγγιχτο', async () => {
    const { db, typed, bucket } = world([], null);

    expect(await service.runEvidenceRetention(typed, bucket, '2027-01-01T00:00:00.000Z')).toMatchObject({ adopted: 0, stray: 1 });
    expect(bucket.objects.get(PATH)).toMatchObject({ hold: true });
    expect(await stored(db)).toBeUndefined();
  });

  it('🔴 η γέννηση εγγραφής είναι ιδεμποτητική: δεύτερη κλήση δεν ξαναγράφει κατάσταση που προχώρησε', async () => {
    const { db, typed } = world([mandate()], record({ state: 'retained', retainUntil: '2032-12-31T22:00:00.000Z' }));

    expect(await registry.registerSealedEvidence(typed, EVIDENCE, { ownerPropertyId: 'ownp_a', agencyCompanyId: AGENCY, sealedAt: '2030-01-01T00:00:00.000Z' })).toBe(true);
    expect(await stored(db)).toMatchObject({ state: 'retained' });
  });
});
