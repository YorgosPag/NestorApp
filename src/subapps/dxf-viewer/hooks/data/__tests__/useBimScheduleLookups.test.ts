/**
 * ADR-363 §6 Phase 8 — useBimScheduleLookups SSoT tests.
 *
 * Coverage:
 *  - floor resolver: level name → fallback to current level (missing floorId) → ''
 *  - material resolver: construction material → localized label, others → raw
 *  - building resolver: explicit id → clean BuildingRef· missing id → single-building fallback
 *  - translateType / translateKind → dxf-schedule typeLabel.* / kind.*
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
    t: (key: string, opts?: { defaultValue?: string }) => {
      if (key.startsWith('constructionMaterials.')) return `LBL:${key.slice('constructionMaterials.'.length)}`;
      if (key.startsWith('kind.')) return `KIND:${key.slice('kind.'.length)}`;
      if (key.startsWith('typeLabel.')) return `TYPE:${key.slice('typeLabel.'.length)}`;
      return opts?.defaultValue ?? key;
    },
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
    currentLevelId: 'L0',
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
  it('floor resolver returns level name, falls back to current level when floorId missing', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { floor } = result.current.lookups;
    expect(floor('L1')).toBe('1ος όροφος');
    expect(floor(undefined)).toBe('Ισόγειο'); // fallback → currentLevelId 'L0'
  });

  it('floor resolver returns empty when neither floorId nor current level resolve', () => {
    mockUseLevels.mockReturnValue({ currentLevelId: null, levels: [] });
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.lookups.floor(undefined)).toBe('');
  });

  it('material resolver localizes construction ids, passes through others', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { material } = result.current.lookups;
    expect(material('mat-concrete')).toBe('LBL:mat-concrete');
    expect(material('raw-mix')).toBe('raw-mix');
    expect(material(undefined)).toBe('');
  });

  it('building resolver returns explicit ref, falls back to single building when id missing', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    const { building } = result.current.lookups;
    expect(building?.('b1')).toEqual({ id: 'b1', name: 'Κτήριο Α' });
    expect(building?.(undefined)).toEqual({ id: 'b1', name: 'Κτήριο Α' }); // single-building fallback
  });

  it('building resolver returns undefined when id missing and multiple buildings', () => {
    mockUseBuildings.mockReturnValue({ buildings: [{ id: 'b1', name: 'Α' }, { id: 'b2', name: 'Β' }] });
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.lookups.building?.(undefined)).toBeUndefined();
  });

  it('translateType / translateKind resolve dxf-schedule namespaces', () => {
    const { result } = renderHook(() => useBimScheduleLookups(ENTITIES));
    expect(result.current.lookups.translateType?.('wall')).toBe('TYPE:wall');
    expect(result.current.lookups.translateKind?.('strip')).toBe('KIND:strip');
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
      { id: 'door', label: 'KIND:door' },
      { id: 'raw-mix', label: 'raw-mix' },
      { id: 'pad', label: 'KIND:pad' },
    ]);
  });

  it('returns empty categories for empty entity list', () => {
    const { result } = renderHook(() => useBimScheduleLookups([]));
    expect(result.current.availableCategories).toEqual([]);
  });
});
