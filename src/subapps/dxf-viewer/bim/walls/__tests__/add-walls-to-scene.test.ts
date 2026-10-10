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

import type { Entity } from '../../../types/entities';
import { isWallEntity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../types/wall-types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { EventBus } from '../../../systems/events/EventBus';
import { isInteractiveEntityCreation } from '../../../systems/events/bim-entity-lifecycle-events';
import type { EntityCreatedOrigin } from '../../../systems/events/drawing-event-map';
import { projectVerticesTo2D } from '../../geometry/shared/polygon-utils';
import { wallFootprintPolygon } from '../../finishes/wall-footprint-union';
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

  it('το αποτύπωμα κάθε γραμμένου τοίχου είναι ΑΚΡΙΒΩΣ αυτό που φωτίστηκε', () => {
    const proposal = propose();
    const preview = computeFillingWallFootprints(proposal.walls, ENTITIES);
    const h = harness();

    addWallsToScene(proposal.walls, h.accessor, { origin: 'bulk', onOverlap: 'refuse' });

    const written = h.walls().map((w) => projectVerticesTo2D(wallFootprintPolygon(w)));
    expect(written).toEqual(preview);
    // Η άγκυρα δεν είναι κενή: οι ενώσεις ΑΛΛΑΖΟΥΝ πραγματικά αποτυπώματα σε αυτό το σχέδιο.
    const raw = proposal.walls.map((w) => projectVerticesTo2D(wallFootprintPolygon(w)));
    expect(written).not.toEqual(raw);
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

describe('ADR-911 Φ2 — ο μονός τοίχος είναι η παρτίδα του ενός', () => {
  it('ο σχεδιασμένος τοίχος είναι πλέον αναιρέσιμος', () => {
    const h = harness([]);
    addWallToScene(wall(0, 0, 3000, 0), h.accessor);
    expect(h.walls()).toHaveLength(1);

    expect(history.undo()).toBe(true);
    expect(h.walls()).toHaveLength(0);
  });
});
