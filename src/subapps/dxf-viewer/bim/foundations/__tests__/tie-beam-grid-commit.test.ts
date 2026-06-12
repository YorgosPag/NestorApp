/**
 * ADR-441 Slice GEN-TIE — `commitTieBeamGridFromGuides` orchestrator tests.
 *
 * Verifies idempotent create + auto-junction (mirror GEN-WALL + εσχάρας): κενή σκηνή →
 * all create (1 command, γωνίες κλεισμένες)· re-run πάνω σε mitered → no-op
 * (`up-to-date`)· partial → μόνο missing· λείπουν άξονες → no dispatch· **migration**
 * (re-run σε non-mitered → jointed>0, γωνίες κλείνουν χωρίς νέα entities).
 *
 * **Kind-partition (ΚΡΙΣΙΜΟ):** μια σκηνή γεμάτη **πεδιλοδοκούς** ΔΕΝ κάνει skip τις
 * συνδετήριες — και αντίστροφα, η «Εσχάρα» δεν αγγίζει υπάρχουσες συνδετήριες.
 */

import { commitTieBeamGridFromGuides } from '../tie-beam-grid-commit';
import { commitFoundationGridFromGuides } from '../foundation-grid-commit';
import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import { computeGridJunctionExtends } from '../foundation-grid-junctions';
import type { FoundationEntity } from '../types/foundation-types';
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

/** Raw συνδετήριες (kind='tie-beam', κεντραρισμένες, ΧΩΡΙΣ miter). */
const builtTieBeams = (guides: readonly Guide[]): FoundationEntity[] =>
  buildStripGridFromGuides(reader(guides), {}, '0', 'mm', 'center', 'tie-beam').strips as FoundationEntity[];

/** Πλήρως committed συνδετήριες (με junction-miter εφαρμοσμένο, mirror του commit output). */
const miteredTieBeams = (guides: readonly Guide[]): FoundationEntity[] => {
  const ties = builtTieBeams(guides);
  const miterById = new Map(computeGridJunctionExtends(ties).map((j) => [j.rehosted.id, j.rehosted]));
  return ties.map((t) => miterById.get(t.id) ?? t);
};

const sceneFrom = (entities: readonly FoundationEntity[]): SceneModel =>
  ({ ...emptyScene(), entities: entities as unknown as Entity[] });

/** Πλήρως committed σκηνή συνδετήριων (re-run = up-to-date). */
const sceneWithTieBeams = (guides: readonly Guide[]): SceneModel => sceneFrom(miteredTieBeams(guides));

/** Σκηνή με τις πεδιλοδοκούς ενός build (kind='strip'). */
const sceneWithStrips = (guides: readonly Guide[]): SceneModel =>
  sceneFrom(buildStripGridFromGuides(reader(guides), {}, '0', 'mm', 'inner', 'strip').strips as FoundationEntity[]);

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const X2Y2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];

describe('commitTieBeamGridFromGuides — idempotent create + junction', () => {
  it('κενή σκηνή 3×3 → all create (12) σε ΕΝΑ command', () => {
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(12);
    expect(result.skipped).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].getAffectedEntityIds()).toHaveLength(12);
  });

  it('re-run σε mitered → no-op (up-to-date, 0 commands, 12 skipped)', () => {
    const scene = sceneWithTieBeams([...X3, ...Y3]);
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('up-to-date');
    expect(result.skipped).toBe(12);
    expect(result.jointed).toBe(0);
    expect(executed).toHaveLength(0);
  });

  it('partial: υπάρχει 2×2 → πλήρες 3×3 δημιουργεί μόνο τις 8 missing', () => {
    const scene = sceneWithTieBeams(X2Y2);
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(8);
    expect(result.skipped).toBe(4);
    expect(executed).toHaveLength(1);
  });

  it('λείπει διεύθυνση άξονα → insufficient-guides, μηδέν dispatch', () => {
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([guide('x0', 'X', 0), ...Y3]),
      getLevelScene: () => emptyScene(),
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(executed).toHaveLength(0);
  });
});

describe('GEN-TIE junction-miter — γωνίες κλείνουν (όχι κενά)', () => {
  it('οι περιμετρικές συνδετήριες παίρνουν extend στα terminus bindings (γωνία κλείνει)', () => {
    // Το command output = builder + junction-miter· οι γωνιακές αποκτούν extend≠undefined.
    const mitered = miteredTieBeams([...X3, ...Y3]);
    const withExtend = mitered.filter((t) => (t.guideBindings ?? []).some((b) => b.extend !== undefined));
    expect(withExtend.length).toBeGreaterThan(0);
  });

  it('migration: re-run σε non-mitered συνδετήριες → jointed>0, created=0 (κλείνει γωνίες χωρίς νέα)', () => {
    const scene = sceneFrom(builtTieBeams([...X3, ...Y3])); // raw, χωρίς miter
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(0);
    expect(result.jointed).toBeGreaterThan(0);
    expect(executed).toHaveLength(1);
  });
});

describe('GEN-TIE kind-partition — συνδετήριες ↔ πεδιλοδοκοί ανεξάρτητα overlays', () => {
  it('σκηνή ΓΕΜΑΤΗ πεδιλοδοκούς → οι συνδετήριες δημιουργούνται όλες (μηδέν skip)', () => {
    const scene = sceneWithStrips([...X3, ...Y3]); // 12 strips, ίδια segments
    const executed: ICommand[] = [];
    const result = commitTieBeamGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(12);
    expect(result.skipped).toBe(0);
  });

  it('«Εσχάρα» σε σκηνή ΓΕΜΑΤΗ συνδετήριες → ΔΕΝ τις διαγράφει (δημιουργεί strips κανονικά)', () => {
    const scene = sceneWithTieBeams([...X3, ...Y3]); // 12 tie-beams, ίδια segments
    const executed: ICommand[] = [];
    const result = commitFoundationGridFromGuides({
      guideReader: reader([...X3, ...Y3]),
      getLevelScene: () => scene,
      setLevelScene: () => {},
      levelId: '0', sceneUnits: 'mm',
      executeCommand: (c) => executed.push(c),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(12);
    expect(result.deleted).toBe(0);
  });
});
