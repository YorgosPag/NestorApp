/**
 * ADR-911 Φ4-3β — άγκυρες του ελεγκτή ανοιγμάτων, πάνω στο ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής με τους 40
 * τοίχους της Φ3 γραμμένους.
 *
 *   Α-10  προεπισκόπηση ≡ εγγραφή για ΑΝΟΙΓΜΑΤΑ: ό,τι φωτίζεται ως «θα γραφτεί» είναι ΑΚΡΙΒΩΣ το
 *         περίγραμμα του ανοίγματος που βρίσκεται στη σκηνή μετά την έγκριση — κριτής η γραμμένη
 *         σκηνή, όχι η συνάρτηση της προεπισκόπησης ξανά.
 *   +     δεύτερο δείγμα (ρόλος «κούφωμα») που πιάνει ΚΑΙ τόξο, χωρίς να αγγίζει τον ρόλο «τοίχος».
 *   +     απαντήσεις ανθρώπου: πόρτα / παράθυρο γράφονται· «τίποτα» και «αναποφάσιστο» όχι.
 *   +     μπαγιάτικη σκηνή ⇒ καμία εγγραφή, νέα προεπισκόπηση.
 *   +     ΜΙΑ έγκριση = ΕΝΑ undo· δεύτερη έγκριση = καμία εγγραφή (ιδεμποτία).
 */

import type { ArcEntity, Entity } from '../../../types/entities';
import { isArcEntity, isLineEntity, isOpeningEntity, isWallEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { WallEntity } from '../../../bim/types/wall-types';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { extractLineSegments, pickSegmentAt } from '../../../bim/walls/wall-in-region';
import * as openingWrite from '../../../bim/model-from-drawing/add-openings-to-scene';
import { countOpeningsByStatus } from '../../../bim/model-from-drawing/opening-proposal';
import { countOpeningReview } from '../../../bim/model-from-drawing/opening-review';
import {
  ENTITIES, OPENING, WALL, colorOf, liveScene, sceneOf, writtenWalls, type LiveScene,
} from '../../../bim/model-from-drawing/__tests__/opening-fixture';
import { modelFromDrawingSession } from '../model-from-drawing-session';
import {
  modelFromDrawingOpeningsSession as openings,
  type OpeningSessionDeps,
} from '../model-from-drawing-openings-session';
import { captureModelFromDrawingSample, modelFromDrawingStore } from '../model-from-drawing-store';

// Η ΠΡΑΓΜΑΤΙΚΗ εγγραφή, τυλιγμένη ώστε να μετριέται και — σε ΕΝΑ test — να αρνείται.
jest.mock('../../../bim/model-from-drawing/add-openings-to-scene', () => {
  const actual = jest.requireActual('../../../bim/model-from-drawing/add-openings-to-scene');
  return { ...actual, addOpeningsToScene: jest.fn(actual.addOpeningsToScene) };
});
const addOpeningsToScene = openingWrite.addOpeningsToScene as jest.MockedFunction<typeof openingWrite.addOpeningsToScene>;

const history = getGlobalCommandHistory();
const state = () => modelFromDrawingStore.get();
const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const midOf = (line: { start: Point2D; end: Point2D }): Point2D =>
  ({ x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 });

const OPENING_LINE = ENTITIES.filter(isLineEntity).find((e) => colorOf(e) === OPENING)!;
const OPENING_ARC = ENTITIES.filter(isArcEntity).find((e) => colorOf(e) === OPENING) as ArcEntity;
const WALL_LINE = ENTITIES.filter(isLineEntity).find((e) => colorOf(e) === WALL)!;
const ON_OPENING_LINE = midOf(OPENING_LINE);
/**
 * Σημείο στη ΜΕΣΗ του τόξου — όχι στα άκρα του, όπου ακουμπούν οι ευθείες του φύλλου και της κάσας
 * (εκεί το δείγμα θα έπιανε γραμμή και το test θα περνούσε χωρίς να δειγματιστεί ποτέ τόξο).
 */
const ARC_SAMPLES = extractLineSegments([OPENING_ARC], { tessellateCurves: true });
const ON_OPENING_ARC: Point2D = ARC_SAMPLES[Math.floor(ARC_SAMPLES.length / 2)].start;
const NOWHERE: Point2D = { x: -9e6, y: -9e6 };

interface Harness {
  readonly live: LiveScene;
  readonly deps: OpeningSessionDeps;
  readonly setEntities: (next: readonly Entity[]) => void;
}

/** Η σκηνή όπως την αφήνει η Φ3: το σχέδιο + οι 40 τοίχοι. */
function harness(initial: readonly Entity[] = sceneOf(writtenWalls(true))): Harness {
  const live = liveScene(initial);
  const deps: OpeningSessionDeps = { accessor: live.accessor, layersById: {}, pickTolerance: 5, undoName: 'openings-undo' };
  const setEntities = (next: readonly Entity[]): void => {
    live.accessor.setLevelScene(live.accessor.currentLevelId!, { units: 'mm', entities: [...next] } as never);
  };
  return { live, deps, setEntities };
}

/** Άνοιγμα βοηθού → οπλισμός για «κούφωμα» → κλικ στο `point`. */
function sampleOpening(h: Harness, point: Point2D = ON_OPENING_LINE): void {
  modelFromDrawingSession.open();
  openings.armSample();
  captureModelFromDrawingSample(point);
  openings.adoptSample(h.deps);
}

const openingsIn = (h: Harness) => h.live.entities().filter(isOpeningEntity);
const wallsIn = (h: Harness): WallEntity[] => h.live.entities().filter(isWallEntity);
const gapKeys = (): string[] => state().openingProposal!.items.filter((i) => i.symbol === 'none').map((i) => i.key);

beforeEach(() => {
  history.clear();
  modelFromDrawingStore.reset();
  addOpeningsToScene.mockClear();
});

describe('ADR-911 Φ4-3β — δεύτερο δείγμα: ο ρόλος «κούφωμα»', () => {
  it('ο οπλισμός για «κούφωμα» κρατά ό,τι υπάρχει για τους τοίχους', () => {
    modelFromDrawingSession.open();
    modelFromDrawingStore.patch({ phase: 'review', wallColorHex: WALL });

    openings.armSample();

    expect(state().phase).toBe('picking');
    expect(state().sampleRole).toBe('opening');
    expect(state().wallColorHex).toBe(WALL);
  });

  it('κλειστός βοηθός δεν οπλίζεται από το δεύτερο βήμα', () => {
    openings.armSample();
    expect(state().phase).toBe('closed');
  });

  it('κλικ σε γραμμή κουφώματος ⇒ πρόταση με 6 πόρτες, 6 παράθυρα και 2 κενά προς απόφαση', () => {
    const h = harness();
    sampleOpening(h);

    expect(state().phase).toBe('review');
    expect(state().sampleRole).toBe('wall');
    expect(state().openingColorHex).toBe(OPENING);
    expect(countOpeningsByStatus(state().openingProposal!)).toEqual({ door: 6, window: 6, 'needs-decision': 2, existing: 0 });
    expect(state().notice).toBeNull();
  });

  it('το δείγμα πιάνει και ΤΟΞΟ — το φύλλο μιας πόρτας είναι σύμβολο κουφώματος', () => {
    const h = harness();
    // Μάρτυρας: καμία ΕΥΘΕΙΑ του σχεδίου δεν περνά από αυτό το σημείο — αν πιαστεί, πιάστηκε τόξο.
    expect(pickSegmentAt(ON_OPENING_ARC, extractLineSegments(h.live.entities()), h.deps.pickTolerance)).toBeNull();
    sampleOpening(h, ON_OPENING_ARC);

    expect(state().openingColorHex).toBe(OPENING);
    expect(state().phase).toBe('review');
  });

  it('κλικ στο κενό ⇒ ειδοποίηση, ο βοηθός ΜΕΝΕΙ οπλισμένος για «κούφωμα»', () => {
    const h = harness();
    sampleOpening(h, NOWHERE);

    expect(state().notice).toEqual({ kind: 'no-line' });
    expect(state().phase).toBe('picking');
    expect(state().sampleRole).toBe('opening');
    expect(state().openingProposal).toBeNull();
  });

  it('σχέδιο χωρίς κανέναν τοίχο ⇒ «no-walls», καμία πρόταση', () => {
    const h = harness(ENTITIES);
    sampleOpening(h);

    expect(state().notice).toEqual({ kind: 'no-walls' });
    expect(state().openingProposal).toBeNull();
    expect(state().phase).toBe('picking');
  });

  it('ένα κλικ ⇒ ΕΝΑΣ ρόλος: ο ελεγκτής τοίχων δεν υιοθετεί δείγμα «κούφωμα», ούτε το αντίστροφο', () => {
    const h = harness();
    modelFromDrawingSession.open();
    captureModelFromDrawingSample(midOf(WALL_LINE));
    openings.adoptSample(h.deps);
    expect(state().pendingSample).not.toBeNull();
    expect(state().openingColorHex).toBeNull();

    openings.armSample();
    captureModelFromDrawingSample(ON_OPENING_LINE);
    modelFromDrawingSession.adoptSample({ ...h.deps, typing: { typeWall: (w) => w, commit: jest.fn() } });
    expect(state().pendingSample).not.toBeNull();
    expect(state().wallColorHex).toBeNull();
  });
});

describe('ADR-911 Φ4-3β — ακύρωση του δείγματος «κούφωμα»', () => {
  it('με πρόταση προς έλεγχο ⇒ πίσω στον έλεγχο, τίποτα δεν χάνεται', () => {
    const h = harness();
    sampleOpening(h);
    const before = state().openingProposal;

    openings.armSample();
    expect(openings.cancelSample()).toBe(true);

    expect(state().phase).toBe('review');
    expect(state().sampleRole).toBe('wall');
    expect(state().openingProposal).toBe(before);
  });

  it('χωρίς καμία πρόταση ⇒ πίσω στο δείγμα «τοίχος»', () => {
    modelFromDrawingSession.open();
    openings.armSample();

    expect(openings.cancelSample()).toBe(true);
    expect(state().phase).toBe('picking');
    expect(state().sampleRole).toBe('wall');
  });

  it('δεν είναι δική του η ακύρωση όταν ο βοηθός περιμένει δείγμα τοίχου', () => {
    modelFromDrawingSession.open();
    expect(openings.cancelSample()).toBe(false);
    expect(state().phase).toBe('picking');
  });
});

describe('ADR-911 Φ4-3β — απαντήσεις ανθρώπου', () => {
  it('«πόρτα» σε κενό ⇒ γίνεται εγγράψιμο και φωτίζεται ως πόρτα· «αναποφάσιστο ξανά» το επιστρέφει', () => {
    const h = harness();
    sampleOpening(h);
    const [gap] = gapKeys();

    openings.choose([gap], 'door', h.deps);
    const decided = state().openingProposal!.items.find((i) => i.key === gap)!;
    expect(decided.status).toBe('door');
    expect(decided.decided).toBe(true);
    expect(state().openingPreview!.zones.find((z) => z.key === gap)!.status).toBe('door');
    expect(countOpeningReview(state().openingProposal!, state().openingChoices).writable).toBe(13);

    openings.choose([gap], null, h.deps);
    expect(state().openingProposal!.items.find((i) => i.key === gap)!.status).toBe('needs-decision');
    expect(state().openingChoices.has(gap)).toBe(false);
  });

  it('«τίποτα» δεν γράφει: το στοιχείο μένει «προς απόφαση», σημειωμένο ως ιδωμένο', () => {
    const h = harness();
    sampleOpening(h);
    const [gap] = gapKeys();

    openings.choose([gap], 'none', h.deps);

    expect(state().openingProposal!.items.find((i) => i.key === gap)!.status).toBe('needs-decision');
    expect(state().openingPreview!.zones.find((z) => z.key === gap)!.dismissed).toBe(true);
    expect(countOpeningReview(state().openingProposal!, state().openingChoices))
      .toEqual({ writable: 12, undecided: 1, dismissed: 1, blocked: 0 });
  });

  it('μία απάντηση σε πολλά κλειδιά τα αλλάζει όλα μαζί', () => {
    const h = harness();
    sampleOpening(h);
    const gaps = gapKeys();

    openings.choose(gaps, 'window', h.deps);

    expect(countOpeningsByStatus(state().openingProposal!)).toEqual({ door: 6, window: 8, 'needs-decision': 0, existing: 0 });
  });

  it('κλειδί που δεν δέχεται απάντηση αγνοείται — ούτε ως ψεύτικο «το είδα»', () => {
    const h = harness();
    sampleOpening(h);
    const door = state().openingProposal!.items.find((i) => i.status === 'door')!;

    openings.choose([door.key, 'no-such-key'], 'none', h.deps);

    expect(state().openingChoices.size).toBe(0);
  });

  it('νέο δείγμα ⇒ καμία παλιά απάντηση', () => {
    const h = harness();
    sampleOpening(h);
    openings.choose(gapKeys(), 'none', h.deps);

    openings.armSample();
    captureModelFromDrawingSample(ON_OPENING_LINE);
    openings.adoptSample(h.deps);

    expect(state().openingChoices.size).toBe(0);
  });
});

describe('ADR-911 Α-10 για ανοίγματα — ό,τι φωτίστηκε είναι ό,τι γράφτηκε', () => {
  it('κάθε ζώνη «θα γραφτεί» είναι ΑΚΡΙΒΩΣ το περίγραμμα ενός ανοίγματος της γραμμένης σκηνής', () => {
    const h = harness();
    sampleOpening(h);
    const lit = state().openingPreview!.zones.filter((z) => z.status === 'door' || z.status === 'window');

    expect(openings.approve(h.deps)).toBe(true);

    const written = openingsIn(h).map((o) => stored(o.geometry!.outline.vertices.map((v) => ({ x: v.x, y: v.y }))));
    expect(written).toHaveLength(12);
    expect(lit).toHaveLength(12);
    for (const zone of lit) {
      expect(zone.pieces).toHaveLength(1);
      expect(written).toContainEqual(stored(zone.pieces[0]));
    }
  });

  it('τα «προς απόφαση» φωτίζονται ως λωρίδα του κενού και ΔΕΝ γράφονται', () => {
    const h = harness();
    sampleOpening(h);
    const pending = state().openingPreview!.zones.filter((z) => z.status === 'needs-decision');

    expect(pending).toHaveLength(2);
    for (const zone of pending) {
      expect(zone.pieces).toHaveLength(1);
      expect(zone.pieces[0]).toHaveLength(4);
      expect(zone.occupied).toBe(true);
      expect(zone.reason).toBe('no-symbol');
    }
    expect(state().openingPreview!.occupants.length).toBeGreaterThan(0);

    openings.approve(h.deps);
    expect(openingsIn(h)).toHaveLength(12);
  });

  it('η λωρίδα ενός κενού έχει το πλάτος του κενού και το πάχος του ξενιστή', () => {
    const h = harness();
    sampleOpening(h);
    const item = state().openingProposal!.items.find((i) => i.symbol === 'none')!;
    const [a, b, c] = state().openingPreview!.zones.find((z) => z.key === item.key)!.pieces[0];
    const host = wallsIn(h).find((w) => item.host?.kind === 'bridge' && w.id === item.host.wallIds[0])!;

    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(item.widthMm!, 6);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(host.params.thickness, 6);
  });
});

describe('ADR-911 Φ4-3β — η ΜΙΑ έγκριση', () => {
  it('αναποφάσιστα δεν κλειδώνουν: γράφονται τα 12, ΕΝΑ undo τα παίρνει όλα πίσω', () => {
    const h = harness();
    // Η αναίρεση επιστρέφει τις ΙΔΙΕΣ οντότητες· η σειρά τους στη σκηνή δεν είναι μέρος της υπόσχεσης.
    const byId = (): Entity[] => [...stored(h.live.entities())].sort((a, b) => a.id.localeCompare(b.id));
    const before = byId();
    sampleOpening(h);

    expect(openings.approve(h.deps)).toBe(true);
    expect(addOpeningsToScene).toHaveBeenCalledTimes(1);
    expect(addOpeningsToScene.mock.calls[0][2]).toEqual({ undoName: 'openings-undo' });
    expect(state().notice).toEqual({ kind: 'openings-written', count: 12 });

    history.undo();
    expect(byId()).toEqual(before);
    expect(history.canUndo()).toBe(false);
  });

  it('μετά την έγκριση όλα «υπάρχουν ήδη» και δεύτερη έγκριση δεν γράφει τίποτα', () => {
    const h = harness();
    sampleOpening(h);
    openings.approve(h.deps);
    const after = stored(h.live.entities());

    expect(countOpeningsByStatus(state().openingProposal!).existing).toBe(12);
    expect(countOpeningReview(state().openingProposal!, state().openingChoices).writable).toBe(0);
    expect(state().openingPreview!.zones.filter((z) => z.status === 'existing').every((z) => z.pieces.length === 1)).toBe(true);

    expect(openings.approve(h.deps)).toBe(false);
    expect(state().notice).toEqual({ kind: 'openings-refused', refusal: 'nothing-to-write' });
    expect(stored(h.live.entities())).toEqual(after);
  });

  it('μπαγιάτικη σκηνή (έφυγε ξενιστής) ⇒ καμία εγγραφή, νέα προεπισκόπηση, ειδοποίηση', () => {
    const h = harness();
    sampleOpening(h);
    const shown = state().openingProposal;
    const hostId = shown!.items.find((i) => i.status === 'window' && i.host?.kind === 'existing-wall')!.host as { wallId: string };
    h.setEntities(h.live.entities().filter((e) => e.id !== hostId.wallId));

    expect(openings.approve(h.deps)).toBe(false);

    expect(addOpeningsToScene).not.toHaveBeenCalled();
    expect(openingsIn(h)).toHaveLength(0);
    expect(state().notice).toEqual({ kind: 'stale' });
    expect(state().openingProposal).not.toBe(shown);
  });

  it('μπαγιάτικη σκηνή (άλλαξε ΜΟΝΟ το πάχος ξενιστή) ⇒ το αποτύπωμα το βλέπει από ό,τι φωτίστηκε', () => {
    const h = harness();
    sampleOpening(h);
    const shown = state().openingProposal!;
    // ΚΑΙ οι δύο τοίχοι της γέφυρας: αν παχύνει μόνο ο ένας, η γέφυρα παύει να στέκει και το κενό
    // φεύγει από την πρόταση — τότε «μπαγιάτικο» θα έλεγε και αποτύπωμα που δεν κοιτά τις ζώνες.
    const hostIds: readonly string[] = (shown.items.find((i) => i.symbol === 'none')!.host as { wallIds: readonly [string, string] }).wallIds;
    h.setEntities(h.live.entities().map((e) =>
      isWallEntity(e) && hostIds.includes(e.id) ? { ...e, params: { ...e.params, thickness: e.params.thickness + 20 } } : e));

    expect(openings.approve(h.deps)).toBe(false);
    expect(addOpeningsToScene).not.toHaveBeenCalled();
    expect(state().notice).toEqual({ kind: 'stale' });
    // Μάρτυρας: η ΠΡΟΤΑΣΗ δεν άλλαξε καθόλου — αν είχε αλλάξει, το «μπαγιάτικο» θα το έβλεπε και
    // αποτύπωμα χωρίς τις ζώνες, και το test θα περνούσε χωρίς να ελέγχει ό,τι λέει ο τίτλος του.
    expect(stored(state().openingProposal!.items)).toEqual(stored(shown.items));
    expect(state().openingProposal!.unexplainedIds).toEqual(shown.unexplainedIds);
  });

  it('άρνηση του γραφέα ⇒ ονομασμένη ειδοποίηση, καμία εγγραφή', () => {
    const h = harness();
    sampleOpening(h);
    addOpeningsToScene.mockReturnValueOnce({ refusal: 'overlap' });

    expect(openings.approve(h.deps)).toBe(false);
    expect(state().notice).toEqual({ kind: 'openings-refused', refusal: 'overlap' });
    expect(openingsIn(h)).toHaveLength(0);
  });

  it('χωρίς πρόταση ανοιγμάτων η έγκριση δεν κάνει τίποτα', () => {
    const h = harness();
    modelFromDrawingSession.open();
    expect(openings.approve(h.deps)).toBe(false);
    expect(addOpeningsToScene).not.toHaveBeenCalled();
  });

  it('refresh χωρίς δείγμα «κούφωμα» δεν αγγίζει τίποτα — ούτε ψεύτικο «δεν υπάρχει σχέδιο»', () => {
    const h = harness();
    modelFromDrawingSession.open();
    modelFromDrawingStore.patch({ phase: 'review' });
    const before = state();

    openings.refresh(h.deps);

    expect(state()).toBe(before);
  });

  it('refresh με `keepNotice` κρατά ό,τι είχε πει ο άλλος ελεγκτής· χωρίς, το σβήνει', () => {
    const h = harness();
    sampleOpening(h);
    const written = { kind: 'written', count: 38, retrimmed: 0 } as const;

    modelFromDrawingStore.patch({ notice: written });
    openings.refresh(h.deps, true);
    expect(state().notice).toEqual(written);

    openings.refresh(h.deps);
    expect(state().notice).toBeNull();
  });

  it('η ειδοποίηση εγγραφής γράφει ΠΟΣΑ γράφτηκαν — και με απόφαση ανθρώπου σε κενό', () => {
    const h = harness();
    sampleOpening(h);
    openings.choose([gapKeys()[0]], 'door', h.deps);

    expect(openings.approve(h.deps)).toBe(true);

    expect(openingsIn(h)).toHaveLength(13);
    expect(state().notice).toEqual({ kind: 'openings-written', count: 13 });
  });

  it('refresh ξαναϋπολογίζει από τη ζωντανή σκηνή με τις ίδιες απαντήσεις', () => {
    const h = harness();
    sampleOpening(h);
    const [gap] = gapKeys();
    openings.choose([gap], 'none', h.deps);
    const shown = state().openingProposal;

    openings.refresh(h.deps);

    expect(state().openingProposal).not.toBe(shown);
    expect(state().openingProposal).toEqual(shown);
    expect(state().openingChoices.get(gap)).toBe('none');
  });
});
