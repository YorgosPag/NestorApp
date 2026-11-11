/**
 * ADR-937 §3.1 — άγκυρες της γεωαναφοράς στο IFC4: `TrueNorth` + `IfcProjectedCRS` + `IfcMapConversion`.
 *
 * 🔑 Το αναμενόμενο **δεν** είναι γραμμένο με το χέρι όπου υπάρχει αυθεντία: παράγεται από το
 * `lib/geo/project-geo-frame` — την ΙΔΙΑ ανάγνωση που κάνει ο μετασχηματισμός του DXF viewer. Η συμφωνία
 * εκείνου του φύλλου με το `geo-transform.forwardRigidMap` κλειδώνεται μέσα στο subapp
 * (`project-geo-frame-agreement.test.ts`), οπότε η αλυσίδα IFC ≡ φύλλο ≡ οθόνη κλείνει χωρίς να περάσει
 * εισαγωγή το σύνορο του subapp (CHECK 3.62).
 *
 * Μία άγκυρα **φυσικής**, ανεξάρτητη από κάθε κώδικα: r = 90° ⇒ ο Βορράς είναι το +X του έργου (ADR-937 Κ3).
 */

import { IfcGraph, type IfcEntityRecord, type IfcValue } from '../ifc-entity-graph';
import { appendIfcGeometricContext } from '../ifc-units';
import { appendIfcMapConversion } from '../ifc-georeference';
import { projectXAxisInWorld, trueNorthInProject } from '@/lib/geo/project-geo-frame';
import { GREEK_GRID_CRS } from '@/lib/geo/greek-grid';

type Records = ReadonlyMap<number, IfcEntityRecord>;

function indexOf(graph: IfcGraph): Records {
  return new Map(graph.records().map((r) => [r.id, r]));
}

function realOf(v: IfcValue): number {
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'real') return v.value;
  throw new Error(`expected IfcReal, got ${JSON.stringify(v)}`);
}

function refOf(v: IfcValue): number {
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'ref') return v.id;
  throw new Error(`expected ref, got ${JSON.stringify(v)}`);
}

function stringOf(v: IfcValue): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'label') return v.value;
  throw new Error(`expected label, got ${JSON.stringify(v)}`);
}

function trueNorthOf(r: number): number[] {
  const graph = new IfcGraph();
  const contextID = appendIfcGeometricContext(graph, r);
  const byId = indexOf(graph);
  const direction = byId.get(refOf(byId.get(contextID)!.args[5]));
  expect(direction?.type).toBe('IFCDIRECTION');
  const list = direction!.args[0];
  if (!Array.isArray(list)) throw new Error('expected direction ratios');
  return list.map(realOf);
}

const GEO = {
  basePoint: { x: 384_500.25, y: 4_201_200.75, z: 1.5 },
  surveyPoint: { z: 42 },
  northRotation: 30,
} as const;

function mapConversionOf(fields: Parameters<typeof appendIfcMapConversion>[2]) {
  const graph = new IfcGraph();
  const contextID = appendIfcGeometricContext(graph, fields.northRotation ?? 0);
  const ids = appendIfcMapConversion(graph, contextID, fields);
  return { graph, contextID, ids, byId: indexOf(graph) };
}

describe('ADR-937 §3.1 · IFC TrueNorth ≡ project-geo-frame', () => {
  it.each([0, 12, 45, 90, 180, -30, 270])('r = %p°', (r) => {
    const [x, y] = trueNorthOf(r);
    const [ex, ey] = trueNorthInProject(r);
    expect(x).toBeCloseTo(ex, 12);
    expect(y).toBeCloseTo(ey, 12);
  });

  it('άγκυρα φυσικής: r = 90° ⇒ ο Βορράς είναι το +X του έργου (1, 0)', () => {
    const [x, y] = trueNorthOf(90);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
  });
});

describe('ADR-937 §3.1 · IfcMapConversion (LoGeoRef 50)', () => {
  it('μη γεωαναφερμένο έργο ⇒ ΤΙΠΟΤΑ (θέση στο (0,0) θα ήταν ψέμα)', () => {
    const { graph, ids } = mapConversionOf({ basePoint: { z: 3 }, northRotation: 15 });
    expect(ids).toBeNull();
    expect(graph.records().some((r) => r.type === 'IFCMAPCONVERSION' || r.type === 'IFCPROJECTEDCRS')).toBe(false);
  });

  it('γράφει τη θέση της τοπικής αρχής, το ύψος της και τον άξονα X στον κάνναβο', () => {
    const { contextID, ids, byId } = mapConversionOf(GEO);
    expect(ids).not.toBeNull();
    const conv = byId.get(ids!.mapConversionID)!;
    expect(conv.type).toBe('IFCMAPCONVERSION');
    expect(refOf(conv.args[0])).toBe(contextID);
    expect(refOf(conv.args[1])).toBe(ids!.projectedCrsID);
    expect(realOf(conv.args[2])).toBe(384_500.25);
    expect(realOf(conv.args[3])).toBe(4_201_200.75);
    expect(realOf(conv.args[4])).toBeCloseTo(43.5, 12); // survey.z + basePoint.z (ADR-369)
    const [ax, ay] = projectXAxisInWorld(30);
    expect(realOf(conv.args[5])).toBeCloseTo(ax, 12);
    expect(realOf(conv.args[6])).toBeCloseTo(ay, 12);
    expect(realOf(conv.args[7])).toBe(1);
  });

  it('ο άξονας X και ο TrueNorth είναι κάθετοι — ΜΙΑ στροφή, όχι δύο αντίθετες', () => {
    for (const r of [0, 17, 90, -45, 200]) {
      const [ax, ay] = projectXAxisInWorld(r);
      const [nx, ny] = trueNorthOf(r);
      // Ο Βορράς του έργου, γυρισμένος στον κόσμο με τον ΙΔΙΟ άξονα X, πρέπει να βγει (0, 1).
      const worldX = ax * nx - ay * ny;
      const worldY = ay * nx + ax * ny;
      expect(worldX).toBeCloseTo(0, 12);
      expect(worldY).toBeCloseTo(1, 12);
    }
  });

  it('IfcProjectedCRS = ΕΓΣΑ\'87 (EPSG:2100), μονάδα METRE', () => {
    const { ids, byId } = mapConversionOf(GEO);
    const crs = byId.get(ids!.projectedCrsID)!;
    expect(crs.type).toBe('IFCPROJECTEDCRS');
    expect(stringOf(crs.args[0])).toBe(GREEK_GRID_CRS.name);
    expect(stringOf(crs.args[2])).toBe(GREEK_GRID_CRS.geodeticDatum);
    const unit = byId.get(refOf(crs.args[6]))!;
    expect(unit.type).toBe('IFCSIUNIT');
    expect(JSON.stringify(unit.args)).toContain('LENGTHUNIT');
    expect(JSON.stringify(unit.args)).toContain('METRE');
  });
});
