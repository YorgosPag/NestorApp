/**
 * ADR-507/508 (Tekton .TEK export) — core SSoT (geometry + writer + mapper).
 *
 * Επαληθεύει: canvas→meters ανά scene-unit· buildWallXMatrix = decoded τύπος (δείγμα
 * (0,0)→(5,0) t=0.25)· tekNum/escape/color· wall record fill (μηδέν placeholder leftover)·
 * inject στους markers (+throw αν λείπει)· mapper straight→record, curved→skip+warning.
 */

import { mmToMeters, buildWallXMatrix, buildOpeningXMatrix, footprintRingToMeters } from '../tek-geometry';
import { computeFurnitureGeometry } from '../../../../bim/furniture/furniture-geometry';
import type { FurnitureParams } from '../../../../bim/types/furniture-types';
import {
  tekNum, escapeXml, colorHex6, xmatrixXml, buildWallRecordXml, injectTekEntities,
  buildOpenRecordXml, buildOpenXml, buildPlaneRecordXml, buildPlanePointsXml,
} from '../tek-xml-writer';
import { collectTekWalls, collectTekPlanes } from '../bim-to-tek';
import type { TekOpening, TekPlane } from '../tek-types';
import type { Entity } from '../../../../types/entities';

describe('tek-geometry', () => {
  it('mmToMeters (reuse sceneUnitsToMeters SSoT)', () => {
    expect(mmToMeters(3000)).toBe(3);
    expect(mmToMeters(250)).toBe(0.25);
  });

  it('buildWallXMatrix column-major (οριζόντιος (0,0)→(5,0), t=0.25)', () => {
    const m = buildWallXMatrix(0, 0, 5, 0, 0.25);
    // length axis (x00,x01)=E−S=(5,0)· thickness axis (x10,x11)=n̂·t=(0,0.25)· origin=(0,−0.125).
    expect(m.x00).toBeCloseTo(5);
    expect(m.x01).toBeCloseTo(0);
    expect(m.x10).toBeCloseTo(0);
    expect(m.x11).toBeCloseTo(0.25);
    expect(m.x20).toBeCloseTo(0);
    expect(m.x21).toBeCloseTo(-0.125);
  });

  it('buildWallXMatrix κάθετος (0,0)→(0,5), t=0.2 — transposed (length axis=(x00,x01))', () => {
    const m = buildWallXMatrix(0, 0, 0, 5, 0.2);
    // length (x00,x01)=(0,5)· thickness (x10,x11)=n̂·t, n̂=(−1,0) → (−0.2,0)· origin=(0.1,0).
    expect(m.x00).toBeCloseTo(0);
    expect(m.x01).toBeCloseTo(5);
    expect(m.x10).toBeCloseTo(-0.2);
    expect(m.x11).toBeCloseTo(0);
    expect(m.x20).toBeCloseTo(0.1);
    expect(m.x21).toBeCloseTo(0);
  });

  it('λοξός τοίχος → length ⊥ thickness ΣΤΗΝ ΑΝΑΓΝΩΣΗ ΤΟΥ ΤΕΚΤΟΝΑ (column-major, μηδέν ρόμβος)', () => {
    const m = buildWallXMatrix(0, 0, 3, 4, 0.2); // L=5, n̂=(−0.8,0.6)
    // Τέκτων column-major: length=(x00,x01), thickness=(x10,x11). dot=0 → ορθογώνιο.
    const dot = m.x00 * m.x10 + m.x01 * m.x11;
    expect(dot).toBeCloseTo(0);
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
  const TPL = 'A<!--TEK_WALL_RECORDS-->B<!--TEK_OBJECT_RECORDS-->C<!--TEK_PLANE_RECORDS-->D';
  it('εγχέει walls/objects/planes στους markers', () => {
    expect(injectTekEntities(TPL, 'WALLS', 'OBJ', 'PLANES')).toBe('AWALLSBOBJCPLANESD');
  });
  it('planes default κενό όταν παραλείπεται', () => {
    expect(injectTekEntities(TPL, 'WALLS', 'OBJ')).toBe('AWALLSBOBJCD');
  });
  it('throw αν λείπει marker (π.χ. plane)', () => {
    expect(() => injectTekEntities('A<!--TEK_WALL_RECORDS-->B<!--TEK_OBJECT_RECORDS-->C', 'x', 'y')).toThrow();
  });
});

// ── openings (ADR-512 ΦΑΣΗ 2) ──
// buildOpeningXMatrix: κέντρο+γωνία έρχονται από SSoT computeOpeningGeometry· εδώ μόνο xmatrix.
describe('buildOpeningXMatrix (column-major, μέτρα)', () => {
  it('οριζόντιο (center 1.45, rot 0, width 0.9) — u=â·w, v=n̂ μοναδιαίο, origin=center−â·w/2', () => {
    const m = buildOpeningXMatrix(1.45, 0, 0, 0.9);
    expect(m.x00).toBeCloseTo(0.9); // πλάτος κατά μήκος
    expect(m.x01).toBeCloseTo(0);
    expect(m.x10).toBeCloseTo(0);
    expect(m.x11).toBeCloseTo(1);   // μοναδιαίο κάθετο (ΟΧΙ ·thickness)
    expect(m.x20).toBeCloseTo(1);   // origin = 1.45 − 0.45
    expect(m.x21).toBeCloseTo(0);
  });

  it('κάθετο (rot π/2) → u ⊥ v (μηδέν ρόμβος), λοξό-safe', () => {
    const m = buildOpeningXMatrix(0, 1.45, Math.PI / 2, 0.9);
    const dot = m.x00 * m.x10 + m.x01 * m.x11;
    expect(dot).toBeCloseTo(0);
    expect(m.x01).toBeCloseTo(0.9); // length axis κατά +Y
    expect(m.x10).toBeCloseTo(-1);  // μοναδιαίο κάθετο
  });

  it('decode parity με δείγμα (παράθυρο: center 20.1, rot π, width 0.8)', () => {
    const m = buildOpeningXMatrix(20.1, 8.675, Math.PI, 0.8);
    expect(m.x00).toBeCloseTo(-0.8); // δείγμα x00=-0.8
    expect(m.x11).toBeCloseTo(-1);   // δείγμα x11=-1
    expect(m.x20).toBeCloseTo(20.5); // δείγμα x20=20.5
  });
});

describe('buildOpenRecordXml / buildOpenXml', () => {
  const op: TekOpening = {
    name: 'Θ.101', sillM: 0, headM: 2.2, side: 1, style: 1,
    xmatrix: { x00: 1, x01: 0, x10: 0, x11: -1, x20: 15.7, x21: 8.7 },
    txtX: 16.2, txtY: 8.675,
  };
  it('γεμίζει όλα τα placeholders (κανένα {{…}} leftover) + escape name', () => {
    const xml = buildOpenRecordXml({ ...op, name: '<a&b>' });
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain('<name>&lt;a&amp;b&gt;</name>');
    expect(xml).toContain('<elevation>0</elevation>');
    expect(xml).toContain('<top>2.2</top>');
    expect(xml).toContain('<style>1</style>');
    expect(xml).toContain('<x20>15.7</x20>');
  });
  it('buildOpenXml: κενό → "" ', () => {
    expect(buildOpenXml([])).toBe('');
  });
  it('buildOpenXml: τυλίγει records σε newline payload για <open>', () => {
    const s = buildOpenXml([op]);
    expect(s.startsWith('\n')).toBe(true);
    expect(s.endsWith('\n')).toBe(true);
    expect(s).toContain('<record>');
  });
});

// ── mapper ──
function straightWall(id: string, start: { x: number; y: number }, end: { x: number; y: number }): Entity {
  return {
    id, type: 'wall', kind: 'straight',
    params: { start: { ...start, z: 0 }, end: { ...end, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'mm' },
  } as unknown as Entity;
}

function opening(
  wallId: string, kind: string, offsetFromStart: number, width: number,
  extra: Record<string, unknown> = {},
): Entity {
  return {
    id: `o-${wallId}-${offsetFromStart}`, type: 'opening', kind,
    params: { wallId, kind, offsetFromStart, width, height: 2200, sillHeight: 0, ...extra },
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

describe('collectTekWalls — κουφώματα (ΦΑΣΗ 2)', () => {
  it('opening πάνω σε wall → nested <open><record> + openingCount', () => {
    // wall (0,0)→(5000mm,0)· πόρτα offset 1000mm width 900mm.
    const r = collectTekWalls([
      straightWall('w1', { x: 0, y: 0 }, { x: 5000, y: 0 }),
      opening('w1', 'door', 1000, 900),
    ]);
    expect(r.wallCount).toBe(1);
    expect(r.openingCount).toBe(1);
    expect(r.warnings).toEqual([]);
    // το <open> δεν είναι πια κενό· περιέχει record με opening xmatrix (x00=0.9 πλάτος).
    expect(r.wallsXml).toContain('<open>\n<record>');
    expect(r.wallsXml).toContain('<x00>0.9</x00>');
    expect(r.wallsXml).toContain('<x20>1</x20>'); // origin = start + 1m
  });

  it('style: παράθυρο→0, πόρτα→1', () => {
    const door = collectTekWalls([
      straightWall('w', { x: 0, y: 0 }, { x: 5000, y: 0 }),
      opening('w', 'door', 1000, 900),
    ]).wallsXml;
    expect(door).toContain('<style>1</style>');
    const win = collectTekWalls([
      straightWall('w', { x: 0, y: 0 }, { x: 5000, y: 0 }),
      opening('w', 'window', 1000, 900, { sillHeight: 900 }),
    ]).wallsXml;
    expect(win).toContain('<style>0</style>');
    expect(win).toContain('<elevation>0.9</elevation>'); // ποδιά 900mm
  });

  it('handing right → side 1', () => {
    const xml = collectTekWalls([
      straightWall('w', { x: 0, y: 0 }, { x: 5000, y: 0 }),
      opening('w', 'door', 1000, 900, { handing: 'right' }),
    ]).wallsXml;
    expect(xml).toContain('<side>1</side>');
  });

  it('πολλά κουφώματα στον ίδιο τοίχο → 2 records στο ίδιο <open>', () => {
    const r = collectTekWalls([
      straightWall('w', { x: 0, y: 0 }, { x: 6000, y: 0 }),
      opening('w', 'door', 500, 900),
      opening('w', 'window', 3000, 1200, { sillHeight: 900 }),
    ]);
    expect(r.openingCount).toBe(2);
    const opens = r.wallsXml.match(/<open>1<\/open>/g) ?? [];
    expect(opens.length).toBe(2); // δύο opening records (το <open>1</open> flag ανά record)
  });

  it('ορφανό κούφωμα (host απών) → warning + skip', () => {
    const r = collectTekWalls([opening('ghost', 'door', 1000, 900)]);
    expect(r.openingCount).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('ghost');
  });

  it('κούφωμα σε curved host → ορφανό (curved skip) + warning', () => {
    const curved = { id: 'cv', type: 'wall', kind: 'curved', params: {} } as unknown as Entity;
    const r = collectTekWalls([curved, opening('cv', 'door', 1000, 900)]);
    expect(r.openingCount).toBe(0);
    expect(r.warnings.some((w) => w.includes('curved'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('cv'))).toBe(true);
  });
});

// ── έπιπλα ως <plane> κουτιά (ADR-512 ΦΑΣΗ 2b) ──
describe('footprintRingToMeters (scene→μέτρα + elevation)', () => {
  it('mm footprint → μέτρα, Z=elevation', () => {
    const fp = [
      { x: 1000, y: 2000, z: 0 },
      { x: 3000, y: 2000, z: 0 },
    ];
    const pts = footprintRingToMeters(fp, 0.001, 0.5);
    expect(pts[0]).toEqual({ x: 1, y: 2, z: 0.5 });
    expect(pts[1]).toEqual({ x: 3, y: 2, z: 0.5 });
  });
});

describe('buildPlanePointsXml / buildPlaneRecordXml', () => {
  const plane: TekPlane = {
    points: [
      { x: 8.624, y: 7.55, z: 0 },
      { x: 10.624, y: 7.55, z: 0 },
      { x: 10.624, y: 9.55, z: 0 },
      { x: 8.624, y: 9.55, z: 0 },
    ],
    widthM: 0.9,
    colorHex: '#bc80fc',
  };
  it('points → 4 <point3d> records με σωστά X/Y/Z', () => {
    const xml = buildPlanePointsXml(plane.points);
    expect((xml.match(/<pointX>/g) ?? []).length).toBe(4);
    expect(xml).toContain('<pointX>8.624</pointX><pointY>7.55</pointY><pointZ>0</pointZ>');
  });
  it('record fill: κανένα {{…}} leftover + width(=ύψος) + color + 4 κορυφές', () => {
    const xml = buildPlaneRecordXml(plane);
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain('<width>0.9</width>');
    expect(xml).toContain('<color>BC80FC</color>');
    expect((xml.match(/<pointX>/g) ?? []).length).toBe(4);
    expect(xml).toContain('<type>10</type>');
  });
});

// Πραγματικό furniture entity: params + cached geometry (όπως στη δημιουργία, ADR-410).
// Ο tek mapper διαβάζει το cached footprint μέσω του γενικού extractEntityFootprintRing.
function furniture(
  position: { x: number; y: number }, rotationDeg: number,
  dims: { w: number; d: number; h: number }, extra: Record<string, unknown> = {},
): Entity {
  const params: FurnitureParams = {
    kind: 'chair', assetId: 'chair-01', position: { ...position, z: 0 }, rotationDeg,
    widthMm: dims.w, depthMm: dims.d, heightMm: dims.h, mountingElevationMm: 0, sceneUnits: 'mm',
    ...(extra as Partial<FurnitureParams>),
  };
  return {
    id: `f-${position.x}-${position.y}`, type: 'furniture', kind: 'chair',
    params,
    geometry: computeFurnitureGeometry(params),
  } as unknown as Entity;
}

describe('collectTekPlanes (έπιπλα → κουτιά)', () => {
  it('έπιπλο 2000×2000mm @ (1000,1000) rot 0 → footprint 2×2m γύρω από το κέντρο', () => {
    const r = collectTekPlanes([furniture({ x: 1000, y: 1000 }, 0, { w: 2000, d: 2000, h: 900 })]);
    expect(r.planeCount).toBe(1);
    // centred footprint: ±1m γύρω από (1,1) → x ∈ {0,2}, y ∈ {0,2}.
    expect(r.planesXml).toContain('<pointX>0</pointX><pointY>0</pointY>');
    expect(r.planesXml).toContain('<pointX>2</pointX><pointY>2</pointY>');
    expect(r.planesXml).toContain('<width>0.9</width>'); // ύψος 900mm = εξώθηση
  });

  it('λοξό έπιπλο (rot 90°) → rotated rectangle (W↔D swap στο footprint)', () => {
    // 2000(W)×1000(D) @ origin, rot 90° → footprint γίνεται 1000×2000 (X↔Y).
    const r = collectTekPlanes([furniture({ x: 0, y: 0 }, 90, { w: 2000, d: 1000, h: 800 })]);
    // μετά από rot 90: half-width(1m) πάει στον Y άξονα, half-depth(0.5m) στον X.
    expect(r.planesXml).toContain('<pointX>0.5</pointX>');
    expect(r.planesXml).toContain('<pointY>1</pointY>');
  });

  it('mounting elevation → pointZ', () => {
    const r = collectTekPlanes([furniture({ x: 0, y: 0 }, 0, { w: 500, d: 500, h: 900 }, { mountingElevationMm: 1200 })]);
    expect(r.planesXml).toContain('<pointZ>1.2</pointZ>');
  });

  it('non-furniture αγνοείται', () => {
    const wall = straightWall('w', { x: 0, y: 0 }, { x: 5000, y: 0 });
    expect(collectTekPlanes([wall]).planeCount).toBe(0);
  });

  it('scene-units invariance: φυσικό μέγεθος ίδιο σε mm & cm (2000mm → ±1m)', () => {
    // widthMm/depthMm/heightMm είναι ΠΑΝΤΑ mm· το sceneUnits αλλάζει μόνο το canvas mapping,
    // ΟΧΙ το φυσικό μέγεθος → footprint ±1m και στα δύο.
    const cm = collectTekPlanes([furniture({ x: 0, y: 0 }, 0, { w: 2000, d: 2000, h: 900 }, { sceneUnits: 'cm' })]);
    expect(cm.planesXml).toContain('<pointX>1</pointX>');
    expect(cm.planesXml).toContain('<pointX>-1</pointX>');
    expect(cm.planesXml).toContain('<width>0.9</width>'); // 900mm → 0.9m, ανεξ. sceneUnits
  });
});

// ── στέγη ως <plane> κουτί (ADR-512 ΦΑΣΗ A, MVP flat) ──
// Ίδιος γενικός extractor με έπιπλα/DXF: footprint από geometry.footprint, ύψος από
// params.thickness, στάθμη από params.basePivotZ. Κεκλιμένη μορφή → <autoroof> αργότερα.
function roof(
  footprint: ReadonlyArray<{ x: number; y: number }>,
  opts: { thickness: number; basePivotZ: number; sceneUnits?: string; color?: string },
): Entity {
  return {
    id: 'roof-1', type: 'roof', kind: 'pitched',
    ...(opts.color ? { color: opts.color } : {}),
    params: { thickness: opts.thickness, basePivotZ: opts.basePivotZ, sceneUnits: opts.sceneUnits ?? 'mm' },
    geometry: { footprint: { vertices: footprint.map((p) => ({ ...p, z: 0 })) } },
  } as unknown as Entity;
}

describe('collectTekPlanes (στέγη → κουτί, ΦΑΣΗ A)', () => {
  const SQUARE = [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
  ];

  it('flat στέγη 4×4m, πάχος 250mm, γείσο 3000mm → footprint μέτρα + width + pointZ=3', () => {
    const r = collectTekPlanes([roof(SQUARE, { thickness: 250, basePivotZ: 3000 })]);
    expect(r.planeCount).toBe(1);
    expect(r.planesXml).toContain('<pointX>0</pointX><pointY>0</pointY><pointZ>3</pointZ>');
    expect(r.planesXml).toContain('<pointX>4</pointX><pointY>4</pointY><pointZ>3</pointZ>');
    expect(r.planesXml).toContain('<width>0.25</width>'); // πάχος στέγης = εξώθηση
  });

  it('χρώμα από το entity (SSoT), fallback στο δείγμα όταν λείπει', () => {
    const colored = collectTekPlanes([roof(SQUARE, { thickness: 250, basePivotZ: 3000, color: '#FF8040' })]);
    expect(colored.planesXml).toContain('<color>FF8040</color>');
    const bare = collectTekPlanes([roof(SQUARE, { thickness: 250, basePivotZ: 3000 })]);
    expect(bare.planesXml).toContain('<color>BC80FC</color>');
  });

  it('έπιπλο + στέγη μαζί → δύο plane records', () => {
    const r = collectTekPlanes([
      furniture({ x: 1000, y: 1000 }, 0, { w: 2000, d: 2000, h: 900 }),
      roof(SQUARE, { thickness: 250, basePivotZ: 3000 }),
    ]);
    expect(r.planeCount).toBe(2);
  });
});
