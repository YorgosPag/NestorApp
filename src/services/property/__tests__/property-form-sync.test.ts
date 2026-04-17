/**
 * Unit tests — property-form-sync helpers (ADR-287 Batch 23)
 */
import {
  buildFormDataFromProperty,
  diffServerSnapshot,
  type PropertyServerSnapshot,
} from '../property-form-sync';
import type { Property } from '@/types/property-viewer';

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    name: 'Unit A',
    code: 'U-001',
    type: 'apartment',
    buildingId: 'b1',
    floorId: 'f1',
    floor: 1,
    commercialStatus: 'available',
    description: 'desc',
    layout: { bedrooms: 2, bathrooms: 1, wc: 0 },
    areas: { gross: 100, net: 90, balcony: 10, terrace: 0, garden: 0 },
    orientations: ['N'],
    condition: 'new',
    energy: { class: 'A' },
    systemsOverride: { heatingType: 'gas', coolingType: 'vrv' },
    finishes: { flooring: ['wood'], windowFrames: 'alu', glazing: 'double' },
    interiorFeatures: ['fireplace'],
    securityFeatures: ['alarm'],
    levelData: {},
    levels: [],
    commercial: { askingPrice: 250000 },
    ...overrides,
  } as unknown as Property;
}

describe('buildFormDataFromProperty', () => {
  it('maps nested property fields into flat form shape', () => {
    const snapshot = buildFormDataFromProperty(makeProperty());
    expect(snapshot.name).toBe('Unit A');
    expect(snapshot.type).toBe('apartment');
    expect(snapshot.areaGross).toBe(100);
    expect(snapshot.areaNet).toBe(90);
    expect(snapshot.bedrooms).toBe(2);
    expect(snapshot.orientations).toEqual(['N']);
    expect(snapshot.energyClass).toBe('A');
    expect(snapshot.heatingType).toBe('gas');
    expect(snapshot.flooring).toEqual(['wood']);
    expect(snapshot.askingPrice).toBe('250000');
  });

  it('defaults missing fields to safe fallbacks (no undefined)', () => {
    const snapshot = buildFormDataFromProperty({ id: 'p2' } as unknown as Property);
    expect(snapshot.name).toBe('');
    expect(snapshot.type).toBe('');
    expect(snapshot.areaGross).toBe(0);
    expect(snapshot.orientations).toEqual([]);
    expect(snapshot.levelData).toEqual({});
    expect(snapshot.levels).toEqual([]);
    expect(snapshot.commercialStatus).toBe('unavailable');
    expect(snapshot.operationalStatus).toBe('draft');
    expect(snapshot.askingPrice).toBe('');
  });
});

describe('diffServerSnapshot', () => {
  const base: PropertyServerSnapshot = buildFormDataFromProperty(makeProperty());

  it('returns empty patch when snapshots are structurally equal', () => {
    const next = buildFormDataFromProperty(makeProperty());
    expect(diffServerSnapshot(base, next)).toEqual({});
  });

  it('returns only the primitive fields that server changed', () => {
    const next = buildFormDataFromProperty(makeProperty({ type: 'maisonette' }));
    expect(diffServerSnapshot(base, next)).toEqual({ type: 'maisonette' });
  });

  it('tolerates fresh array references with identical content (no false positive)', () => {
    // Simulate Firestore onSnapshot handing back a new array ref for orientations
    const next: PropertyServerSnapshot = { ...base, orientations: [...base.orientations] };
    expect(next.orientations).not.toBe(base.orientations);
    expect(diffServerSnapshot(base, next)).toEqual({});
  });

  it('detects array content change via structural equality', () => {
    const next: PropertyServerSnapshot = { ...base, orientations: ['N', 'S'] };
    expect(diffServerSnapshot(base, next)).toEqual({ orientations: ['N', 'S'] });
  });

  it('detects levelData object content change', () => {
    const next: PropertyServerSnapshot = {
      ...base,
      levelData: { f1: { areas: { gross: 50 } } as unknown as PropertyServerSnapshot['levelData'][string] },
    };
    const patch = diffServerSnapshot(base, next);
    expect(patch.levelData).toBeDefined();
  });

  it('preserves local edits by not emitting fields server did not change', () => {
    // Scenario: user edits areaGross locally → form state diverges from server
    // snapshot. Server emits same property (unchanged areas). Diff vs server
    // snapshots must stay empty so the merge `{...prev, ...patch}` leaves the
    // user's local areaGross intact.
    const next = buildFormDataFromProperty(makeProperty());
    const patch = diffServerSnapshot(base, next);
    expect(patch).toEqual({});
    expect(patch.areaGross).toBeUndefined();
  });

  it('emits multiple field patch when several server fields change at once', () => {
    const next = buildFormDataFromProperty(
      makeProperty({ type: 'studio', name: 'Unit A Renamed' }),
    );
    expect(diffServerSnapshot(base, next)).toEqual({
      type: 'studio',
      name: 'Unit A Renamed',
    });
  });
});
