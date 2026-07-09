/**
 * ADR-507/508 — `tek-export-adapter` pure path (assembleTekDocument).
 *
 * Επαληθεύει: scope filter (BIM-only walls στο 'both', αποκλεισμός στο 'dxf-only')·
 * injection στους markers του (fake) template. Το βαρύ skeleton asset ΔΕΝ φορτώνεται
 * (περνά fake template).
 */

import { assembleTekDocument } from '../tek-export-adapter';
import { computeFurnitureGeometry } from '../../../bim/furniture/furniture-geometry';
import type { FurnitureParams } from '../../../bim/types/furniture-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene-types';

// Includes the empty `<tag_visibility>` block the real skeleton carries, so the
// ADR-608 tag registry injection has its target (mirror of the v9.1 skeleton).
const FAKE_TPL = 'HEAD<tag_visibility>\n</tag_visibility><!--TEK_WALL_RECORDS--><!--TEK_OBJECT_RECORDS--><!--TEK_PLANE_RECORDS--><!--TEK_AUTOROOF_RECORDS--><!--TEK_LINE_RECORDS--><!--TEK_ARC_RECORDS--><!--TEK_STAIR_RECORDS-->TAIL';

function wall(): Entity {
  return {
    id: 'w1', type: 'wall', kind: 'straight',
    params: { start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'mm' },
  } as unknown as Entity;
}
function chair(): Entity {
  const params: FurnitureParams = {
    kind: 'chair', assetId: 'chair-01', position: { x: 1000, y: 1000, z: 0 }, rotationDeg: 0,
    widthMm: 2000, depthMm: 2000, heightMm: 900, mountingElevationMm: 0, sceneUnits: 'mm',
  };
  return {
    id: 'f1', type: 'furniture', kind: 'chair', params,
    geometry: computeFurnitureGeometry(params),
  } as unknown as Entity;
}
function roof(): Entity {
  return {
    id: 'r1', type: 'roof', kind: 'roof',
    params: {
      outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }, { x: 5000, y: 5000, z: 0 }, { x: 0, y: 5000, z: 0 }] },
      edges: [{ definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
        { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 }],
      slopeUnit: 'deg', thickness: 150, basePivotZ: 3000, sceneUnits: 'mm',
    },
    geometry: { faces: [{ outline: [{ x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 }, { x: 2500, y: 2500, z: 3900 }] }] },
  } as unknown as Entity;
}
function stair(): Entity {
  // Minimal straight stair (params + cached geometry σε scene units mm) — ο tek mapper
  // διαβάζει τα scalars + risers/stringers/walkline/arrowSymbol από τη γεωμετρία.
  return {
    id: 's1', type: 'stair', kind: 'straight',
    params: {
      basePoint: { x: 0, y: 0, z: 0 }, direction: 0,
      rise: 181.25, tread: 274, width: 800, stepCount: 16, totalRise: 2900,
      treadLabelDisplay: 'all', variant: { kind: 'straight' },
    },
    geometry: {
      risers: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 800, z: 181.25 } }],
      stringers: {
        inner: [{ x: 0, y: 0, z: 0 }, { x: 4110, y: 0, z: 2900 }],
        outer: [{ x: 0, y: 800, z: 0 }, { x: 4110, y: 800, z: 2900 }],
      },
      walkline: [{ x: 0, y: 400, z: 0 }, { x: 4110, y: 400, z: 2900 }],
      arrowSymbol: { start: { x: 0, y: 400, z: 0 }, end: { x: 4110, y: 400, z: 0 }, label: 'UP' },
      landings: [],
    },
  } as unknown as Entity;
}
function scene(entities: Entity[]): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('assembleTekDocument', () => {
  it('both → ο τοίχος εγχέεται στον wall marker (μέτρα)', () => {
    const { xml, warnings } = assembleTekDocument(FAKE_TPL, scene([wall()]), 'both');
    expect(xml.startsWith('HEAD')).toBe(true);
    expect(xml.endsWith('TAIL')).toBe(true);
    expect(xml).toContain('<x00>5</x00>');
    expect(xml).not.toMatch(/TEK_WALL_RECORDS/); // marker καταναλώθηκε
    expect(warnings).toEqual([]);
  });

  it('dxf-only → BIM τοίχος αποκλείεται (κανένα record)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([wall()]), 'dxf-only');
    expect(xml).not.toContain('<x00>');
    // Χωρίς σύμβολα → κανένα tag· το κενό `<tag_visibility>` block μένει αμετάβλητο.
    expect(xml).toBe('HEAD<tag_visibility>\n</tag_visibility>TAIL');
  });

  it('both → το έπιπλο εγχέεται στον plane marker ως <plane> record (2×2m κουτί)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([chair()]), 'both');
    expect(xml).toContain('<type>10</type>'); // plane record
    expect(xml).toContain('<width>0.9</width>'); // ύψος 900mm = εξώθηση
    expect(xml).not.toMatch(/TEK_PLANE_RECORDS/); // marker καταναλώθηκε
  });

  it('both → η στέγη εγχέεται στον autoroof marker ως <autoroof> record (type 8)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([roof()]), 'both');
    expect(xml).toContain('<type>8</type>');       // autoroof record
    expect(xml).toContain('<elevation>3</elevation>'); // basePivotZ 3000mm → 3m
    expect(xml).toContain('<onev3list>');           // computed «νερό»
    expect(xml).not.toMatch(/TEK_AUTOROOF_RECORDS/); // marker καταναλώθηκε
    expect(xml).not.toContain('<type>10</type>');   // στέγη ΟΧΙ ως plane
  });

  it('both → η σκάλα εγχέεται στον stair marker ως <stair> record (type 21, ADR-526 Φ3)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([stair()]), 'both');
    expect(xml).toContain('<type>21</type>');           // stair record
    expect(xml).toContain('<stair_width>0.8</stair_width>'); // 800mm → 0.8m
    expect(xml).toContain('<horiz_b>0.274</horiz_b>');  // πάτημα 274mm → 0.274m
    expect(xml).not.toMatch(/TEK_STAIR_RECORDS/);       // marker καταναλώθηκε
  });

  it('ADR-583/608 — annotation-symbol αποδομείται σε <line> records (type 4)', () => {
    const arrow = {
      id: 'na', type: 'annotation-symbol', layerId: 'lyr_a', color: '#00ff00',
      position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 15,
    } as unknown as Entity;
    // Χωρίς το σύμβολο → κανένα line record· με το σύμβολο → shaft/«N»/περίγραμμα βέλους ως lines.
    const empty = assembleTekDocument(FAKE_TPL, scene([]), 'both', 100).xml;
    const withArrow = assembleTekDocument(FAKE_TPL, scene([arrow]), 'both', 100).xml;
    expect(empty).not.toContain('<type>4</type>');
    expect(withArrow).toContain('<type>4</type>'); // line record type 4
  });

  it('ADR-608 native (default) — north-arrow → ΕΝΑ type-7 object, ΟΧΙ γραμμές', () => {
    const arrow = {
      id: 'na', type: 'annotation-symbol', layerId: 'lyr_a', color: '#00ff00',
      position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 15,
    } as unknown as Entity;
    const xml = assembleTekDocument(FAKE_TPL, scene([arrow]), 'both', 100).xml; // default native
    expect(xml).toContain('<type>7</type>');   // object record
    expect(xml).toContain('<type>51</type>');  // Βορράς 1 type_res
    expect(xml).not.toContain('<v0X>');        // ΟΧΙ αποδομημένες γραμμές (line records)
  });

  it('ADR-608 geometry mode — north-arrow → γραμμές + tag (ΟΧΙ object)', () => {
    const arrow = {
      id: 'na', type: 'annotation-symbol', layerId: 'lyr_a', color: '#00ff00',
      position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 15,
    } as unknown as Entity;
    const xml = assembleTekDocument(FAKE_TPL, scene([arrow]), 'both', 100, 'geometry').xml;
    expect(xml).toContain('<v0X>');            // αποδομημένες γραμμές (line records)
    expect(xml).toContain('<taglist>\n<s>na</s></taglist>'); // ομαδοποιημένες με tag
    expect(xml).not.toContain('<type>7</type>'); // ΟΧΙ object
  });
});
