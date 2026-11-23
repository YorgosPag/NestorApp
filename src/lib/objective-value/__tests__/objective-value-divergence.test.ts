/**
 * @jest-environment node
 *
 * Απόκλιση με απόδοση αιτίας (ADR-947 Δ3 · Φ2): κάθε σκαλοπάτι απομονώνει **ένα** αίτιο, και η αλυσίδα σταματά ρητά
 * όταν δεν μπορεί να προχωρήσει.
 */

import { objectiveValueDivergence, type ObjectiveValueLiveContext } from '../objective-value-divergence';
import { composeObjectiveValueSnapshot, type ObjectiveValueSnapshotContent, type ObjectiveValueSnapshotRequest } from '../objective-value-snapshot';
import { SNAPSHOT_DRAFT, SNAPSHOT_REQUEST } from './objective-value-snapshot.fixtures';

const TABLE = { sha256: 'a'.repeat(64), lastModified: null, validFrom: { from: '2022-01-01', to: '2025-01-01' } };
const ZONE_REQUEST: ObjectiveValueSnapshotRequest = {
  ...SNAPSHOT_REQUEST,
  zone: {
    kind: 'valueZones',
    point: { lat: 40.64, lng: 22.94 },
    frontKey: null,
    price: 1500,
    validFrom: '2022-01-01',
    commerciality: { kind: 'unknown' },
    table: TABLE,
  },
};

function snapshotOf(request: ObjectiveValueSnapshotRequest): ObjectiveValueSnapshotContent {
  const result = composeObjectiveValueSnapshot(request);
  if (!result.ok) throw new Error('δεν συντέθηκε');
  return result.content;
}

const SAME_DAY: ObjectiveValueLiveContext = {
  engine: SNAPSHOT_REQUEST.engine,
  today: SNAPSHOT_REQUEST.valuationDate,
  zone: { price: 1500, validFrom: '2022-01-01', commerciality: { kind: 'unknown' }, table: TABLE },
};

describe('objectiveValueDivergence', () => {
  it('τίποτα δεν άλλαξε ⇒ κανένα σκαλοπάτι, ίδιο ποσό', () => {
    const snapshot = snapshotOf(ZONE_REQUEST);
    const divergence = objectiveValueDivergence(snapshot, SAME_DAY);
    expect(divergence.steps).toEqual([]);
    expect(divergence.stop).toBeNull();
    expect(divergence.liveValue).toBeCloseTo(snapshot.result.value, 6);
    expect(divergence.engineChanged).toBe(false);
    expect(divergence.zoneTableChanged).toBe(false);
  });

  it('νέος πίνακας ζωνών με άλλη τιμή ⇒ ΜΟΝΟ το σκαλοπάτι `zoneTable`', () => {
    const snapshot = snapshotOf(ZONE_REQUEST);
    const live = { ...SAME_DAY, zone: { ...SAME_DAY.zone!, price: 1800, table: { ...TABLE, sha256: 'b'.repeat(64) } } };
    const divergence = objectiveValueDivergence(snapshot, live);
    expect(divergence.steps.map((step) => step.cause)).toEqual(['zoneTable']);
    expect(divergence.zoneTableChanged).toBe(true);
    expect(divergence.liveValue).toBeCloseTo((snapshot.result.value * 1800) / 1500, 6);
  });

  it('η αλλαγή ταυτότητας μηχανής φαίνεται ακόμη κι όταν το ποσό μένει ίδιο', () => {
    const divergence = objectiveValueDivergence(snapshotOf(ZONE_REQUEST), { ...SAME_DAY, engine: { version: '2099.1', tablesSha256: 'e'.repeat(64) } });
    expect(divergence.engineChanged).toBe(true);
    expect(divergence.steps).toEqual([]);
  });

  it('ο χρόνος περνά ⇒ σκαλοπάτι `time` όταν η παλαιότητα αλλάζει κλιμάκιο', () => {
    const snapshot = snapshotOf(ZONE_REQUEST);
    const divergence = objectiveValueDivergence(snapshot, { ...SAME_DAY, today: '2046-11-23' });
    const time = divergence.steps.find((step) => step.cause === 'time');
    expect(time?.factors.some((factor) => factor.key === 'age')).toBe(true);
  });

  it('🔑 το άθροισμα των σκαλοπατιών ΕΙΝΑΙ η συνολική διαφορά', () => {
    const snapshot = snapshotOf(ZONE_REQUEST);
    const live = { ...SAME_DAY, today: '2046-11-23', zone: { ...SAME_DAY.zone!, price: 1700 } };
    const divergence = objectiveValueDivergence(snapshot, live);
    const total = divergence.steps.reduce((sum, step) => sum + (step.to - step.from), 0);
    expect(snapshot.result.value + total).toBeCloseTo(divergence.liveValue ?? Number.NaN, 6);
  });

  it('🔴 η ζώνη δεν διαβάζεται ⇒ ρητή στάση, ποτέ «καμία διαφορά»', () => {
    const divergence = objectiveValueDivergence(snapshotOf(ZONE_REQUEST), { ...SAME_DAY, zone: null });
    expect(divergence.stop).toEqual({ kind: 'zone-unavailable' });
    expect(divergence.liveValue).toBeNull();
  });

  it('χειροκίνητη τιμή ζώνης ⇒ κανένα σκαλοπάτι πίνακα, ακόμη και χωρίς ζώνη', () => {
    const divergence = objectiveValueDivergence(snapshotOf({ ...SNAPSHOT_REQUEST, draft: SNAPSHOT_DRAFT }), { ...SAME_DAY, zone: null });
    expect(divergence.stop).toBeNull();
    expect(divergence.steps.some((step) => step.cause === 'zoneTable')).toBe(false);
  });
});
