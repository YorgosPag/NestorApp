/**
 * ADR-728 Φ0.1 — `SnapOrchestrator.collectCandidates` άγκυρες σημασιολογίας + attribution.
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 *
 * Ο βρόχος των engines **εξήχθη** από το `findSnapPoint` (83 γραμμές → N.7.1 όριο 40) σε ιδιωτική
 * μέθοδο, και το `earlyReturn` έπαψε να είναι σκέτο `return` — ταξιδεύει πλέον μέσα σε αντικείμενο.
 * Ο ισχυρισμός «η σημασιολογία είναι ταυτόσημη» χωρίς test είναι **ισχυρισμός, όχι απόδειξη**.
 *
 * Καρφώνονται οι **τέσσερις** συμπεριφορές που η εξαγωγή μπορούσε να σπάσει σιωπηλά, και οι
 * **δύο** νέες γραμμές οργάνου. Ο φάκελος `orchestrator/__tests__/` δεν υπήρχε: ο orchestrator
 * του snap ήταν **ατεστάριστος** μέχρι σήμερα.
 *
 * ⚠️ Ο `SnapEngineRegistry` είναι mocked ώστε οι engines να είναι ελεγχόμενες. Ο
 * `SnapCandidateProcessor` και ο `SnapContextManager` είναι **πραγματικοί** — το test περνά από
 * την αληθινή διαδρομή επιλογής νικητή, όχι από διπλότυπό της.
 */

import { SnapOrchestrator } from '../SnapOrchestrator';
import { SNAP_ENGINE_STAGE_PREFIX, SNAP_ENTITY_COUNT_STAGE } from '../SnapOrchestrator';
import { ExtendedSnapType, type Entity, type ProSnapSettings, type SnapCandidate } from '../../extended-types';
import type { SnapEngineResult } from '../../shared/BaseSnapEngine';

// ── Mocks ────────────────────────────────────────────────────────────────────

/** Οι engines που θα σερβίρει το mocked registry, ανά τύπο. */
const engineStubs = new Map<ExtendedSnapType, { findSnapCandidates: jest.Mock }>();

jest.mock('../SnapEngineRegistry', () => ({
  SnapEngineRegistry: jest.fn().mockImplementation(() => ({
    initializeEnginesWithEntities: jest.fn(),
    updateGridSettings: jest.fn(),
    toggleEngine: jest.fn(),
    getEngineStats: jest.fn(() => ({ candidateIndex: 0, enabledEngines: [], engineStats: {} })),
    dispose: jest.fn(),
    getEngine: (type: ExtendedSnapType) => engineStubs.get(type) ?? null,
  })),
}));

/** Το ΥΠΑΡΧΟΝ perf aggregator — κρατάμε τα stages που καταγράφηκαν, χωρίς πραγματικό χρόνο. */
const recordedStages: string[] = [];
const recordedSamples: Array<{ stage: string; value: number }> = [];
let perfFlagOn = false;

jest.mock('../../../systems/cursor/mouse-handler-perf', () => ({
  isPerfEnabled: () => perfFlagOn,
  recordSample: (stage: string, value: number) => {
    if (!perfFlagOn) return;
    recordedSamples.push({ stage, value });
  },
  withPerf: <T,>(stage: string, fn: () => T): T => {
    if (perfFlagOn) recordedStages.push(stage);
    return fn();
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<SnapCandidate> = {}): SnapCandidate {
  return {
    point: { x: 100, y: 100 },
    type: ExtendedSnapType.ENDPOINT,
    description: 'endpoint',
    distance: 50,
    priority: 0,
    ...overrides,
  };
}

/** Καταχωρεί μια ψεύτικη engine που επιστρέφει ό,τι της πεις. */
function stubEngine(type: ExtendedSnapType, result: SnapEngineResult | null): jest.Mock {
  const fn = jest.fn(() => result);
  engineStubs.set(type, { findSnapCandidates: fn });
  return fn;
}

function makeSettings(overrides: Partial<ProSnapSettings> = {}): ProSnapSettings {
  return {
    enabled: true,
    snapDistance: 10,
    enabledTypes: new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.MIDPOINT, ExtendedSnapType.CENTER]),
    showSnapMarkers: true,
    showSnapTooltips: true,
    priority: [ExtendedSnapType.ENDPOINT, ExtendedSnapType.MIDPOINT, ExtendedSnapType.CENTER],
    autoMode: false,
    tabCycling: false,
    ...overrides,
  } as ProSnapSettings;
}

/** Δύο οντότητες — αρκούν· ο orchestrator δεν τις διαβάζει, τις **παραδίδει**. */
function makeEntities(count: number): Entity[] {
  return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, type: 'line' })) as unknown as Entity[];
}

beforeEach(() => {
  engineStubs.clear();
  recordedStages.length = 0;
  recordedSamples.length = 0;
  perfFlagOn = false;
  jest.clearAllMocks();
});

// ── 1. Σημασιολογικές άγκυρες της εξαγωγής ───────────────────────────────────

describe('ADR-728 Φ0.1 — η εξαγωγή διατηρεί τη σημασιολογία', () => {
  it('το earlyReturn μιας engine επιστρέφεται ΑΥΤΟΥΣΙΟ και σταματά τις επόμενες', () => {
    const early = {
      found: true,
      snapPoint: makeCandidate({ description: 'early-winner' }),
      allCandidates: [],
      originalPoint: { x: 0, y: 0 },
      snappedPoint: { x: 7, y: 7 },
      activeMode: ExtendedSnapType.ENDPOINT,
      timestamp: 123,
    };
    stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [], earlyReturn: early });
    const midpoint = stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [makeCandidate()] });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(3));
    const result = orch.findSnapPoint({ x: 0, y: 0 });

    // Αυτούσιο: ΔΕΝ περνά από τον processor (που θα ξαναδιάλεγε νικητή).
    expect(result).toBe(early);
    expect(result.snappedPoint).toEqual({ x: 7, y: 7 });
    // Και η επόμενη engine στη σειρά προτεραιότητας ΔΕΝ έτρεξε.
    expect(midpoint).not.toHaveBeenCalled();
  });

  it('σταματά μόλις συγκεντρωθούν maxCandidates (φράγμα ADR-597 anti-starvation)', () => {
    // maxCandidates = 8 (SnapContextManager). 8 υποψήφιοι από την πρώτη ⇒ η δεύτερη δεν τρέχει.
    stubEngine(ExtendedSnapType.ENDPOINT, {
      candidates: Array.from({ length: 8 }, () => makeCandidate({ distance: 999 })),
    });
    const midpoint = stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [] });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(3));
    orch.findSnapPoint({ x: 0, y: 0 });

    expect(midpoint).not.toHaveBeenCalled();
  });

  it('παραλείπει τύπους εκτός enabledTypes, τιμώντας τη σειρά priority', () => {
    const endpoint = stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [] });
    const midpoint = stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [] });
    const center = stubEngine(ExtendedSnapType.CENTER, { candidates: [] });

    const orch = new SnapOrchestrator(
      makeSettings({ enabledTypes: new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.CENTER]) }),
    );
    orch.initialize(makeEntities(3));
    orch.findSnapPoint({ x: 0, y: 0 });

    expect(endpoint).toHaveBeenCalledTimes(1);
    expect(center).toHaveBeenCalledTimes(1);
    expect(midpoint).not.toHaveBeenCalled();
  });

  it('αντέχει engine που επιστρέφει null/undefined χωρίς να διακόψει τη σειρά', () => {
    stubEngine(ExtendedSnapType.ENDPOINT, null);
    const midpoint = stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [makeCandidate()] });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(3));
    const result = orch.findSnapPoint({ x: 0, y: 0 });

    expect(midpoint).toHaveBeenCalledTimes(1);
    expect(result.found).toBe(true);
  });

  it('snapping σβηστό ⇒ καμία engine δεν τρέχει', () => {
    const endpoint = stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [makeCandidate()] });

    const orch = new SnapOrchestrator(makeSettings({ enabled: false }));
    orch.initialize(makeEntities(3));
    const result = orch.findSnapPoint({ x: 0, y: 0 });

    expect(endpoint).not.toHaveBeenCalled();
    expect(result.found).toBe(false);
  });
});

// ── 2. Το όργανο της Φ0.1 ────────────────────────────────────────────────────

describe('ADR-728 Φ0.1 — attribution ανά engine', () => {
  it('με ΚΛΕΙΣΤΟ flag δεν καταγράφεται τίποτα (μηδέν κόστος στην παραγωγή)', () => {
    perfFlagOn = false;
    stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [] });
    stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [] });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(2910));
    orch.findSnapPoint({ x: 0, y: 0 });

    expect(recordedStages).toHaveLength(0);
    expect(recordedSamples).toHaveLength(0);
  });

  it('με ΑΝΟΙΧΤΟ flag παράγει ΜΙΑ γραμμή ανά engine που έτρεξε — όχι ανά engine που υπάρχει', () => {
    perfFlagOn = true;
    stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [] });
    stubEngine(ExtendedSnapType.MIDPOINT, { candidates: [] });
    stubEngine(ExtendedSnapType.CENTER, { candidates: [] });

    const orch = new SnapOrchestrator(
      makeSettings({ enabledTypes: new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.CENTER]) }),
    );
    orch.initialize(makeEntities(2910));
    orch.findSnapPoint({ x: 0, y: 0 });

    expect(recordedStages).toEqual([
      `${SNAP_ENGINE_STAGE_PREFIX}${ExtendedSnapType.ENDPOINT}`,
      `${SNAP_ENGINE_STAGE_PREFIX}${ExtendedSnapType.CENTER}`,
    ]);
  });

  it('καταγράφει το ΜΕΓΕΘΟΣ του προβλήματος — πόσες οντότητες παραδόθηκαν (το νούμερο που ρίχνει η Φ2)', () => {
    perfFlagOn = true;
    stubEngine(ExtendedSnapType.ENDPOINT, { candidates: [] });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(2910));
    orch.findSnapPoint({ x: 0, y: 0 });

    const entityCounts = recordedSamples.filter((s) => s.stage === SNAP_ENTITY_COUNT_STAGE);
    expect(entityCounts).toHaveLength(1);
    // 🔴 ΑΥΤΟ είναι το εύρημα του ADR-728 §3.1, καρφωμένο: ΟΛΟΚΛΗΡΗ η σκηνή σε κάθε engine.
    // Όταν η Φ2 προσθέσει broad phase, ΑΥΤΟ το test θα πέσει — και **σωστά**: θα ξαναγραφτεί
    // με το νέο μέγεθος, ως απόδειξη του κέρδους.
    expect(entityCounts[0].value).toBe(2910);
  });

  it('το early-return μονοπάτι δεν χάνει το δείγμα μεγέθους (καταγράφεται ΠΡΙΝ τον βρόχο)', () => {
    perfFlagOn = true;
    stubEngine(ExtendedSnapType.ENDPOINT, {
      candidates: [],
      earlyReturn: {
        found: true,
        snapPoint: makeCandidate(),
        allCandidates: [],
        originalPoint: { x: 0, y: 0 },
        snappedPoint: { x: 1, y: 1 },
        activeMode: ExtendedSnapType.ENDPOINT,
        timestamp: 1,
      },
    });

    const orch = new SnapOrchestrator(makeSettings());
    orch.initialize(makeEntities(42));
    orch.findSnapPoint({ x: 0, y: 0 });

    expect(recordedSamples.filter((s) => s.stage === SNAP_ENTITY_COUNT_STAGE)).toHaveLength(1);
  });
});
