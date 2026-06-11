/**
 * ADR-441 Slice 2+6 — `commitFoundationGridFromGuides` orchestrator tests.
 *
 * Verifies managed reconcile: κενή σκηνή → all create (1 command)· re-run ίδιος
 * κάναβος → no-op (`up-to-date`, 0 commands)· ενδιάμεσος οδηγός → delete whole +
 * create splits (atomic compound)· no-dispatch όταν λείπουν άξονες.
 */

import { commitFoundationGridFromGuides } from '../foundation-grid-commit';
import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { ICommand } from '../../../core/commands/interfaces';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

const emptyScene = (): SceneModel =>
  ({ entities: [], layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }, units: 'mm' } as SceneModel);

/** Σκηνή με τα strips ενός build (ίδια bindings/geometry → ίδιο signature). */
const sceneWith = (guides: readonly Guide[]): SceneModel => {
  const built = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
  return { ...emptyScene(), entities: built.strips as unknown as Entity[] };
};

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const X2Y2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];

let orphanSeq = 0;
/** ADR-441 Slice 6b — legacy ορφανός γραμμικός πεδιλοδοκός (ΧΩΡΙΣ guideBindings). */
const orphanStrip = (start: { x: number; y: number }, end: { x: number; y: number }) =>
  ({
    id: `orphan${orphanSeq++}`, type: 'foundation', kind: 'strip', layerId: '0', visible: true,
    params: {
      kind: 'strip', start: { x: start.x, y: start.y, z: 0 }, end: { x: end.x, y: end.y, z: 0 },
      width: 800, topElevationMm: -1000, thicknessMm: 400, sceneUnits: 'mm',
    },
  } as unknown as Entity);

const sceneWithEntities = (entities: Entity[]): SceneModel => ({ ...emptyScene(), entities });

describe('commitFoundationGridFromGuides — reconcile', () => {
  it('κενή σκηνή 3×3 → all create (12) σε ΕΝΑ command', () => {
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(12);
    expect(result.deleted).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].getAffectedEntityIds()).toHaveLength(12);
  });

  it('re-run ίδιος κάναβος → no-op (up-to-date, 0 commands)', () => {
    const scene = sceneWith([...X3, ...Y3]);
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(result.unchanged).toBe(12);
    expect(executed).toHaveLength(0);
  });

  it('ενδιάμεσος οδηγός (2×2 → 2×3): delete obsolete + create νέα σε ΕΝΑ compound', () => {
    // Υπάρχουσα εσχάρα 2×2· προσθήκη ενδιάμεσου Y → οι κάθετες υποδιαιρούνται.
    const scene = sceneWith(X2Y2);
    const withMidY = [...X2Y2, guide('ymid', 'Y', 2000)];
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader(withMidY),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    // Οι 2 whole κάθετες (x0,x1 από y0→y1) γίνονται 4 split → delete 2, create 4·
    // + 1 νέα οριζόντια στο ymid. Άρα deleted>0 ΚΑΙ created>0 (atomic compound).
    expect(result.deleted).toBeGreaterThan(0);
    expect(result.created).toBeGreaterThan(0);
    expect(executed).toHaveLength(1);
  });

  it('REGRESSION (μέτρα): εξωτερικός οδηγός → stale corner-fill περιμετρικές διαγράφονται', () => {
    // Σκηνή σε ΜΕΤΡΑ (scale 0.001· corner-fill overhang width/2 ≈ 0.25 σκην. μονάδες).
    // Με το παλιό signature tol=1 το 0.25 χανόταν → οι πρώην ακραίες λωρίδες (που
    // έγιναν εσωτερικές) έπαιρναν ίδιο signature → ΔΕΝ διαγράφονταν → προεξοχή w/2
    // εισχωρούσε στις νέες (Giorgio screenshot). Με tol=0.001 ανιχνεύονται.
    const Xm = [guide('x0', 'X', 0), guide('x1', 'X', 4)];
    const Ym = [guide('y0', 'Y', 0), guide('y1', 'Y', 4)];
    const built = buildStripGridFromGuides(reader([...Xm, ...Ym]), {}, '0', 'm');
    const scene: SceneModel = { ...emptyScene(), entities: built.strips as unknown as Entity[] };
    const withTop = [...Xm, ...Ym, guide('y2', 'Y', 8)]; // νέος εξωτερικός πάνω
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader(withTop),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    // Οι πρώην ακραίες (top corner-fill) έγιναν εσωτερικές → ΠΡΕΠΕΙ να αντικατασταθούν.
    expect(result.deleted).toBeGreaterThan(0);
  });

  it('δεν dispatch-άρει όταν λείπουν άξονες (<2 ανά διεύθυνση)', () => {
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([guide('x0', 'X', 0)]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(executed).toHaveLength(0);
  });

  it('εκτελεσμένο command εφαρμόζει το delta στη σκηνή (create-only)', () => {
    const scene = emptyScene();
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: (_id, next) => { (scene as { entities: unknown[] }).entities = next.entities; },
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => c.execute(),
    });
    expect(result.ok).toBe(true);
    expect(scene.entities).toHaveLength(12);
    expect(scene.entities.every((e) => (e as { type?: string }).type === 'foundation')).toBe(true);
  });

  // ── ADR-441 Slice 6b — re-host legacy ορφανών (Option A) ────────────────────
  it('ορφανός ευθυγραμμισμένος → rehosted=1, μηδέν διπλό (created μειωμένο)', () => {
    const scene = sceneWithEntities([orphanStrip({ x: 0, y: 0 }, { x: 0, y: 4000 })]);
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.rehosted).toBe(1);
    // Το φάτνωμα V|x0|y0|y1 το «καλύπτει» ο rehosted → create 11 (όχι 12), 0 διπλό.
    expect(result.created).toBe(11);
    expect(result.deleted).toBe(0);
    expect(executed).toHaveLength(1);
  });

  it('rehost εκτελείται: ορφανός κρατά id & αποκτά bindings, μηδέν διπλό στη σκηνή', () => {
    const o = orphanStrip({ x: 0, y: 0 }, { x: 0, y: 4000 });
    const scene = sceneWithEntities([o]);
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: (_id, next) => { (scene as { entities: unknown[] }).entities = next.entities; },
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => c.execute(),
    });
    expect(result.ok).toBe(true);
    expect(scene.entities).toHaveLength(12); // 11 created + 1 rehosted, ΟΧΙ 13
    const kept = scene.entities.find((e) => (e as { id: string }).id === o.id);
    expect(kept).toBeDefined();
    expect((kept as { guideBindings?: unknown[] }).guideBindings?.length).toBeGreaterThan(0);
  });

  it('ορφανός εκτός κανάβου (mid-bay) → άθικτος (rehosted=0, ποτέ delete)', () => {
    const scene = sceneWithEntities([orphanStrip({ x: 2000, y: 0 }, { x: 2000, y: 4000 })]);
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.rehosted).toBe(0);
    expect(result.created).toBe(12); // πλήρης εσχάρα· ο ορφανός δεν συμμετέχει
    expect(result.deleted).toBe(0);
  });
});
