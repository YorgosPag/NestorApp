/**
 * @jest-environment node
 *
 * Το στιγμιότυπο αντικειμενικής αξίας (ADR-947 Δ3 · Φ2): σύνθεση από την ΕΝΑ μηχανή, άρνηση για ό,τι δεν είναι
 * `computed`, και αποτύπωμα που καλύπτει **μόνο** το περιεχόμενο.
 */

import {
  composeObjectiveValueSnapshot,
  objectiveValueSnapshotDigest,
  objectiveValueSnapshotSeed,
  type ObjectiveValueSnapshotContent,
  type ObjectiveValueSnapshotRequest,
} from '../objective-value-snapshot';
import { isObjectiveValueSnapshotRecord } from '../objective-value-snapshot-record';
import { SNAPSHOT_DRAFT, SNAPSHOT_REQUEST } from './objective-value-snapshot.fixtures';

function composed(request: ObjectiveValueSnapshotRequest = SNAPSHOT_REQUEST): ObjectiveValueSnapshotContent {
  const result = composeObjectiveValueSnapshot(request);
  if (!result.ok) throw new Error(`δεν συντέθηκε: ${result.missing.join(',')}`);
  return result.content;
}

describe('composeObjectiveValueSnapshot', () => {
  it('παγώνει αποτέλεσμα της μηχανής με την τιμή ζώνης του αιτήματος', () => {
    const content = composed();
    expect(content.result.kind).toBe('computed');
    expect(content.result.zonePrice).toBe(1500);
    expect(content.result.factors.length).toBeGreaterThan(0);
    expect(content.draft).toBe(SNAPSHOT_DRAFT);
  });

  it('η χειροκίνητη τιμή ζώνης δηλώνεται ως «δική σας», ποτέ ως δεδομένα ζωνών', () => {
    expect(composed().provenance.zonePrice?.kind).toBe('user');
  });

  it('🔴 αρνείται ό,τι δεν είναι `computed` — δεν παγώνουμε «λείπει κάτι»', () => {
    const result = composeObjectiveValueSnapshot({ ...SNAPSHOT_REQUEST, draft: { ...SNAPSHOT_DRAFT, levels: [{ floor: null, area: 80 }] } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('floor');
  });
});

describe('objectiveValueSnapshotDigest', () => {
  it('ίδιο περιεχόμενο ⇒ ίδιο αποτύπωμα (64 hex)', async () => {
    const digest = await objectiveValueSnapshotDigest(composed());
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    await expect(objectiveValueSnapshotDigest(composed())).resolves.toBe(digest);
  });

  it('🔑 τα πεδία αποθήκευσης (id · χρόνος · δημιουργός) ΔΕΝ μπαίνουν στο αποτύπωμα', async () => {
    const content = composed();
    const stored = { ...content, id: 'ovsn_1', digest: 'x', companyId: 'comp_1', createdAt: '2026-11-23T09:00:00.000Z', createdBy: 'u1' };
    await expect(objectiveValueSnapshotDigest(stored)).resolves.toBe(await objectiveValueSnapshotDigest(content));
  });

  it('διαφορετικό ποσό ⇒ διαφορετικό αποτύπωμα', async () => {
    const other = composed({ ...SNAPSHOT_REQUEST, zone: { kind: 'manual', price: 1600 } });
    await expect(objectiveValueSnapshotDigest(other)).resolves.not.toBe(await objectiveValueSnapshotDigest(composed()));
  });

  it('ο σπόρος δένει εκδότη και αποτύπωμα', () => {
    expect(objectiveValueSnapshotSeed('comp_1', 'abc')).toBe('comp_1:abc');
  });
});

describe('isObjectiveValueSnapshotRecord', () => {
  it('δέχεται αποθηκευμένο στιγμιότυπο του τρέχοντος σχήματος', () => {
    const stored = { ...composed(), id: 'ovsn_1', digest: 'd', companyId: 'comp_1', createdAt: 't', createdBy: 'u1' };
    expect(isObjectiveValueSnapshotRecord(stored)).toBe(true);
  });

  it('αρνείται έγγραφο χωρίς αποτέλεσμα `computed` ή άλλου σχήματος', () => {
    const stored = { ...composed(), id: 'ovsn_1', digest: 'd', companyId: 'comp_1', createdAt: 't', createdBy: 'u1' };
    expect(isObjectiveValueSnapshotRecord({ ...stored, schema: 2 })).toBe(false);
    expect(isObjectiveValueSnapshotRecord({ ...stored, result: { kind: 'needsInput' } })).toBe(false);
    expect(isObjectiveValueSnapshotRecord(null)).toBe(false);
  });
});
