/**
 * ADR-507/508 (Tekton .TEK export) — core SSoT (geometry + writer + mapper).
 *
 * Επαληθεύει: canvas→meters ανά scene-unit· buildWallXMatrix = decoded τύπος (δείγμα
 * (0,0)→(5,0) t=0.25)· tekNum/escape/color· wall record fill (μηδέν placeholder leftover)·
 * inject στους markers (+throw αν λείπει)· mapper straight→record, curved→skip+warning.
 */

import { mmToMeters, buildWallXMatrix } from '../tek-geometry';
import {
  tekNum, escapeXml, colorHex6, xmatrixXml, buildWallRecordXml, injectTekEntities,
} from '../tek-xml-writer';
import { collectTekWalls } from '../bim-to-tek';
import type { Entity } from '../../../../types/entities';

describe('tek-geometry', () => {
  it('mmToMeters (reuse sceneUnitsToMeters SSoT)', () => {
    expect(mmToMeters(3000)).toBe(3);
    expect(mmToMeters(250)).toBe(0.25);
  });

  it('buildWallXMatrix = decoded τύπος (οριζόντιος τοίχος (0,0)→(5,0), t=0.25)', () => {
    const m = buildWallXMatrix(0, 0, 5, 0, 0.25);
    // (x00,x10)=E−S=(5,0)· (x01,x11)=n̂·t=(0,0.25)· origin=S−n̂·t/2=(0,−0.125) (centerline→παρειά).
    expect(m.x00).toBeCloseTo(5);
    expect(m.x10).toBeCloseTo(0);
    expect(m.x01).toBeCloseTo(0);
    expect(m.x11).toBeCloseTo(0.25);
    expect(m.x20).toBeCloseTo(0);
    expect(m.x21).toBeCloseTo(-0.125);
  });

  it('buildWallXMatrix κάθετος (0,0)→(0,5), t=0.2', () => {
    const m = buildWallXMatrix(0, 0, 0, 5, 0.2);
    expect(m.x00).toBeCloseTo(0);
    expect(m.x10).toBeCloseTo(5);
    expect(m.x01).toBeCloseTo(-0.2);
    expect(m.x11).toBeCloseTo(0);
    expect(m.x20).toBeCloseTo(0.1);
    expect(m.x21).toBeCloseTo(0);
  });
});

describe('tek-xml-writer helpers', () => {
  it('tekNum: δεκαδικά χωρίς εκθετική, trimmed', () => {
    expect(tekNum(0.25)).toBe('0.25');
    expect(tekNum(5)).toBe('5');
    expect(tekNum(NaN)).toBe('0');
  });
  it('escapeXml', () => {
    expect(escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
  });
  it('colorHex6: normalize + fallback', () => {
    expect(colorHex6('#80bcfc')).toBe('80BCFC');
    expect(colorHex6('FF0000')).toBe('FF0000');
    expect(colorHex6('bad')).toBe('80BCFC');
  });
  it('xmatrixXml σειρά x00..x21', () => {
    const s = xmatrixXml({ x00: 5, x01: 0, x10: 0, x11: 0.25, x20: 0, x21: -0.125 });
    expect(s).toBe('<xmatrix><x00>5</x00><x01>0</x01><x10>0</x10><x11>0.25</x11><x20>0</x20><x21>-0.125</x21></xmatrix>');
  });
});

describe('buildWallRecordXml', () => {
  it('γεμίζει όλα τα placeholders (κανένα {{…}} leftover)', () => {
    const xml = buildWallRecordXml({
      id: 2, name: '2', heightM: 3, elevationM: 0, colorHex: '#80bcfc',
      xmatrix: { x00: 5, x01: 0, x10: 0, x11: 0.25, x20: 0, x21: -0.125 },
    });
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain('<id>2</id>');
    expect(xml).toContain('<height>3</height>');
    expect(xml).toContain('<x11>0.25</x11>');
    expect(xml).toContain('80BCFC');
  });
});

describe('injectTekEntities', () => {
  const TPL = 'A<!--TEK_WALL_RECORDS-->B<!--TEK_OBJECT_RECORDS-->C';
  it('εγχέει walls/objects στους markers', () => {
    expect(injectTekEntities(TPL, 'WALLS', 'OBJ')).toBe('AWALLSBOBJC');
  });
  it('throw αν λείπει marker', () => {
    expect(() => injectTekEntities('no markers', 'x', 'y')).toThrow();
  });
});

// ── mapper ──
function straightWall(id: string, start: { x: number; y: number }, end: { x: number; y: number }): Entity {
  return {
    id, type: 'wall', kind: 'straight',
    params: { start: { ...start, z: 0 }, end: { ...end, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'mm' },
  } as unknown as Entity;
}

describe('collectTekWalls', () => {
  it('straight wall (mm) → ένα record, σωστές μέτρα-συντεταγμένες', () => {
    // (0,0)→(5000mm,0) πάχος 250mm → μέτρα (0,0)→(5,0), t=0.25.
    const r = collectTekWalls([straightWall('w1', { x: 0, y: 0 }, { x: 5000, y: 0 })]);
    expect(r.wallCount).toBe(1);
    expect(r.warnings).toEqual([]);
    expect(r.wallsXml).toContain('<x00>5</x00>');
    expect(r.wallsXml).toContain('<x11>0.25</x11>');
    expect(r.wallsXml).toContain('<height>3</height>');
  });

  it('curved/polyline → skip + warning', () => {
    const curved = { id: 'c', type: 'wall', kind: 'curved', params: {} } as unknown as Entity;
    const r = collectTekWalls([curved]);
    expect(r.wallCount).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('curved');
  });

  it('non-wall entity → αγνοείται', () => {
    const line = { id: 'l', type: 'line' } as unknown as Entity;
    expect(collectTekWalls([line]).wallCount).toBe(0);
  });

  it('scene-units cm → σωστή κλίμακα (500cm = 5m)', () => {
    const w = { id: 'w', type: 'wall', kind: 'straight',
      params: { start: { x: 0, y: 0, z: 0 }, end: { x: 500, y: 0, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'cm' },
    } as unknown as Entity;
    expect(collectTekWalls([w]).wallsXml).toContain('<x00>5</x00>');
  });
});
