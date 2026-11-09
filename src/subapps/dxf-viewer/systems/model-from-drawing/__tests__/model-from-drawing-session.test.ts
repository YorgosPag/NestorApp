/**
 * ADR-911 Φ3β — άγκυρες της συνεδρίας του βοηθού, πάνω στο ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής.
 *
 *   Α-10  προεπισκόπηση ΒΟΗΘΟΥ ≡ απόδοση: ό,τι φωτίζει ο βοηθός ως «έτοιμο» είναι ΑΚΡΙΒΩΣ το σώμα
 *         που ζωγραφίζει ο πραγματικός αγωγός απόδοσης πάνω στη γραμμένη σκηνή. Η Α-3 το δένει
 *         για τη διαδρομή πλήρωσης· αυτή για τη διαδρομή δείγμα → πρόταση → έγκριση.
 *   +     μερική έγκριση: γράφονται ΜΟΝΟ οι τοίχοι των επιβεβαιωμένων ομάδων πάχους (Δ3, ADR-929 Φ5.2ε).
 *   +     μπαγιάτικη σκηνή ⇒ καμία εγγραφή, νέα προεπισκόπηση.
 *   +     άρνηση = τίποτα γραμμένο, λόγος ορατός.
 *   Α-6   μετά την έγκριση ο βοηθός προτείνει ΜΗΔΕΝ νέους τοίχους.
 */

import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { DxfEntityUnion, DxfWall } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { applyWallColumnCutback2D } from '../../../hooks/canvas/dxf-scene-wall-cutback';
import { applyWallWallCrossCutback2D } from '../../../hooks/canvas/dxf-scene-wall-wall-cutback';
import { buildWallFootprintRing } from '../../../bim/geometry/wall-geometry';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import * as wallWrite from '../../../bim/walls/add-wall-to-scene';
import { countProposalByStatus } from '../../../bim/model-from-drawing/assistant-preview';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from '../model-from-drawing-session';
import {
  captureModelFromDrawingSample,
  isModelFromDrawingPicking,
  modelFromDrawingStore,
} from '../model-from-drawing-store';
import {
  BY_LAYER_ENTITIES,
  confirmAllGroups,
  ENTITIES,
  FIXTURE_LAYERS,
  harness,
  NOWHERE,
  ON_WALL_LINE,
  sample,
  WALL_HEX,
  WALL_LINE,
} from './model-from-drawing-harness';

// Η ΠΡΑΓΜΑΤΙΚΗ εγγραφή, τυλιγμένη ώστε να μετριέται και — σε ΕΝΑ test — να αρνείται.
jest.mock('../../../bim/walls/add-wall-to-scene', () => {
  const actual = jest.requireActual('../../../bim/walls/add-wall-to-scene');
  return { ...actual, addWallsToScene: jest.fn(actual.addWallsToScene) };
});
const addWallsToScene = wallWrite.addWallsToScene as jest.MockedFunction<typeof wallWrite.addWallsToScene>;

const state = () => modelFromDrawingStore.get();
const counts = () => countProposalByStatus(state().proposal!);
/** Το fixture αμέσως μετά το δείγμα: 38 έτοιμα ορθογώνια σε ανεπιβεβαίωτες ομάδες + 2 αμφίσημα. */
const BEFORE_CONFIRMATION = { ready: 0, unconfirmed: 38, 'needs-decision': 2, existing: 0, rejected: 0 } as const;
const readyPieces = (): Point2D[][][] =>
  (state().preview?.zones ?? []).filter((z) => z.status === 'ready').map((z) => z.pieces);

/** Το σώμα κάθε τοίχου ΟΠΩΣ ΤΟ ΠΑΙΡΝΕΙ Ο `WallRenderer` — ο ίδιος κριτής με την Α-3. */
function paintedBodies(entities: readonly Entity[]): Point2D[][][] {
  const rendered = applyWallWallCrossCutback2D(applyWallColumnCutback2D([...entities] as unknown as DxfEntityUnion[]));
  return rendered
    .filter((e): e is DxfWall => e.type === 'wall')
    .map((w) => (w.geometry.displayFootprint
      ? w.geometry.displayFootprint.map((r) => [...r])
      : [buildWallFootprintRing(w.geometry.outerEdge.points, w.geometry.innerEdge.points)]));
}

function columnAt(id: string, c: Point2D, half: number): Entity {
  const vertices = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: c.x + sx * half, y: c.y + sy * half, z: 0 }));
  return { id, type: 'column', geometry: { footprint: { vertices } } } as unknown as Entity;
}

const axisLength = (w: WallEntity): number =>
  Math.hypot(w.params.end.x - w.params.start.x, w.params.end.y - w.params.start.y);

const history = getGlobalCommandHistory();

beforeEach(() => {
  history.clear();
  modelFromDrawingStore.reset();
  addWallsToScene.mockClear();
});

describe('ADR-911 Δ1 — το δείγμα', () => {
  it('κλικ σε γραμμή τοίχου ⇒ το αποδιδόμενο χρώμα της γίνεται ρόλος και βγαίνει πρόταση', () => {
    const h = harness();
    sample(h);
    expect(state().phase).toBe('review');
    expect(state().wallColorHex).toBe(WALL_HEX);
    expect(state().proposal?.items).toHaveLength(40);
    // ADR-929 Φ5.2ε: πριν από κάθε επιβεβαίωση ομάδας κανένας τοίχος δεν είναι «έτοιμος» (= θα γραφτεί).
    expect(counts()).toEqual(BEFORE_CONFIRMATION);
    expect(state().pendingSample).toBeNull();
    expect(state().notice).toBeNull();
  });

  it('ρητό χρώμα ΜΕ στρώσεις στο χέρι δίνει την ίδια πρόταση (κλάδος «Concrete» του καταρράκτη)', () => {
    // ⚠️ Αυτό το test ΔΕΝ αποδεικνύει ότι οι στρώσεις διαβάζονται: το fixture γράφει ρητό `color`
    // ίδιο με της στρώσης, άρα περνά και με `layersById = {}`. Το ByLayer το δένει το επόμενο.
    const h = harness(ENTITIES, FIXTURE_LAYERS);
    sample(h);
    expect(Object.keys(FIXTURE_LAYERS)).toHaveLength(4);
    expect(state().wallColorHex).toBe(WALL_HEX);
    expect(state().proposal?.items).toHaveLength(40);
    expect(state().proposal?.coverage.ignoredCount).toBe(362);
  });

  it('ByLayer: γραμμές ΧΩΡΙΣ δικό τους χρώμα παίρνουν ρόλο ΜΟΝΟ από τη στρώση τους', () => {
    // Το πραγματικό DXF γράφει σπάνια χρώμα στη γραμμή· το κρατά η στρώση. Εδώ ο ΜΟΝΟΣ φορέας
    // του χρώματος είναι το `layersById` — και στο δείγμα και στο άπλωμα του ρόλου.
    expect(BY_LAYER_ENTITIES.some((e) => 'color' in e)).toBe(false);
    const h = harness(BY_LAYER_ENTITIES, FIXTURE_LAYERS);
    sample(h);
    expect(state().wallColorHex).toBe(WALL_HEX);
    expect(state().proposal?.items).toHaveLength(40);
    expect(counts()).toEqual(BEFORE_CONFIRMATION);
    expect(state().proposal?.coverage.ignoredCount).toBe(362);
  });

  it('ByLayer χωρίς τη στρώση: ο βοηθός λέει «χωρίς χρώμα» και μένει οπλισμένος — δεν μαντεύει', () => {
    // Ο μάρτυρας του προηγούμενου: οι ίδιες γραμμές, χωρίς στρώσεις, ΔΕΝ έχουν από πού να πάρουν χρώμα.
    const h = harness(BY_LAYER_ENTITIES, {});
    sample(h);
    expect(state().notice).toEqual({ kind: 'no-color' });
    expect(state().phase).toBe('picking');
    expect(state().proposal).toBeNull();
  });

  it('κλικ στο κενό ⇒ ο βοηθός ΜΕΝΕΙ οπλισμένος και το λέει', () => {
    const h = harness();
    sample(h, NOWHERE);
    expect(state().phase).toBe('picking');
    expect(isModelFromDrawingPicking()).toBe(true);
    expect(state().notice).toEqual({ kind: 'no-line' });
    expect(state().proposal).toBeNull();
  });

  it('κλειστός βοηθός δεν κρατά κλικ του καμβά', () => {
    captureModelFromDrawingSample(ON_WALL_LINE);
    expect(state().pendingSample).toBeNull();
    expect(isModelFromDrawingPicking()).toBe(false);
  });

  it('νέο δείγμα σβήνει τις αποφάσεις του προηγούμενου', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    expect(state().categoryByThicknessMm.size).toBeGreaterThan(0);
    sample(h);
    expect(state().categoryByThicknessMm.size).toBe(0);
    expect(state().proposal?.groups.every((g) => !g.confirmed)).toBe(true);
  });
});

describe('ADR-911 Δ3 / Δ7 — οι αποφάσεις του ανθρώπου', () => {
  it('μερική έγκριση: γράφονται ΜΟΝΟ οι τοίχοι των επιβεβαιωμένων ομάδων (ADR-929 Φ5.2ε)', () => {
    const h = harness();
    sample(h);
    const [left, ...rest] = state().proposal!.groups;
    rest.forEach((g) => modelFromDrawingSession.confirmGroup(g.thicknessMm, g.suggestedCategory, h.deps));
    const shown = state().proposal!;
    const leftKeys = new Set(left.keys);
    expect(shown.walls.length).toBeGreaterThan(0);
    expect(shown.items.filter((i) => leftKeys.has(i.key)).some((i) => i.status === 'ready')).toBe(false);

    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);

    expect(h.walls()).toHaveLength(shown.walls.length);
    expect(h.walls().every((w) => Math.round(w.params.thickness) !== left.thicknessMm)).toBe(true);
    expect(state().notice).toMatchObject({ kind: 'written', count: shown.walls.length });
  });

  it('χωρίς καμία επιβεβαίωση: τίποτα δεν γράφεται, και το λέει', () => {
    const h = harness();
    sample(h);
    expect(state().proposal!.walls).toHaveLength(0);

    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);

    expect(h.walls()).toHaveLength(0);
    expect(state().notice).toMatchObject({ kind: 'refused', refusal: 'nothing-to-write' });
  });

  it('η επιλογή του ανθρώπου φτάνει στους τοίχους της ομάδας', () => {
    const h = harness();
    sample(h);
    const thinnest = state().proposal!.groups[0];
    modelFromDrawingSession.confirmGroup(thinnest.thicknessMm, 'partition', h.deps);
    const group = state().proposal!.groups[0];
    expect(group).toMatchObject({ confirmed: true, category: 'partition' });
    const keys = new Set(group.keys);
    const walls = state().proposal!.items.filter((i) => keys.has(i.key) && i.wall).map((i) => i.wall!.params.category);
    expect(walls.length).toBeGreaterThan(0);
    expect(new Set(walls)).toEqual(new Set(['partition']));
  });

  it('αμφίσημο ορθογώνιο γίνεται τοίχος ΜΟΝΟ όταν το πει ο άνθρωπος, και ξεγίνεται', () => {
    const h = harness();
    sample(h);
    const undecided = state().proposal!.items.find((i) => i.status === 'needs-decision')!;
    modelFromDrawingSession.setUndecided(undecided.key, true, h.deps);
    expect(counts()['needs-decision']).toBe(1);
    expect(state().proposal!.items.find((i) => i.key === undecided.key)?.status).not.toBe('needs-decision');
    modelFromDrawingSession.setUndecided(undecided.key, false, h.deps);
    expect(counts()).toEqual(BEFORE_CONFIRMATION);
  });

  it('η εστίαση δεν αγγίζει πρόταση ούτε αποφάσεις', () => {
    const h = harness();
    sample(h);
    const before = state();
    modelFromDrawingSession.focus(before.proposal!.items[3].key);
    expect(state().focusedKey).toBe(before.proposal!.items[3].key);
    expect(state().proposal).toBe(before.proposal);
    expect(state().preview).toBe(before.preview);
    expect(state().acceptedDecisions).toBe(before.acceptedDecisions);
  });
});

describe('ADR-911 Α-10 — προεπισκόπηση βοηθού ≡ απόδοση', () => {
  it('ό,τι φωτίστηκε «έτοιμο» είναι ΑΚΡΙΒΩΣ το σώμα που ζωγραφίζεται μετά την έγκριση', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    const lit = readyPieces();

    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);

    expect(lit).toHaveLength(38);
    expect(h.walls()).toHaveLength(38);
    expect(lit).toEqual(paintedBodies(h.entities()));
  });

  it('με κολώνες: άκρο μέσα σε κολώνα και κολώνα στη μέση φωτίζονται όπως ζωγραφίζονται', () => {
    const probe = harness();
    sample(probe);
    confirmAllGroups(probe);
    const baseWalls = state().proposal!.walls;
    const longest = [...baseWalls].sort((a, b) => axisLength(b) - axisLength(a))[0];
    const mid = { x: (longest.params.start.x + longest.params.end.x) / 2, y: (longest.params.start.y + longest.params.end.y) / 2 };
    const other = baseWalls.find((w) => w.id !== longest.id && axisLength(w) > 1500) as WallEntity;
    const h = harness([...ENTITIES, columnAt('col_mid', mid, 200), columnAt('col_end', other.params.start, 200)]);

    sample(h);
    confirmAllGroups(h);
    const lit = readyPieces();
    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);

    expect(lit).toEqual(paintedBodies(h.entities()));
    // Δεν είναι κενή: τουλάχιστον ένας τοίχος φωτίστηκε σε ΔΥΟ κομμάτια.
    expect(lit.some((pieces) => pieces.length === 2)).toBe(true);
  });

  it('ό,τι ΔΕΝ είναι έτοιμο φωτίζεται ως το ανιχνευμένο ορθογώνιό του, με την κατάστασή του', () => {
    const h = harness();
    sample(h);
    const { proposal, preview } = state();
    expect(preview!.zones.map((z) => [z.key, z.status])).toEqual(proposal!.items.map((i) => [i.key, i.status]));
    for (const zone of preview!.zones.filter((z) => z.status !== 'ready')) {
      const item = proposal!.items.find((i) => i.key === zone.key)!;
      expect(zone.pieces).toEqual([item.rect.polygon.map((p) => ({ x: p.x, y: p.y }))]);
    }
  });
});

describe('ADR-911 Φ3β — η ΜΙΑ έγκριση', () => {
  it('γράφει όλη την πρόταση ως παρτίδα «όλα ή τίποτα», σε ΕΝΑ βήμα undo, αφού αποθηκεύσει τους τύπους', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    const approved = state().proposal!.walls;

    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);

    expect(addWallsToScene).toHaveBeenCalledTimes(1);
    expect(addWallsToScene.mock.calls[0][2]).toEqual({ origin: 'bulk', onOverlap: 'refuse', undoName: 'undo-name' });
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect((h.commit.mock.calls[0][0] as WallEntity[]).map((w) => w.params)).toEqual(approved.map((w) => w.params));
    expect(h.commit.mock.invocationCallOrder[0]).toBeLessThan(addWallsToScene.mock.invocationCallOrder[0]);
    expect(h.walls().every((w) => Boolean(w.typeId))).toBe(true);
    expect(state().notice).toMatchObject({ kind: 'written', count: 38 });

    history.undo();
    expect(h.walls()).toHaveLength(0);
  });

  it('Α-6: μετά την έγκριση ο βοηθός προτείνει μηδέν νέους τοίχους, και δεύτερη έγκριση δεν γράφει', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    modelFromDrawingSession.approve(h.deps);

    expect(counts()).toEqual({ ready: 0, unconfirmed: 0, 'needs-decision': 2, existing: 38, rejected: 0 });
    expect(state().proposal!.walls).toHaveLength(0);

    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);
    expect(h.walls()).toHaveLength(38);
    expect(state().notice).toMatchObject({ kind: 'refused', refusal: 'nothing-to-write' });
  });

  it('μπαγιάτικη σκηνή: αν το σχέδιο άλλαξε μετά τον φωτισμό, ΔΕΝ γράφεται τίποτα και η προεπισκόπηση ανανεώνεται', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    const shown = state().proposal!;
    // Στο μεταξύ κάποιος έσβησε μία γραμμή τοίχου: η πρόταση που φωτίστηκε δεν ισχύει πια.
    h.setEntities(h.entities().filter((e) => e.id !== (WALL_LINE as unknown as Entity).id));

    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);

    expect(state().notice).toEqual({ kind: 'stale' });
    expect(h.walls()).toHaveLength(0);
    expect(addWallsToScene).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
    expect(state().proposal).not.toBe(shown);
    expect(state().proposal!.items.length).toBeLessThan(shown.items.length);

    // Ο άνθρωπος βλέπει τη νέα προεπισκόπηση και εγκρίνει ΑΥΤΗΝ.
    const lit = readyPieces();
    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);
    expect(lit).toEqual(paintedBodies(h.entities()));
  });

  it('άρνηση της εγγραφής: τίποτα γραμμένο, ο λόγος και το πλήθος φαίνονται, η πρόταση μένει', () => {
    const h = harness();
    sample(h);
    confirmAllGroups(h);
    const shown = state().proposal;
    addWallsToScene.mockReturnValueOnce({ written: [], blocked: 3, retrimmedNeighbours: 0, refusal: 'overlap' });

    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);

    expect(state().notice).toEqual({ kind: 'refused', refusal: 'overlap', blocked: 3 });
    expect(h.walls()).toHaveLength(0);
    expect(state().phase).toBe('review');
    expect(state().proposal?.walls).toHaveLength(shown!.walls.length);
  });

  it('χωρίς ενεργή σκηνή ο βοηθός το λέει αντί να σιωπά', () => {
    const h = harness();
    const noScene: ModelFromDrawingDeps = { ...h.deps, accessor: { ...h.deps.accessor, currentLevelId: null } };
    modelFromDrawingSession.open();
    captureModelFromDrawingSample(ON_WALL_LINE);
    modelFromDrawingSession.adoptSample(noScene);
    expect(state().notice).toEqual({ kind: 'no-scene' });
    expect(state().phase).toBe('picking');
  });

  it('Φ4-3β — refresh χωρίς πρόταση τοίχων (συνεδρία «μόνο κουφώματα») δεν αγγίζει τίποτα', () => {
    const h = harness();
    modelFromDrawingSession.open();
    // Ο έλεγχος μπορεί να αφορά ΜΟΝΟ ανοίγματα: τότε δεν υπάρχει δείγμα τοίχου να ξαναϋπολογιστεί,
    // και μια αλλαγή επιπέδου δεν πρέπει να γράψει ψεύτικο «δεν υπάρχει ενεργό σχέδιο».
    modelFromDrawingStore.patch({ phase: 'review' });
    const before = state();

    modelFromDrawingSession.refresh(h.deps);

    expect(state()).toBe(before);
  });

  it('Φ4-3β — refresh με `keepNotice` κρατά ό,τι είπε ο ελεγκτής ανοιγμάτων· χωρίς, το σβήνει', () => {
    const h = harness();
    sample(h, ON_WALL_LINE);
    const written = { kind: 'openings-written', count: 12 } as const;

    modelFromDrawingStore.patch({ notice: written });
    modelFromDrawingSession.refresh(h.deps, true);
    expect(state().notice).toEqual(written);

    modelFromDrawingSession.refresh(h.deps);
    expect(state().notice).toBeNull();
  });
});
