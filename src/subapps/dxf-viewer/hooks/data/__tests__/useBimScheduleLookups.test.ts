/**
 * ADR-363 §6 Phase 8 — useBimScheduleLookups SSoT tests.
 *
 * Coverage:
 *  - floor resolver: level name → fallback to id → '' for undefined
 *  - material resolver: construction material → localized label,
 *    non-construction id → raw, undefined → ''
 *  - building resolver: clean BuildingRef → undefined when missing
 *  - availableFloors / availableBuildings mapping
 *  - availableCategories: unique material ids + kinds, deduped, insertion order
 */

import { renderHook } from '@testing-library/react';

import { useBimScheduleLookups } from '../useBimScheduleLookups';
import type { AnyBimEntity } from '../../../bim/schedule/schedule-presets';

const mockUseLevels = jest.fn();
const mockUseBuildings = jest.fn();

jest.mock('../../../systems/levels', () => ({
  useLevels: () => mockUseLevels(),
}));
jest.mock('@/hooks/useFirestoreBuildings', () => ({
  useFirestoreBuildings: () => mockUseBuildings(),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      key.startsWith('constructionMaterials.')
        ? `LBL:${key.slice('constructionMaterials.'.length)}`
        : (opts?.defaultValue ?? key),
  }),
}));
jest.mock('../../../bim/materials/construction-materials', () => ({
  constructionMaterialLabelKey: (id: string) => `constructionMaterials.${id}`,
  isConstructionMaterialId: (id: string) => id.startsWith('mat-'),
}));

const ENTITIES = [
  { id: 'w1', type: 'wall', params: { material: 'mat-concrete' } },
  { id: 'w2', type: 'wall', params: { material: 'mat-concrete' } }, // duplicate material
  { id: 'o1', type: 'opening', params: { kind: 'door' } },
  { id: 'o2', type: 'opening', params: { kind: 'door' } }, // duplicate kind
  { id: 'f1', type: 'foundation', params: { kind: 'pad', material: 'raw-mix' } },
] as unknown as readonly AnyBimEntity[];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLevels.mockReturnValue({
    levels: [
      { id: 'L0', name: 'Ισόγειο' },
      { id: 'L1', name: '1ος όροφος' },
    ],
  });
  mockUseBuildings.mockReturnValue({
    buildings: [{ id: 'b1', name: 'Κτήριο Α' }],
  });
});

describe('useBimScheduleLookups — resolvers', () => {
  it('floor resolver returns level name, falls back to id, empty for undefined', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { floor } = result.current.lookups;
    expect(floor('L0')).toBe('Ισόγειο');
    expect(floor('unknown')).toBe('unknown');
    expect(floor(undefined)).toBe('');
  });

  it('material resolver localizes construction ids, passes through others', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { material } = result.current.lookups;
    expect(material('mat-concrete')).toBe('LBL:mat-concrete');
    expect(material('raw-mix')).toBe('raw-mix');
    expect(material(undefined)).toBe('');
  });

  it('building resolver returns a clean BuildingRef or undefined', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { building } = result.current.lookups;
    expect(building?.('b1')).toEqual({ id: 'b1', name: 'Κτήριο Α' });
    expect(building?.('missing')).toBeUndefined();
    expect(building?.(undefined)).toBeUndefined();
  });

  it('floorFinish resolver is undefined (ToS derivation deferred)', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.lookups.floorFinish('L0')).toBeUndefined();
  });
});

describe('useBimScheduleLookups — filter options', () => {
  it('maps floors and buildings to FilterOption[]', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.availableFloors).toEqual([
      { id: 'L0', label: 'Ισόγειο' },
      { id: 'L1', label: '1ος όροφος' },
    ]);
    expect(result.current.availableBuildings).toEqual([{ id: 'b1', label: 'Κτήριο Α' }]);
  });

  it('derives unique categories (material + kind), deduped in insertion order', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.availableCategories).toEqual([
      { id: 'mat-concrete', label: 'LBL:mat-concrete' },
      { id: 'door', label: 'door' },
      { id: 'raw-mix', label: 'raw-mix' },
      { id: 'pad', label: 'pad' },
    ]);
  });

  it('returns empty categories for empty entity list', () => {
    const { result } = renderHook(() => useBimScheduleLookups([]));
    expect(result.current.availableCategories).toEqual([]);
  });
});
