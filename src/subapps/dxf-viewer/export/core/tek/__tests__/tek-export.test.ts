/**
 * ADR-507/508 (Tekton .TEK export) — core SSoT (geometry + writer + mapper).
 *
 * Επαληθεύει: canvas→meters ανά scene-unit· buildWallXMatrix = decoded τύπος (δείγμα
 * (0,0)→(5,0) t=0.25)· tekNum/escape/color· wall record fill (μηδέν placeholder leftover)·
 * inject στους markers (+throw αν λείπει)· mapper straight→record, curved→skip+warning.
 */

import {
  mmToMeters, buildWallXMatrix, buildOpeningXMatrix, footprintRingToMeters, roofFaceRingToMeters,
  signedAreaXY, reverseRoofFootprint,
} from '../tek-geometry';
import { computeFurnitureGeometry } from '../../../../bim/furniture/furniture-geometry';
import type { FurnitureParams } from '../../../../bim/types/furniture-types';
import {
  tekNum, escapeXml, colorHex6, xmatrixXml, buildWallRecordXml, injectTekEntities,
  buildOpenRecordXml, buildOpenXml, buildPlaneRecordXml, buildPlanePointsXml,
  buildAutoroofRecordXml, buildRoofPointsXml, buildRoofV3ListXml,
} from '../tek-xml-writer';
import { collectTekWalls, collectTekPlanes, collectTekRoofs } from '../bim-to-tek';
import type { TekOpening, TekPlane, TekRoof, TekRoofPoint } from '../tek-types';
import type { Entity } from '../../../../types/entities';

describe('tek-geometry', () => {
  it('mmToMeters (reuse sceneUnitsToMeters SSoT)', () => {
    expect(mmToMeters(3000)).toBe(3);
    expect(mmToMeters(250)).toBe(0.25);
  });

  it('buildWallXMatrix column-major (οριζόντιος (0,0)→(5,0), t=0.25) — Y-flipped', () => {
    const m = buildWallXMatrix(0, 0, 5, 0, 0.25);
    // length axis (x00,x01)=E−S=(5,0)· thickness (x10,x11)=n̂·t=(0,0.25)· origin=(0,−0.125).
    // Y-flip (καμβάς Y-down → Τέκτων Y-up) αρνείται x01/x11/x21.
    expect(m.x00).toBeCloseTo(5);
    expect(m.x01).toBeCloseTo(0);
    expect(m.x10).toBeCloseTo(0);
    expect(m.x11).toBeCloseTo(-0.25); // Y-flipped
    expect(m.x20).toBeCloseTo(0);
    expect(m.x21).toBeCloseTo(0.125); // Y-flipped
  });

  it('buildWallXMatrix κάθετος (0,0)→(0,5), t=0.2 — transposed + Y-flipped', () => {
    const m = buildWallXMatrix(0, 0, 0, 5, 0.2);
    // length (x00,x01)=(0,5)· thickness (x10,x11)=n̂·t, n̂=(−1,0) → (−0.2,0)· origin=(0.1,0).
    expect(m.x00).toBeCloseTo(0);
    expect(m.x01).toBeCloseTo(-5); // Y-flipped
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
  const TPL = 'A<!--TEK_WALL_RECORDS-->B<!--TEK_OBJECT_RECORDS-->C<!--TEK_PLANE_RECORDS-->D<!--TEK_AUTOROOF_RECORDS-->E<!--TEK_LINE_RECORDS-->F<!--TEK_ARC_RECORDS-->G';
  it('εγχέει walls/objects/planes/autoroofs/lines/arcs στους markers', () => {
    expect(injectTekEntities(TPL, 'WALLS', 'OBJ', 'PLANES', 'ROOFS', 'LINES', 'ARCS'))
      .toBe('AWALLSBOBJCPLANESDROOFSELINESFARCSG');
  });
  it('planes/autoroofs/lines/arcs default κενά όταν παραλείπονται', () => {
    expect(injectTekEntities(TPL, 'WALLS', 'OBJ')).toBe('AWALLSBOBJCDEFG');
  });
  it('throw αν λείπει marker (π.χ. autoroof)', () => {
    expect(() => injectTekEntities('A<!--TEK_WALL_RECORDS-->B<!--TEK_OBJECT_RECORDS-->C<!--TEK_PLANE_RECORDS-->D', 'x', 'y')).toThrow();
  });
});

// ── openings (ADR-512 ΦΑΣΗ 2) ──
// buildOpeningXMatrix: κέντρο+γωνία έρχονται από SSoT computeOpeningGeometry· εδώ μόνο xmatrix.
describe('buildOpeningXMatrix (column-major, μέτρα)', () => {
  it('οριζόντιο (center 1.45, rot 0, width 0.9) — u=â·w, v=n̂ μοναδιαίο — Y-flipped', () => {
    const m = buildOpeningXMatrix(1.45, 0, 0, 0.9);
    expect(m.x00).toBeCloseTo(0.9); // πλάτος κατά μήκος
    expect(m.x01).toBeCloseTo(0);
    expect(m.x10).toBeCloseTo(0);
    expect(m.x11).toBeCloseTo(-1);  // μοναδιαίο κάθετο, Y-flipped
    expect(m.x20).toBeCloseTo(1);   // origin = 1.45 − 0.45
    expect(m.x21).toBeCloseTo(0);
  });

  it('κάθετο (rot π/2) → u ⊥ v (μηδέν ρόμβος), λοξό-safe — Y-flipped', () => {
    const m = buildOpeningXMatrix(0, 1.45, Math.PI / 2, 0.9);
    const dot = m.x00 * m.x10 + m.x01 * m.x11;
    expect(dot).toBeCloseTo(0); // ορθογωνιότητα διατηρείται μετά το Y-flip
    expect(m.x01).toBeCloseTo(-0.9); // length axis κατά −Y (Y-flipped)
    expect(m.x10).toBeCloseTo(-1);   // μοναδιαίο κάθετο
  });

  it('decode parity με δείγμα (παράθυρο: center 20.1, rot π, width 0.8) — Y-flipped κάθετο', () => {
    const m = buildOpeningXMatrix(20.1, 8.675, Math.PI, 0.8);
    expect(m.x00).toBeCloseTo(-0.8); // δείγμα x00=-0.8 (X άθικτο)
    expect(m.x11).toBeCloseTo(1);    // δείγμα x11=-1 → +1 μετά το Y-flip
    expect(m.x20).toBeCloseTo(20.5); // δείγμα x20=20.5 (X άθικτο)
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
    expect(r.wallsXml).toContain('<x11>-0.25</x11>'); // Y-flipped
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
    expect(pts[0]).toEqual({ x: 1, y: -2, z: 0.5 }); // Y-flip: 2000·F → −2
    expect(pts[1]).toEqual({ x: 3, y: -2, z: 0.5 });
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
    // centred footprint ±1m γύρω από (1,1) → x ∈ {0,2}, y ∈ {0,2}· Y-flip → y ∈ {0,−2}.
    expect(r.planesXml).toContain('<pointX>0</pointX><pointY>0</pointY>');
    expect(r.planesXml).toContain('<pointX>2</pointX><pointY>-2</pointY>');
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

// ── στέγη → native <autoroof> (ADR-512 ΦΑΣΗ A) ──
// Decoded από ΔΙΑΦΟΡΑ.tek: footprint <point> (κορυφές + κλίση ακμής σε rad) + <v3list>
// (τα «νερά» ως 3D faces, per-vertex z). FULL SSoT: footprint/edges → roofSlopeToRatio·
// faces από το ήδη-υπολογισμένο geometry.faces[].outline (canvas xy + mm z).
interface RoofEdge { definesSlope: boolean; slope: number }
interface RoofFaceFix { outline: ReadonlyArray<{ x: number; y: number; z: number }> }
interface Pt3 { x: number; y: number; z: number }
interface RoofRidgeFix { a: Pt3; b: Pt3 }
function roof(
  outline: ReadonlyArray<{ x: number; y: number }>,
  opts: {
    thickness: number; basePivotZ: number; edges: RoofEdge[]; faces?: RoofFaceFix[];
    ridges?: RoofRidgeFix[];
    slopeUnit?: 'deg' | 'percent'; sceneUnits?: string; color?: string;
  },
): Entity {
  return {
    id: 'roof-1', type: 'roof', kind: 'roof',
    ...(opts.color ? { color: opts.color } : {}),
    params: {
      outline: { vertices: outline.map((p) => ({ ...p, z: 0 })) },
      edges: opts.edges,
      slopeUnit: opts.slopeUnit ?? 'deg',
      thickness: opts.thickness,
      basePivotZ: opts.basePivotZ,
      sceneUnits: opts.sceneUnits ?? 'mm',
    },
    geometry: { faces: opts.faces ?? [], ridges: opts.ridges ?? [] },
  } as unknown as Entity;
}

describe('buildRoofPointsXml / buildRoofV3ListXml / buildAutoroofRecordXml', () => {
  const tekRoof: TekRoof = {
    id: 1, elevationM: 3, widthM: 0.15, volumeM3: 42.5, colorHex: '#A42800',
    points: [
      { x: 0, y: 0, angleRad: 0.366519 },
      { x: 5, y: 0, angleRad: 0 },
    ],
    faces: [[{ x: 0, y: 0, z: 3 }, { x: 5, y: 0, z: 3 }, { x: 2.5, y: 2.5, z: 3.9 }]],
  };
  it('points → <pX>/<pY>/<angle> records (κλίση σε rad)', () => {
    const xml = buildRoofPointsXml(tekRoof.points);
    expect(xml).toContain('<pX>0</pX><pY>0</pY><angle>0.366519</angle>');
    expect(xml).toContain('<pX>5</pX><pY>0</pY><angle>0</angle>');
  });
  it('v3list → <onev3list> ανά face με <v3> 3D κορυφές (per-vertex z)', () => {
    const xml = buildRoofV3ListXml(tekRoof.faces);
    expect((xml.match(/<onev3list>/g) ?? []).length).toBe(1);
    expect((xml.match(/<v3>/g) ?? []).length).toBe(3);
    expect(xml).toContain('<pvX>2.5</pvX><pvY>2.5</pvY><pvZ>3.9</pvZ>');
  });
  it('record fill: κανένα {{…}} leftover + elevation/width/volume/color + type 8', () => {
    const xml = buildAutoroofRecordXml(tekRoof);
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain('<type>8</type>');
    expect(xml).toContain('<elevation>3</elevation>');
    expect(xml).toContain('<width>0.15</width>');
    expect(xml).toContain('<roof_volume_acc>42.5</roof_volume_acc>'); // μη-μηδενικός όγκος
    expect(xml).toContain('<color>A42800</color>');
  });
  it('επίπεδη στέγη (κενά faces) → κενό <v3list>', () => {
    const flat: TekRoof = { ...tekRoof, faces: [] };
    expect(buildAutoroofRecordXml(flat)).toContain('<v3list></v3list>');
  });
});

describe('roofFaceRingToMeters (face outline → μέτρα, per-vertex z)', () => {
  it('canvas xy + mm z → μέτρα, Z ΑΝΑ κορυφή (όχι ισοπεδωμένο)', () => {
    const pts = roofFaceRingToMeters(
      [{ x: 1000, y: 2000, z: 3000 }, { x: 3000, y: 2000, z: 3896 }], 0.001,
    );
    expect(pts[0]).toEqual({ x: 1, y: -2, z: 3 }); // Y-flip
    expect(pts[1]).toEqual({ x: 3, y: -2, z: 3.896 });
  });

  it('ΚΑΘΑΡΙΖΕΙ degenerate επαναλήψεις: διπλές διαδοχικές + κλείσιμο (ο solver παράγει closed ring)', () => {
    // closed ring με duplicate (10,0,3) + κλείσιμο (==πρώτη) — όπως ο πραγματικός roof solver.
    const ring = [
      { x: 0, y: 0, z: 3000 }, { x: 10000, y: 0, z: 3000 }, { x: 10000, y: 0, z: 3000 }, // διπλή
      { x: 5000, y: 2500, z: 3900 }, { x: 0, y: 0, z: 3000 }, // κλείσιμο == πρώτη
    ];
    const pts = roofFaceRingToMeters(ring, 0.001);
    // απομένουν 3 distinct κορυφές (τρίγωνο), Y-flipped: (0,0,3),(10,0,3),(5,−2.5,3.9).
    expect(pts).toEqual([
      { x: 0, y: 0, z: 3 }, { x: 10, y: 0, z: 3 }, { x: 5, y: -2.5, z: 3.9 },
    ]);
  });

  it('διατηρεί κορυφές με ίδιο xy αλλά ΔΙΑΦΟΡΕΤΙΚΟ z (γνήσιες, ΟΧΙ διπλές)', () => {
    const pts = roofFaceRingToMeters(
      [{ x: 1000, y: 1000, z: 3000 }, { x: 1000, y: 1000, z: 4000 }], 0.001,
    );
    expect(pts).toHaveLength(2); // γείσο+κορφιάς στην ίδια xy = δύο διαφορετικά σημεία
  });
});

describe('collectTekRoofs (στέγη → <autoroof>, ΦΑΣΗ A)', () => {
  const SQUARE = [
    { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 },
  ];
  const FLAT_EDGES: RoofEdge[] = [
    { definesSlope: false, slope: 0 }, { definesSlope: false, slope: 0 },
    { definesSlope: false, slope: 0 }, { definesSlope: false, slope: 0 },
  ];

  it('επίπεδη στέγη → footprint points (angle 0), elevation/width σε μέτρα', () => {
    const r = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges: FLAT_EDGES })]);
    expect(r.roofCount).toBe(1);
    expect(r.autoroofsXml).toContain('<type>8</type>');
    expect(r.autoroofsXml).toContain('<elevation>3</elevation>'); // basePivotZ 3000mm
    expect(r.autoroofsXml).toContain('<width>0.15</width>');      // thickness 150mm
    expect(r.autoroofsXml).toContain('<pX>0</pX><pY>0</pY><angle>0</angle>');
    expect(r.autoroofsXml).toContain('<pX>5</pX><pY>0</pY><angle>0</angle>'); // 5000mm → 5m
  });

  it('δίρριχτη: νερό 30° → 0.5236 rad, αέτωμα → π/2 (κατακόρυφο, ΟΧΙ 0)', () => {
    // Ground truth (ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ_ΚΑΘΕΤΑ_ΑΕΤΩΜΑΤΑ.tek φτιαγμένη ΣΤΟΝ Τέκτονα): το <angle>
    // είναι η κλίση της πλευράς από το οριζόντιο. Αέτωμα = κατακόρυφη πλευρά = π/2, ΟΧΙ 0.
    // Με angle 0 ο Τέκτων βλέπει το αέτωμα ως οριζόντιο και δεν ζωγραφίζει τη στέγη.
    const edges: RoofEdge[] = [
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
    ];
    const r = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges, slopeUnit: 'deg' })]);
    // atan(roofSlopeToRatio(30,'deg')) = atan(tan(30°)) = 30° = 0.523598776 rad (tekNum 9dp).
    expect(r.autoroofsXml).toContain('<angle>0.523598776</angle>');
    // αέτωμα (definesSlope false) σε στέγη ΜΕ νερά → π/2 = tekNum(Math.PI/2) = 1.570796327.
    expect(r.autoroofsXml).toContain('<angle>1.570796327</angle>');
    expect(r.autoroofsXml).not.toContain('<angle>0</angle>');
  });

  it('faces → <v3list> με per-vertex z (κεκλιμένα «νερά»)', () => {
    const faces: RoofFaceFix[] = [
      { outline: [{ x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 }, { x: 2500, y: 2500, z: 3900 }] },
    ];
    const edges: RoofEdge[] = [{ definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 }];
    const r = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges, faces })]);
    expect(r.autoroofsXml).toContain('<onev3list>');
    expect(r.autoroofsXml).toContain('<pvX>2.5</pvX><pvY>-2.5</pvY><pvZ>3.9</pvZ>'); // κορφιάς, Y-flip
  });

  it('δίρριχτη: αετώματα → κατακόρυφα τρίγωνα στο <v3list> (2 νερά + 2 αετώματα)', () => {
    // 2 κεκλιμένα νερά (y-low/y-high) + 2 αετώματα (x=0 / x=5000). Ridge οριζόντιο στο μέσο.
    const edges: RoofEdge[] = [
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
    ];
    const faces: RoofFaceFix[] = [
      { outline: [{ x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 }, { x: 5000, y: 2500, z: 3900 }, { x: 0, y: 2500, z: 3900 }] },
      { outline: [{ x: 5000, y: 5000, z: 3000 }, { x: 0, y: 5000, z: 3000 }, { x: 0, y: 2500, z: 3900 }, { x: 5000, y: 2500, z: 3900 }] },
    ];
    const ridges: RoofRidgeFix[] = [
      { a: { x: 0, y: 2500, z: 3900 }, b: { x: 5000, y: 2500, z: 3900 } },
    ];
    const r = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges, faces, ridges })]);
    // 2 νερά + 2 αετώματα = 4 onev3list (πριν το fix: μόνο 2).
    expect((r.autoroofsXml.match(/<onev3list>/g) ?? []).length).toBe(4);
    // αετώματα = κατακόρυφα τρίγωνα: apex στο ridge (z=3.9), 2 eave corners (z=3) στο ίδιο x.
    expect(r.autoroofsXml).toContain('<pvX>5</pvX><pvY>0</pvY><pvZ>3</pvZ>');    // δεξί αέτωμα base (y=0)
    expect(r.autoroofsXml).toContain('<pvX>5</pvX><pvY>-5</pvY><pvZ>3</pvZ>');   // δεξί αέτωμα base, Y-flip
    expect(r.autoroofsXml).toContain('<pvX>5</pvX><pvY>-2.5</pvY><pvZ>3.9</pvZ>'); // apex, Y-flip
  });

  it('χωρίς ridges (επίπεδη/μη-διαθέσιμα) → κανένα αέτωμα face (graceful)', () => {
    const edges: RoofEdge[] = [
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
    ];
    const faces: RoofFaceFix[] = [
      { outline: [{ x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 }, { x: 2500, y: 2500, z: 3900 }] },
    ];
    const r = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges, faces })]);
    expect((r.autoroofsXml.match(/<onev3list>/g) ?? []).length).toBe(1); // μόνο το 1 νερό
  });

  it('χρώμα από entity (SSoT), fallback στο δείγμα όταν λείπει', () => {
    const colored = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges: FLAT_EDGES, color: '#FF8040' })]);
    expect(colored.autoroofsXml).toContain('<color>FF8040</color>');
    const bare = collectTekRoofs([roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges: FLAT_EDGES })]);
    expect(bare.autoroofsXml).toContain('<color>A42800</color>');
  });

  it('στέγη ΔΕΝ μπαίνει στα planes (μόνο σε autoroof)', () => {
    const r = roof(SQUARE, { thickness: 150, basePivotZ: 3000, edges: FLAT_EDGES });
    expect(collectTekPlanes([r]).planeCount).toBe(0);
  });

  it('CW canvas footprint → CCW export (ο Τέκτων θέλει CCW· Y-flip), κλίσεις ανά ακμή διατηρούνται', () => {
    // Σχήμα στέγης Giorgio: gable με κεκλιμένες ακμές y-low/y-high, αετώματα αριστερά/δεξιά.
    // Canvas outline CW (Y «κάτω») → πρέπει να βγει CCW με σωστή αντιστοίχιση κλίσης.
    const gable = [
      { x: 2760, y: -3900 }, { x: 7960, y: -3900 }, { x: 7960, y: -6550 }, { x: 2760, y: -6550 },
    ];
    const edges: RoofEdge[] = [
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
      { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
    ];
    const r = collectTekRoofs([roof(gable, { thickness: 434, basePivotZ: 3000, edges })]);
    const pts = [...r.autoroofsXml.matchAll(/<pX>([^<]*)<\/pX><pY>([^<]*)<\/pY><angle>([^<]*)<\/angle>/g)]
      .map((m) => ({ x: +m[1], y: +m[2], a: +m[3] }));
    expect(signedAreaXY(pts)).toBeGreaterThan(0); // CCW
    // Κάθε κορυφή με κλίση π/2 = αέτωμα (κατακόρυφο)· με 0.5236 = κεκλιμένο νερό. 2 νερά + 2 αετώματα.
    expect(pts.filter((p) => Math.abs(p.a - 0.523598776) < 1e-3).length).toBe(2);
    expect(pts.filter((p) => Math.abs(p.a - Math.PI / 2) < 1e-3).length).toBe(2);
  });
});

describe('signedAreaXY / reverseRoofFootprint', () => {
  it('signedAreaXY: CCW θετικό, CW αρνητικό', () => {
    const ccw = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    expect(signedAreaXY(ccw)).toBeGreaterThan(0);
    expect(signedAreaXY([...ccw].reverse())).toBeLessThan(0);
  });

  it('reverseRoofFootprint: αντιστρέφει winding + μετατοπίζει κλίση ανά ακμή σωστά', () => {
    // p[i].angle = κλίση εξερχόμενης ακμής i→i+1. Μετά την αντιστροφή, κάθε ακμή κρατά την κλίση της.
    const pts: TekRoofPoint[] = [
      { x: 0, y: 0, angleRad: 0.5 }, // ακμή 0→1
      { x: 4, y: 0, angleRad: 0 },   // ακμή 1→2
      { x: 4, y: 4, angleRad: 0.5 }, // ακμή 2→3
      { x: 0, y: 4, angleRad: 0 },   // ακμή 3→0
    ];
    const rev = reverseRoofFootprint(pts);
    expect(signedAreaXY(pts)).toBeGreaterThan(0);
    expect(signedAreaXY(rev)).toBeLessThan(0); // αντίστροφο winding
    // reversed[0] = κορυφή p[3]=(0,4), εξερχόμενη ακμή (0,4)→(4,4) = αντίστροφη ακμής 2 → κλίση 0.5.
    expect(rev[0]).toEqual({ x: 0, y: 4, angleRad: 0.5 });
    // διπλή αντιστροφή = ταυτότητα (ίδιες κορυφές+κλίσεις).
    expect(reverseRoofFootprint(rev)).toEqual(pts);
  });
});
