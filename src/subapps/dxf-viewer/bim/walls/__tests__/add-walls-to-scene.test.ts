/**
 * ADR-911 Φ2 — άγκυρες της μαζικής εγγραφής τοίχων (`addWallsToScene`), πάνω στο ΠΡΑΓΜΑΤΙΚΟ
 * σχέδιο δοκιμής (το fixture της Φ1).
 *
 *   Α-3  προεπισκόπηση ≡ αποτέλεσμα: ό,τι γράφεται είναι οι τοίχοι της πρότασης, ένας προς έναν,
 *        και το αποτύπωμα καθενός είναι ΑΚΡΙΒΩΣ αυτό που φωτίστηκε.
 *   Α-5  Ν τοίχοι = ΕΝΑ βήμα undo και ΕΝΑ πέρασμα ενώσεων.
 *   +    η εγκεκριμένη παρτίδα δεν ξυπνά τους ανά-οντότητα ανιχνευτές (ADR-533).
 *   +    ο μονός τοίχος είναι η παρτίδα του ενός — και είναι πλέον αναιρέσιμος.
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { Entity } from '../../../types/entities';
import { isWallEntity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../types/wall-types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { EventBus } from '../../../systems/events/EventBus';
import { isInteractiveEntityCreation } from '../../../systems/events/bim-entity-lifecycle-events';
import type { EntityCreatedOrigin } from '../../../systems/events/drawing-event-map';
import { multiPolygonArea, projectVerticesTo2D } from '../../geometry/shared/polygon-utils';
import { safeIntersection } from '../../geometry/shared/safe-polygon-boolean';
import { buildWallFootprintRing } from '../../geometry/wall-geometry';
import { wallFootprintFromParams } from '../../finishes/wall-footprint-union';
import type { Point2D } from '../../../rendering/types/Types';
import type { DxfEntityUnion, DxfWall } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { applyWallColumnCutback2D } from '../../../hooks/canvas/dxf-scene-wall-cutback';
import { applyWallWallCrossCutback2D } from '../../../hooks/canvas/dxf-scene-wall-wall-cutback';
import { computeWallProposal, type WallProposal } from '../../model-from-drawing/wall-proposal';
import fixture from '../../model-from-drawing/__tests__/fixtures/floor-plan-lines.json';
import { computeFillingWallFootprints } from '../filling-walls-compute';
import { resolveCornerClusters } from '../wall-trims-corner-resolve';
import { addWallToScene, addWallsToScene, type WallSceneAccessor } from '../add-wall-to-scene';

// Μετρητής περασμάτων ενώσεων πάνω στην ΠΡΑΓΜΑΤΙΚΗ υλοποίηση (όχι υποκατάστατο). Μετριέται το
// `resolveCornerClusters`, που το `computeWallTrims` καλεί ΑΚΡΙΒΩΣ μία φορά ανά πέρασμα, άνευ όρων.
// Όχι το ίδιο το `computeWallTrims`: το `wall-trims` έχει κύκλο αρχικοποίησης με το
// `wall-column-end-miter` και δεν αντέχει mock factory (TDZ στο `JOIN_THRESHOLD_MM`).
jest.mock('../wall-trims-corner-resolve', () => {
  const actual = jest.requireActual('../wall-trims-corner-resolve');
  return { ...actual, resolveCornerClusters: jest.fn(actual.resolveCornerClusters) };
});

const LEVEL = 'lvl_test';
const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;

function propose(entities: readonly Entity[] = ENTITIES): WallProposal {
  return computeWallProposal({ entities, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: LEVEL });
}

interface Harness {
  readonly accessor: WallSceneAccessor;
  readonly entities: () => readonly Entity[];
  readonly walls: () => WallEntity[];
}

function harness(initial: readonly Entity[] = ENTITIES): Harness {
  let scene = { entities: [...initial] } as unknown as SceneModel;
  const entities = (): readonly Entity[] => scene.entities as unknown as readonly Entity[];
  return {
    accessor: {
      currentLevelId: LEVEL,
      getLevelScene: () => scene,
      setLevelScene: (_id, next) => { scene = next; },
    },
    entities,
    walls: () => entities().filter(isWallEntity),
  };
}

interface CreatedEvent { readonly id: string; readonly tool: string; readonly origin?: EntityCreatedOrigin }

function recordCreated(): { events: CreatedEvent[]; off: () => void } {
  const events: CreatedEvent[] = [];
  const off = EventBus.on('drawing:entity-created', (p) =>
    events.push({ id: p.entity.id, tool: p.tool, origin: p.origin }),
  );
  return { events, off };
}

function wall(ax: number, ay: number, bx: number, by: number): WallEntity {
  const r = buildWallEntity(buildDefaultWallParams({ x: ax, y: ay }, { x: bx, y: by }), LEVEL, 'straight', 'mm');
  if (!r.ok) throw new Error(`fixture wall invalid: ${r.hardErrors.join(',')}`);
  return r.entity;
}

/** Τα params ενός τοίχου χωρίς τα τέσσερα πεδία ένωσης — ό,τι ΔΕΝ επιτρέπεται να αλλάξει. */
function withoutTrim(w: WallEntity): Record<string, unknown> {
  const { startMiter, endMiter, startBevel, endBevel, ...rest } = w.params as unknown as Record<string, unknown>;
  void startMiter; void endMiter; void startBevel; void endBevel;
  return rest;
}

const axisLength = (w: WallEntity): number =>
  Math.hypot(w.params.end.x - w.params.start.x, w.params.end.y - w.params.start.y);

/** Τετράγωνη κολώνα (μόνο ό,τι διαβάζουν οι ενώσεις, ο κριτής επικάλυψης και το κόψιμο σώματος). */
function columnAt(id: string, c: Point2D, half: number): Entity {
  const vertices = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: c.x + sx * half, y: c.y + sy * half, z: 0 }));
  return { id, type: 'column', geometry: { footprint: { vertices } } } as unknown as Entity;
}

const ringArea = (ring: readonly Point2D[]): number => multiPolygonArea([[ring.map((p): Pair => [p.x, p.y])]]);
const piecesArea = (pieces: readonly Point2D[][]): number => pieces.reduce((sum, p) => sum + ringArea(p), 0);

/** Το αποτύπωμα από τα γραμμένα params (με τις ενώσεις τους) — ανεξάρτητο από την κρυφή `geometry`. */
const drawnFromParams = (w: WallEntity): Point2D[] => projectVerticesTo2D(wallFootprintFromParams(w.params, w.kind));

/**
 * Το σώμα κάθε τοίχου της σκηνής ΟΠΩΣ ΤΟ ΠΑΙΡΝΕΙ Ο `WallRenderer`: οι δύο πραγματικές περάσεις
 * της μετατροπής σκηνής (κολώνες → διασταύρωση) και μετά `displayFootprint ?? δακτύλιος`
 * (`traceWallBody`). Ο κριτής της Α-3.
 */
function paintedBodies(entities: readonly Entity[]): Point2D[][][] {
  const rendered = applyWallWallCrossCutback2D(applyWallColumnCutback2D([...entities] as unknown as DxfEntityUnion[]));
  return rendered
    .filter((e): e is DxfWall => e.type === 'wall')
    .map((w) => (w.geometry.displayFootprint
      ? w.geometry.displayFootprint.map((r) => [...r])
      : [buildWallFootprintRing(w.geometry.outerEdge.points, w.geometry.innerEdge.points)]));
}

const history = getGlobalCommandHistory();

beforeEach(() => {
  history.clear();
});

describe('ADR-911 Α-3 — προεπισκόπηση ≡ αποτέλεσμα', () => {
  it('γράφονται οι τοίχοι της πρότασης, ένας προς έναν, αυτούσιοι εκτός από την ένωση', () => {
    const proposal = propose();
    const h = harness();

    const result = addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });

    expect(result.refusal).toBeUndefined();
    expect(proposal.walls.length).toBe(38);
    expect(h.walls().map((w) => w.id)).toEqual(proposal.walls.map((w) => w.id));
    expect(result.written.map((w) => w.id)).toEqual(proposal.walls.map((w) => w.id));
    h.walls().forEach((written, i) => {
      expect(withoutTrim(written)).toEqual(withoutTrim(proposal.walls[i]));
    });
  });

  it('ό,τι φωτίστηκε είναι ΑΚΡΙΒΩΣ το σώμα που ζωγραφίζεται για κάθε γραμμένο τοίχο', () => {
    // ADR-911 Φ3α-4 — ο κριτής είναι ο ΠΡΑΓΜΑΤΙΚΟΣ αγωγός απόδοσης πάνω στη γραμμένη σκηνή, όχι η
    // συνάρτηση της προεπισκόπησης ξανά. Πριν, και οι δύο πλευρές ήταν `wallFootprintPolygon`
    // (ωμό ∪ λοξοτομημένο του σοβά), που δεν αλλάζει εμβαδό όσο κι αν κοπεί ένα άκρο: η άγκυρα
    // έμενε πράσινη ενώ το πράσινο περίγραμμα έφτανε ως τον άξονα του γείτονα.
    const proposal = propose();
    const preview = computeFillingWallFootprints(proposal.walls, ENTITIES);
    const h = harness();

    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });

    expect(preview).toEqual(paintedBodies(h.entities()));
    // Δεύτερος, ανεξάρτητος μάρτυρας: τα ΓΡΑΜΜΕΝΑ params (όχι η κρυφή `geometry` που διαβάζει η
    // απόδοση). Αν η εγγραφή άφηνε μπαγιάτικη `geometry`, οι δύο μάρτυρες θα διαφωνούσαν.
    expect(preview).toEqual(h.walls().map((w) => [drawnFromParams(w)]));
  });

  it('η άγκυρα δεν είναι κενή: οι ενώσεις ΑΛΛΑΖΟΥΝ εμβαδό, όχι μόνο σειρά κορυφών', () => {
    const proposal = propose();
    const preview = computeFillingWallFootprints(proposal.walls, ENTITIES);
    const changed = proposal.walls.filter((w, i) =>
      Math.abs(piecesArea(preview[i]) - ringArea(buildWallFootprintRing(w.geometry.outerEdge.points, w.geometry.innerEdge.points))) > 1,
    );
    // 14 τοίχοι του σχεδίου κόβονται πίσω στην παρειά του γείτονα (bevel)· κανένα miter.
    expect(changed).toHaveLength(14);
  });

  it('κανένα ζεύγος ΦΩΤΙΣΜΕΝΩΝ σωμάτων δεν μοιράζεται εμβαδό, και μαζί καλύπτουν ακριβώς τα ορθογώνια', () => {
    const proposal = propose();
    const preview = computeFillingWallFootprints(proposal.walls, ENTITIES);
    const clips = preview.map((pieces): Polygon[] => pieces.map((p): Polygon => [p.map((v): Pair => [v.x, v.y])]));
    const overlapping: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      for (let j = i + 1; j < clips.length; j++) {
        const area = multiPolygonArea(safeIntersection(clips[i], clips[j]));
        if (area > 1) overlapping.push(`${i}✕${j}: ${area.toFixed(0)} mm²`);
      }
    }
    expect(preview).toHaveLength(38);
    expect(overlapping).toEqual([]);
    const lit = preview.reduce((sum, pieces) => sum + piecesArea(pieces), 0);
    const rects = proposal.items.filter((i) => i.status === 'ready').reduce((sum, i) => sum + i.rect.area, 0);
    expect(lit).toBeCloseTo(rects, 3);
  });

  it('με κολώνες στη σκηνή: άκρο μέσα σε κολώνα και κολώνα στη μέση φωτίζονται όπως ζωγραφίζονται', () => {
    // Το σχέδιο δοκιμής δεν έχει κολώνες· η ζωντανή σκηνή έχει 11. Δύο κολώνες πάνω σε τοίχους της
    // πρότασης: η μία καταπίνει ένα άκρο, η άλλη κάθεται στη μέση του μακρύτερου και τον χωρίζει.
    const base = propose();
    const longest = [...base.walls].sort((a, b) => axisLength(b) - axisLength(a))[0];
    const mid = { x: (longest.params.start.x + longest.params.end.x) / 2, y: (longest.params.start.y + longest.params.end.y) / 2 };
    const other = base.walls.find((w) => w.id !== longest.id && axisLength(w) > 1500) as WallEntity;
    const columns = [columnAt('col_mid', mid, 200), columnAt('col_end', other.params.start, 200)];
    const scene = [...ENTITIES, ...columns];

    const proposal = propose(scene);
    const preview = computeFillingWallFootprints(proposal.walls, scene);
    const h = harness(scene);
    const result = addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });

    expect(result.refusal).toBeUndefined();
    expect(preview).toEqual(paintedBodies(h.entities()));
    // Δεν είναι κενό: τουλάχιστον ένας τοίχος φωτίζεται σε ΔΥΟ κομμάτια.
    expect(preview.some((pieces) => pieces.length === 2)).toBe(true);
    // Απόλυτος ισχυρισμός, ανεξάρτητος από τον αγωγό απόδοσης (που μοιράζεται τα βήματα κοψίματος
    // με την προεπισκόπηση): κανένα φωτισμένο κομμάτι δεν πατά πάνω σε κολώνα.
    const columnClips = columns.map((c): Polygon => [
      (c as unknown as { geometry: { footprint: { vertices: Point2D[] } } }).geometry.footprint.vertices
        .map((v): Pair => [v.x, v.y]),
    ]);
    const onColumn = preview.flat().reduce((sum, piece) =>
      sum + multiPolygonArea(safeIntersection([[piece.map((v): Pair => [v.x, v.y])]], columnClips)), 0);
    expect(onColumn).toBeLessThan(1);
  });

  it('Φ3α-2: με θόρυβο 0,001 mm στο σχέδιο η εγκεκριμένη πρόταση γράφεται ΟΛΟΚΛΗΡΗ (refuse)', () => {
    // Η ένωση τοίχων δεν είναι κατάληψη. Πριν: ο θόρυβος ενεργοποιούσε την επέκταση προς γείτονα
    // 100 mm, ο ωμός λόγος εμβαδού έβγαζε τον κοντό τοίχο «κατειλημμένο», και με `refuse` η
    // εγγραφή αρνιόταν ΟΛΗ την παρτίδα.
    const nudged = ENTITIES.map((e) => {
      const l = e as unknown as { start?: { x: number; y: number }; end?: { x: number; y: number } };
      if (!l.start || !l.end) return e;
      return { ...e, start: { x: l.start.x + 0.001, y: l.start.y - 0.001 }, end: l.end } as unknown as Entity;
    });
    const proposal = propose(nudged);
    const h = harness(nudged);

    const result = addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });

    expect(proposal.walls).toHaveLength(38);
    expect(result).toMatchObject({ blocked: 0 });
    expect(result.refusal).toBeUndefined();
    expect(result.written).toHaveLength(38);
  });

  it('οι γραμμές του σχεδίου μένουν ανέγγιχτες', () => {
    const proposal = propose();
    const h = harness();
    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk' });
    expect(h.entities().filter((e) => !isWallEntity(e))).toEqual(ENTITIES);
  });
});

describe('ADR-911 Α-5 — ένα undo, ένα πέρασμα ενώσεων', () => {
  it('Ν τοίχοι = ΜΙΑ εγγραφή ιστορικού και ΕΝΑ πέρασμα ενώσεων', () => {
    const proposal = propose();
    const h = harness();
    const trimPasses = resolveCornerClusters as jest.MockedFunction<typeof resolveCornerClusters>;
    trimPasses.mockClear(); // η πρόταση/προεπισκόπηση δεν μετρά — μόνο η εγγραφή

    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk' });

    expect(history.getUndoStack()).toHaveLength(1);
    expect(trimPasses).toHaveBeenCalledTimes(1);
  });

  it('ένα undo αφήνει τη σκηνή όπως ήταν· ένα redo ξαναδίνει τους ίδιους τοίχους', () => {
    const proposal = propose();
    const h = harness();
    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk' });
    const afterWrite = h.walls();

    expect(history.undo()).toBe(true);
    expect(h.entities()).toEqual(ENTITIES);
    expect(history.canUndo()).toBe(false);

    expect(history.redo()).toBe(true);
    expect(h.walls()).toEqual(afterWrite);
  });

  it('ένα undo επαναφέρει ΚΑΙ την ένωση του υπάρχοντος γείτονα', async () => {
    // Υπάρχων οριζόντιος τοίχος· η παρτίδα φέρνει τον κάθετο που κλείνει γωνία στο (0,0).
    const neighbour = wall(0, 0, 3000, 0);
    const h = harness([neighbour as unknown as Entity]);
    const { events, off } = recordCreated();

    const result = addWallsToScene([wall(0, 0, 0, 3000)], h.accessor);

    expect(result.retrimmedNeighbours).toBe(1);
    expect(h.walls().find((w) => w.id === neighbour.id)?.params).not.toEqual(neighbour.params);
    expect(history.getUndoStack()).toHaveLength(1);
    // Ο γείτονας ξανασώζεται ως `retrim` — όχι ως νέα οντότητα.
    await Promise.resolve();
    expect(events.filter((e) => e.id === neighbour.id).map((e) => e.origin)).toEqual(['retrim']);

    history.undo();
    expect(h.entities()).toEqual([neighbour]);
    off();
  });
});

describe('ADR-911 Φ2 — μόνο ό,τι ΑΛΛΑΞΕ ξαναγράφεται', () => {
  it('γείτονας που κρατά την ίδια ένωση δεν ξαναγράφεται ούτε ξαναεκπέμπεται', async () => {
    // Γωνία δύο τοίχων, ήδη ενωμένη. Ο τρίτος τοίχος είναι μακριά: καμία ένωση δεν αλλάζει,
    // αλλά οι δύο πρώτοι ΕΧΟΥΝ patch στο πέρασμα («έχει patch» ≠ «άλλαξε»).
    const h = harness([]);
    addWallsToScene([wall(0, 0, 3000, 0), wall(0, 0, 0, 3000)], h.accessor);
    await Promise.resolve();
    const corner = h.walls();
    expect(corner.every((w) => w.params.startMiter || w.params.endMiter)).toBe(true);
    const { events, off } = recordCreated();

    const result = addWallsToScene([wall(20000, 20000, 23000, 20000)], h.accessor);
    await Promise.resolve();

    expect(result.retrimmedNeighbours).toBe(0);
    expect(events.filter((e) => e.origin === 'retrim')).toEqual([]);
    expect(h.walls().slice(0, 2)).toEqual(corner);
    off();
  });
});

describe('ADR-911 Φ2 — σήμανση παρτίδας (ADR-533)', () => {
  it('κάθε εκπομπή της εγκεκριμένης παρτίδας φέρει origin που ΔΕΝ ξυπνά ανιχνευτή', async () => {
    const proposal = propose();
    const h = harness();
    const { events, off } = recordCreated();

    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk' });
    await Promise.resolve();

    expect(events).toHaveLength(proposal.walls.length);
    expect(events.every((e) => e.tool === 'wall' && e.origin === 'bulk')).toBe(true);
    expect(events.some((e) => isInteractiveEntityCreation(e.origin))).toBe(false);
    off();
  });

  it('χωρίς σήμανση (εργαλείο σχεδίασης) κάθε τοίχος μετρά ως μεμονωμένη δημιουργία', async () => {
    const h = harness([]);
    const { events, off } = recordCreated();

    addWallsToScene([wall(0, 0, 3000, 0), wall(0, 5000, 3000, 5000)], h.accessor);
    await Promise.resolve();

    expect(events).toHaveLength(2);
    expect(events.every((e) => isInteractiveEntityCreation(e.origin))).toBe(true);
    off();
  });

  it('isInteractiveEntityCreation: allowlist — μόνο undefined / create', () => {
    expect(isInteractiveEntityCreation(undefined)).toBe(true);
    expect(isInteractiveEntityCreation('create')).toBe(true);
    expect(isInteractiveEntityCreation('retrim')).toBe(false);
    expect(isInteractiveEntityCreation('bulk')).toBe(false);
  });
});

describe('ADR-911 Φ2 — άρνηση αντί για μερική εγγραφή', () => {
  it('refuse: αν η σκηνή άλλαξε μετά την προεπισκόπηση, δεν γράφεται ΤΙΠΟΤΑ', async () => {
    const proposal = propose();
    // Η σκηνή απέκτησε στο μεταξύ έναν από τους τοίχους της πρότασης (ίδιο αποτύπωμα, άλλο id).
    const squatter = { ...proposal.walls[0], id: 'wall_squatter' } as WallEntity;
    const initial = [...ENTITIES, squatter as unknown as Entity];
    const h = harness(initial);
    const { events, off } = recordCreated();

    const result = addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });
    await Promise.resolve();

    expect(result).toMatchObject({ refusal: 'overlap', blocked: 1, written: [] });
    expect(h.entities()).toEqual(initial);
    expect(history.canUndo()).toBe(false);
    expect(events).toEqual([]);
    off();
  });

  it('skip (default): το κομμένο μέλος παραλείπεται, τα υπόλοιπα γράφονται', () => {
    const proposal = propose();
    const squatter = { ...proposal.walls[0], id: 'wall_squatter' } as WallEntity;
    const h = harness([...ENTITIES, squatter as unknown as Entity]);

    const result = addWallsToScene(proposal.walls, h.accessor);

    expect(result.refusal).toBeUndefined();
    expect(result.blocked).toBe(1);
    expect(result.written).toHaveLength(proposal.walls.length - 1);
  });

  it('Α-6 πάνω στη ΓΡΑΜΜΕΝΗ σκηνή: δεύτερη εκτέλεση του βοηθού δεν έχει τίποτα να γράψει', () => {
    const h = harness();
    addWallsToScene(propose().walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });
    const written = h.walls().length;

    // Η πρόταση ξαναϋπολογίζεται πάνω στη σκηνή ΜΕ τους γραμμένους (ενωμένους) τοίχους.
    const second = propose(h.entities());
    expect(second.walls).toEqual([]);
    expect(second.items.filter((i) => i.status === 'existing')).toHaveLength(written);

    const again = addWallsToScene(second.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });
    expect(again.refusal).toBe('nothing-to-write');
    expect(h.walls()).toHaveLength(written);
    expect(history.getUndoStack()).toHaveLength(1);
  });

  it('χωρίς ενεργή σκηνή / κενή παρτίδα: ονομασμένη άρνηση, μηδέν ιστορικό', () => {
    const h = harness();
    expect(addWallsToScene([], h.accessor).refusal).toBe('nothing-to-write');
    expect(addWallsToScene([wall(0, 0, 1000, 0)], { ...h.accessor, currentLevelId: null }).refusal)
      .toBe('no-active-scene');
    expect(history.canUndo()).toBe(false);
  });
});

describe('ADR-911 Φ3α-3 — ό,τι σχεδιάστηκε είναι ό,τι ζωγραφίζεται: ούτε διπλό ούτε κενό', () => {
  /** Το αποτύπωμα που ΖΩΓΡΑΦΙΖΕΤΑΙ (params με τις ενώσεις τους) — όχι η ένωση raw ∪ mitered του σοβά. */
  const drawn = (w: WallEntity): Polygon =>
    [wallFootprintFromParams(w.params, w.kind).map((p): Pair => [p.x, p.y])];

  function written(entities: readonly Entity[] = ENTITIES): { proposal: WallProposal; walls: WallEntity[] } {
    const proposal = propose(entities);
    const h = harness(entities);
    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });
    return { proposal, walls: h.walls() };
  }

  it('κανένα ζεύγος γραμμένων τοίχων δεν μοιράζεται εμβαδό', () => {
    // Τα ορθογώνια του σχεδίου πλακοστρώνουν τον χώρο χωρίς επικάλυψη. Η ένωση επεκτείνει άκρα
    // ως τον άξονα του γείτονα, ο λύτης τα κόβει πίσω στην παρειά: αν το ένα γίνει χωρίς το άλλο,
    // δύο τοίχοι ζωγραφίζονται ο ένας πάνω στον άλλον. Πριν από τη Φ3α-3 αυτό συνέβαινε σε κοντό
    // τοίχο (κόψιμο στο λάθος άκρο) και σε τριπλή ένωση με τον βραχίονα στην απέναντι παρειά.
    const { walls } = written();
    const clips = walls.map(drawn);
    const overlapping: string[] = [];
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const area = multiPolygonArea(safeIntersection(clips[i], clips[j]));
        if (area > 1) overlapping.push(`${i}✕${j}: ${area.toFixed(0)} mm²`);
      }
    }
    expect(walls).toHaveLength(38);
    expect(overlapping).toEqual([]);
  });

  it('το συνολικό εμβαδό των γραμμένων τοίχων ισούται με των ορθογωνίων τους (κανένα κενό)', () => {
    const { proposal, walls } = written();
    const drawnArea = walls.reduce((sum, w) => sum + multiPolygonArea([drawn(w)]), 0);
    const rectArea = proposal.items.filter((i) => i.status === 'ready').reduce((sum, i) => sum + i.rect.area, 0);
    expect(drawnArea).toBeCloseTo(rectArea, 3);
  });

  it('η πρόταση δεν εξαρτάται από τη σειρά των γραμμών του σχεδίου', () => {
    const shape = (w: WallEntity): string => {
      const ends = [w.params.start, w.params.end].map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
      const { startBevel, endBevel, startMiter, endMiter } = w.params;
      const cuts = [startBevel ?? 0, endBevel ?? 0].map((c) => c.toFixed(6)).sort();
      // Έξι δεκαδικά παντού: η σειρά των γραμμών αλλάζει τη σειρά των πράξεων, άρα το 13ο ψηφίο.
      return `${ends.join('→')}|${w.params.thickness.toFixed(6)}|${cuts.join('+')}|${startMiter || endMiter ? 'miter' : 'butt'}`;
    };
    const shapes = (entities: readonly Entity[]): string[] => written(entities).walls.map(shape).sort();

    // Ντετερμινιστικό ανακάτεμα (LCG + Fisher–Yates) — ίδιο σε κάθε εκτέλεση.
    const shuffled = [...ENTITIES];
    let seed = 20261011;
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const reference = shapes(ENTITIES);
    expect(reference).toHaveLength(38);
    expect(shapes([...ENTITIES].reverse())).toEqual(reference);
    expect(shapes(shuffled)).toEqual(reference);
  });
});

describe('ADR-911 Φ2 — ο μονός τοίχος είναι η παρτίδα του ενός', () => {
  it('ο σχεδιασμένος τοίχος είναι πλέον αναιρέσιμος', () => {
    const h = harness([]);
    addWallToScene(wall(0, 0, 3000, 0), h.accessor);
    expect(h.walls()).toHaveLength(1);

    expect(history.undo()).toBe(true);
    expect(h.walls()).toHaveLength(0);
  });
});
