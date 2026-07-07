/**
 * resolveEntityStyle — ADR-358 §G7 ByLayer/ByBlock pipeline tests.
 *
 * Coverage:
 *   - ByLayer inheritance for color / linetype / lineweight / transparency
 *   - ByBlock chain (entity → block → layer fallback)
 *   - Concrete entity values shadow layer/block
 *   - TrueColor priority over ACI over legacy hex
 *   - Lineweight special sentinels (-3 DEFAULT / -2 ByLayer / -1 ByBlock)
 *   - Linetype fallback to DEFAULT_LINETYPE_NAME on unknown name
 *   - Transparency cascade + clamp
 *   - Provenance reporting
 */

import { resolveEntityStyle, entityToStyleInput } from '../resolve-entity-style';
import { createSceneLayer, type SceneLayer } from '../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import { DEFAULT_LINETYPE_NAME } from '../../../config/linetype-iso-catalog';
import { __resetLinetypeRegistryForTesting } from '../../../stores/LinetypeRegistry';
import type { BlockStyleInput, EntityStyleInput } from '../resolved-style.types';

function freshLayer(overrides: Partial<Parameters<typeof createSceneLayer>[0]> = {}): SceneLayer {
  return createSceneLayer({
    name: 'TEST',
    color: '#AAAAAA',
    colorAci: 7,
    linetype: 'Continuous',
    lineweight: 0.25,
    transparency: 0,
    ...overrides,
  });
}

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
});

describe('resolveEntityStyle — ByLayer cascade', () => {
  test('empty entity inherits all from layer', () => {
    const layer = freshLayer({ color: '#FF0000', colorAci: 1, lineweight: 0.5, linetype: 'Dashed', transparency: 30 });
    const r = resolveEntityStyle({}, layer);
    expect(r.color).toBe('#FF0000');
    expect(r.colorAci).toBe(1);
    expect(r.lineweight).toBe(0.5);
    expect(r.linetype.name).toBe('Dashed');
    expect(r.transparency).toBe(30);
    expect(r.provenance.color).toBe('layer');
    expect(r.provenance.linetype).toBe('layer');
    expect(r.provenance.lineweight).toBe('layer');
    expect(r.provenance.transparency).toBe('layer');
  });

  test('explicit ByLayer linetype sentinel inherits layer linetype', () => {
    const layer = freshLayer({ linetype: 'Hidden' });
    const r = resolveEntityStyle({ linetypeName: 'ByLayer' }, layer);
    expect(r.linetype.name).toBe('Hidden');
    expect(r.provenance.linetype).toBe('layer');
  });

  test('explicit ByLayer lineweight sentinel inherits layer lineweight', () => {
    const layer = freshLayer({ lineweight: 0.7 });
    const r = resolveEntityStyle({ lineweightMm: LINEWEIGHT_SPECIAL.BYLAYER }, layer);
    expect(r.lineweight).toBe(0.7);
    expect(r.provenance.lineweight).toBe('layer');
  });
});

describe('resolveEntityStyle — concrete entity shadows layer', () => {
  test('entity ACI 1 (red) shadows layer ACI 3 (green)', () => {
    const layer = freshLayer({ colorAci: 3 });
    const r = resolveEntityStyle({ colorAci: 1 }, layer);
    expect(r.color).toBe('#FF0000');
    expect(r.colorAci).toBe(1);
    expect(r.provenance.color).toBe('entity');
  });

  test('entity hex shadows layer hex', () => {
    const layer = freshLayer({ color: '#111111' });
    const r = resolveEntityStyle({ colorHex: '#222222' }, layer);
    expect(r.color).toBe('#222222');
    expect(r.provenance.color).toBe('entity');
  });

  test('entity concrete lineweight 0.13mm shadows layer 0.5mm', () => {
    const layer = freshLayer({ lineweight: 0.5 });
    const r = resolveEntityStyle({ lineweightMm: 0.13 }, layer);
    expect(r.lineweight).toBe(0.13);
    expect(r.provenance.lineweight).toBe('entity');
  });

  test('entity concrete linetype name shadows layer', () => {
    const layer = freshLayer({ linetype: 'Continuous' });
    const r = resolveEntityStyle({ linetypeName: 'Dashed' }, layer);
    expect(r.linetype.name).toBe('Dashed');
    expect(r.provenance.linetype).toBe('entity');
  });
});

describe('resolveEntityStyle — ByBlock chain', () => {
  const block: BlockStyleInput = {
    colorAci: 2, // Yellow
    linetypeName: 'Center',
    lineweightMm: 0.4,
    transparency: 20,
  };

  test('color ByBlock resolves to block color', () => {
    const layer = freshLayer({ colorAci: 5 });
    const r = resolveEntityStyle({ colorMode: 'ByBlock' }, layer, block);
    expect(r.color).toBe('#FFFF00');
    expect(r.colorAci).toBe(2);
    expect(r.provenance.color).toBe('block');
  });

  test('linetype ByBlock resolves to block linetype', () => {
    const layer = freshLayer({ linetype: 'Hidden' });
    const r = resolveEntityStyle({ linetypeName: 'ByBlock' }, layer, block);
    expect(r.linetype.name).toBe('Center');
    expect(r.provenance.linetype).toBe('block');
  });

  test('lineweight ByBlock resolves to block lineweight', () => {
    const layer = freshLayer({ lineweight: 0.13 });
    const r = resolveEntityStyle({ lineweightMm: LINEWEIGHT_SPECIAL.BYBLOCK }, layer, block);
    expect(r.lineweight).toBe(0.4);
    expect(r.provenance.lineweight).toBe('block');
  });

  test('ByBlock without block falls through to layer', () => {
    const layer = freshLayer({ colorAci: 5, linetype: 'Hidden', lineweight: 0.18 });
    const r = resolveEntityStyle({
      colorMode: 'ByBlock',
      linetypeName: 'ByBlock',
      lineweightMm: LINEWEIGHT_SPECIAL.BYBLOCK,
    }, layer);
    expect(r.colorAci).toBe(5);
    expect(r.linetype.name).toBe('Hidden');
    expect(r.lineweight).toBe(0.18);
  });
});

describe('resolveEntityStyle — color SSoT priority', () => {
  test('TrueColor beats ACI beats hex (entity level)', () => {
    const layer = freshLayer();
    const e: EntityStyleInput = {
      colorTrueColor: 0x123456,
      colorAci: 1,
      colorHex: '#999999',
      colorMode: 'Concrete',
    };
    const r = resolveEntityStyle(e, layer);
    expect(r.color).toBe('#123456');
    expect(r.colorTrueColor).toBe(0x123456);
    expect(r.colorAci).toBeNull();
  });

  test('ACI beats hex when TrueColor missing', () => {
    const layer = freshLayer();
    const e: EntityStyleInput = { colorAci: 4, colorHex: '#888888', colorMode: 'Concrete' };
    const r = resolveEntityStyle(e, layer);
    expect(r.color).toBe('#00FFFF'); // ACI 4 = Cyan
    expect(r.colorAci).toBe(4);
  });

  test('layer TrueColor beats layer ACI for ByLayer entity', () => {
    const layer = freshLayer({ colorAci: 1, colorTrueColor: 0xABCDEF });
    const r = resolveEntityStyle({}, layer);
    expect(r.color).toBe('#ABCDEF');
    expect(r.colorTrueColor).toBe(0xABCDEF);
  });
});

describe('resolveEntityStyle — lineweight DEFAULT cascade', () => {
  test('-3 DEFAULT with project override 0.7mm', () => {
    const layer = freshLayer({ lineweight: LINEWEIGHT_SPECIAL.DEFAULT });
    const r = resolveEntityStyle(
      { lineweightMm: LINEWEIGHT_SPECIAL.DEFAULT },
      layer,
      undefined,
      { projectLineweight: 0.7 },
    );
    expect(r.lineweight).toBe(0.7);
    expect(r.provenance.lineweight).toBe('default');
  });

  test('-3 DEFAULT falls through to 0.25mm system default when no overrides', () => {
    const layer = freshLayer({ lineweight: LINEWEIGHT_SPECIAL.DEFAULT });
    const r = resolveEntityStyle({ lineweightMm: LINEWEIGHT_SPECIAL.DEFAULT }, layer);
    expect(r.lineweight).toBe(0.25);
    expect(r.provenance.lineweight).toBe('default');
  });
});

describe('resolveEntityStyle — linetype fallback', () => {
  test('unknown linetype on entity falls through to layer linetype', () => {
    const layer = freshLayer({ linetype: 'Hidden' });
    const r = resolveEntityStyle({ linetypeName: 'NotARealLinetype' }, layer);
    expect(r.linetype.name).toBe('Hidden');
    expect(r.provenance.linetype).toBe('layer');
  });

  test('unknown linetype on entity AND layer falls through to default Continuous', () => {
    const layer = freshLayer({ linetype: 'AlsoBogus' });
    const r = resolveEntityStyle({ linetypeName: 'NotARealLinetype' }, layer);
    expect(r.linetype.name).toBe(DEFAULT_LINETYPE_NAME);
    expect(r.provenance.linetype).toBe('default');
  });

  test('regression (item B): a catalog DENSITY VARIANT (DotX2) on the entity resolves to its real def, NOT solid Continuous', () => {
    // `DotX2` is in the ISO catalog but not in the LinetypeRegistry seed. The
    // cascade used registry-only lookup → miss → default Continuous → rendered
    // solid. After item B the cascade goes through `resolveLinetypeDef`
    // (catalog∪registry), so the variant resolves at entity level.
    const layer = freshLayer({ linetype: 'Continuous' });
    const r = resolveEntityStyle({ linetypeName: 'DotX2' }, layer);
    expect(r.linetype.name).toBe('DotX2');
    expect(r.linetype.pattern.length).toBeGreaterThan(0); // dashed, not solid
    expect(r.provenance.linetype).toBe('entity');
  });
});

describe('resolveEntityStyle — transparency cascade + clamp', () => {
  test('entity transparency 45 shadows layer 10', () => {
    const layer = freshLayer({ transparency: 10 });
    const r = resolveEntityStyle({ transparency: 45 }, layer);
    expect(r.transparency).toBe(45);
    expect(r.provenance.transparency).toBe('entity');
  });

  test('clamps values above 90', () => {
    const layer = freshLayer();
    const r = resolveEntityStyle({ transparency: 9999 }, layer);
    expect(r.transparency).toBe(90);
  });

  test('clamps negative to 0', () => {
    const layer = freshLayer();
    const r = resolveEntityStyle({ transparency: -50 }, layer);
    expect(r.transparency).toBe(0);
  });
});

describe('entityToStyleInput adapter', () => {
  test('hex `color` becomes colorHex without forcing Concrete mode', () => {
    const input = entityToStyleInput({ color: '#FF00FF' });
    expect(input.colorHex).toBe('#FF00FF');
    expect(input.colorMode).toBeUndefined();
  });

  test('explicit colorMode preserved', () => {
    const input = entityToStyleInput({ colorMode: 'ByBlock', color: '#FF0000' });
    expect(input.colorMode).toBe('ByBlock');
    expect(input.colorHex).toBe('#FF0000');
  });
});
