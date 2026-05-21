// ============================================================================
// ♿ ARIA ENTITY DESCRIPTION GENERATOR — Unit tests (ADR-366 Phase 8.1)
// ============================================================================

import {
  generateWallDescription,
  generateColumnDescription,
  generateSlabDescription,
  generateOpeningDescription,
  generateAriaDescription,
  type AriaEntityData,
} from '../accessibility/aria-entity-description-generator';
import type { TFn } from '../accessibility/status-bar-text-generator';

// Mock TFn: maps keys to English locale values, then interpolates vars.
// Simulates actual i18next behaviour so assertions can check real content.
const MOCK_TRANSLATIONS: Record<string, string> = {
  'entity.wall': 'Wall',
  'entity.column': 'Column',
  'entity.beam': 'Beam',
  'entity.slab': 'Slab',
  'entity.opening': 'Opening',
  'entity.slabOpening': 'Slab opening',
  'entity.stair': 'Stair',
  'entity.unknown': 'BIM entity',
  'entity.noData': '—',
  'entity.withName': '{type} {name}',
  'entity.wallGeometry': ', length {length}m, height {height}m',
  'entity.columnGeometry': ', width {width}m, height {height}m',
  'entity.beamGeometry': ', length {length}m, height {height}m',
  'entity.slabGeometry': ', area {area}m², thickness {thickness}m',
  'entity.openingGeometry': ', width {width}m, height {height}m',
  'entity.slabOpeningGeometry': ', width {width}m, height {height}m',
  'entity.material': ', material {material}',
  'entity.level': ', level {level}',
};

const mockT: TFn = (key: string, vars?: Record<string, unknown>): string => {
  const template = MOCK_TRANSLATIONS[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  );
};

describe('generateWallDescription', () => {
  it('produces full description with all fields', () => {
    const data: AriaEntityData = {
      bimType: 'wall',
      entityName: 'Wall_A12',
      length: 5.2,
      height: 2.8,
      material: 'Concrete',
      levelName: 'Ground Floor',
    };
    const result = generateWallDescription(data, mockT);
    expect(result).toContain('Wall');
    expect(result).toContain('5.2');
    expect(result).toContain('2.8');
    expect(result).toContain('Concrete');
    expect(result).toContain('Ground Floor');
  });

  it('omits material fragment when material is absent', () => {
    const data: AriaEntityData = {
      bimType: 'wall',
      entityName: 'Wall_B03',
      length: 3.0,
      height: 2.5,
      levelName: 'Level 1',
    };
    const result = generateWallDescription(data, mockT);
    expect(result).toContain('3');
    expect(result).toContain('2.5');
    expect(result).toContain('Level 1');
    expect(result).not.toContain('material');
  });

  it('omits level fragment when levelName is absent', () => {
    const data: AriaEntityData = {
      bimType: 'wall',
      entityName: 'Wall_C07',
      length: 4.1,
      height: 3.0,
      material: 'Brick',
    };
    const result = generateWallDescription(data, mockT);
    expect(result).toContain('4.1');
    expect(result).toContain('Brick');
    expect(result).not.toContain('level');
  });
});

describe('generateColumnDescription', () => {
  it('produces description with width + height', () => {
    const data: AriaEntityData = {
      bimType: 'column',
      entityName: 'Col_D01',
      width: 0.4,
      height: 3.2,
    };
    const result = generateColumnDescription(data, mockT);
    expect(result).toContain('Column');
    expect(result).toContain('0.4');
    expect(result).toContain('3.2');
  });
});

describe('generateSlabDescription', () => {
  it('produces description with area + thickness', () => {
    const data: AriaEntityData = {
      bimType: 'slab',
      entityName: 'Slab_E01',
      area: 24.5,
      thickness: 0.2,
    };
    const result = generateSlabDescription(data, mockT);
    expect(result).toContain('Slab');
    expect(result).toContain('24.5');
    expect(result).toContain('0.2');
  });
});

describe('generateOpeningDescription', () => {
  it('produces description with width + height', () => {
    const data: AriaEntityData = {
      bimType: 'opening',
      entityName: 'Door_F01',
      width: 0.9,
      height: 2.1,
      levelName: 'Ground Floor',
    };
    const result = generateOpeningDescription(data, mockT);
    expect(result).toContain('Opening');
    expect(result).toContain('0.9');
    expect(result).toContain('2.1');
  });
});

describe('generateAriaDescription (unified dispatcher)', () => {
  it('returns noData sentinel when bimType and entityName are both absent', () => {
    const result = generateAriaDescription({ bimType: null, entityName: null }, mockT);
    expect(result).toBe('—');
  });

  it('returns unknown type label with entityName for unrecognized bimType', () => {
    const data: AriaEntityData = { bimType: 'xray', entityName: 'Weird_01' };
    const result = generateAriaDescription(data, mockT);
    expect(result).toContain('BIM entity');
    expect(result).toContain('Weird_01');
  });

  it('falls back to entityName display when no geometry data present', () => {
    const data: AriaEntityData = { bimType: 'wall', entityName: 'Wall_G01' };
    const result = generateAriaDescription(data, mockT);
    expect(result).toContain('Wall');
    expect(result).toContain('Wall_G01');
  });
});
