/**
 * ADR-500 (ADR-487 §7) — structural-auto-study-core tests.
 *
 * Καλύπτει τη λογική του ντετερμινιστικού βρόχου σύγκλισης ΜΕ mocked τα orchestrated
 * cores (size/reinforce/footing/diagnostics) ώστε ο έλεγχος να είναι ντετερμινιστικός
 * και να εστιάζει ΜΟΝΟ στη ροή του loop:
 *   - πλήρης σύγκλιση (μηδέν blocking) → break + converged=true
 *   - κόλλημα (τίποτα δεν αλλάζει αλλά μένει κόκκινο) → break + converged=false
 *   - exit-to-human στο όριο γύρων (MAX) → rounds=max + remaining
 *   - atomic undo wrapper: 1η αλλαγή → execute, υπόλοιπες → executeGrouped
 *   - already-converged → no-op (καμία execute, rounds=1)
 *   - severity 'info' ΔΕΝ είναι blocking
 *   - DEFER A: unique per-kind counts (size∪reinforce ταξινομημένα + designed πέδιλα)
 */

jest.mock('../structural-load-takedown-core', () => ({ runStructuralLoadTakedown: jest.fn(() => 0) }));
jest.mock('../member-auto-size-core', () => ({ runMemberAutoSize: jest.fn(() => []) }));
jest.mock('../structural-auto-reinforce-core', () => ({ runOrganismAutoReinforce: jest.fn(() => []) }));
jest.mock('../auto-foundation-design-core', () => ({
  runAutoFoundationDesign: jest.fn(() => ({ created: 0, updated: 0, removed: 0, combined: 0, footingIds: [] })),
  foundationChangeCount: (r: { created: number; updated: number; removed: number }) =>
    r.created + r.updated + r.removed,
}));
jest.mock('../structural-organism-core', () => ({ runOrganismDiagnostics: jest.fn(() => []) }));
jest.mock('../structural-analysis-core', () => ({ runStructuralAnalysis: jest.fn(() => ({ diagnostics: [] })) }));
jest.mock('../../bim/structural/analytical/analytical-model-store', () => ({
  AnalyticalModelStore: { get: () => ({ members: [], nodes: [] }) },
}));
jest.mock('../../state/analysis-diagram-view-store', () => ({
  useAnalysisDiagramViewStore: { getState: () => ({}) },
  isAnalysisEngaged: () => false,
}));

import { runAutoStudy, MAX_STUDY_ROUNDS, type AutoStudyLevelManager, type AutoStudyDeps } from '../structural-auto-study-core';
import { runStructuralLoadTakedown } from '../structural-load-takedown-core';
import { runMemberAutoSize } from '../member-auto-size-core';
import { runOrganismAutoReinforce } from '../structural-auto-reinforce-core';
import { runAutoFoundationDesign } from '../auto-foundation-design-core';
import { runOrganismDiagnostics } from '../structural-organism-core';
import { runStructuralAnalysis } from '../structural-analysis-core';
import type { ICommand } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { StructuralDiagnostic } from '../../bim/structural/organism/structural-organism-types';

type Sev = StructuralDiagnostic['severity'];
interface RoundScript {
  sizedIds: readonly string[];
  reinforcedIds: readonly string[];
  footingIds: readonly string[];
  diags: readonly Sev[];
}

const FAKE_CMD = {} as ICommand;
const diag = (severity: Sev): StructuralDiagnostic =>
  ({ id: 'd', code: 'analyticalModelUnstable', severity, messageKey: 'k', primaryEntityId: 'e', entityIds: ['e'] });

/** Σταθερή σκηνή ενεργού ορόφου ώστε το classify να ταξινομεί τα member ids ανά τύπο. */
const mkEnt = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);
const SCENE = {
  entities: [mkEnt('C1', 'column'), mkEnt('C2', 'column'), mkEnt('B1', 'beam'), mkEnt('S1', 'slab')],
} as unknown as SceneModel;

const LEVEL: AutoStudyLevelManager = {
  currentLevelId: 'L1',
  levels: [],
  getLevelScene: () => SCENE,
  setLevelScene: () => undefined,
};

let execute: jest.Mock;
let executeGrouped: jest.Mock;

/** Στήνει τα mocked cores ώστε να ακολουθούν ένα per-round script (clamp στο τελευταίο). */
function scriptRounds(rounds: readonly RoundScript[]): void {
  let i = 0;
  const cur = (): RoundScript => rounds[Math.min(i, rounds.length - 1)];
  (runStructuralLoadTakedown as jest.Mock).mockImplementation(() => 0);
  (runMemberAutoSize as jest.Mock).mockImplementation((_l, _p, exec: (c: ICommand) => void) => {
    const ids = cur().sizedIds;
    if (ids.length > 0) exec(FAKE_CMD);
    return ids;
  });
  (runOrganismAutoReinforce as jest.Mock).mockImplementation((_l, _ids, _p, exec: (c: ICommand) => void) => {
    const ids = cur().reinforcedIds;
    if (ids.length > 0) exec(FAKE_CMD);
    return ids;
  });
  (runAutoFoundationDesign as jest.Mock).mockImplementation((_l, { exec }: { exec: (c: ICommand) => void }) => {
    const ids = cur().footingIds;
    if (ids.length > 0) exec(FAKE_CMD);
    return { created: ids.length, updated: 0, removed: 0, combined: 0, footingIds: ids };
  });
  (runOrganismDiagnostics as jest.Mock).mockImplementation(() => {
    const out = cur().diags.map(diag);
    i += 1; // ο γύρος τελειώνει στο diagnostics read
    return out;
  });
}

function deps(overrides: Partial<AutoStudyDeps> = {}): AutoStudyDeps {
  return {
    provider: {} as AutoStudyDeps['provider'],
    loadSettings: {} as AutoStudyDeps['loadSettings'],
    getOffset: (() => undefined) as unknown as AutoStudyDeps['getOffset'],
    user: null,
    storeyCount: 1,
    execute,
    executeGrouped,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  execute = jest.fn();
  executeGrouped = jest.fn();
});

describe('runAutoStudy — convergence loop', () => {
  it('συγκλίνει + μετρά unique per-kind (DEFER A: C1 sized+reinforced = 1 κολώνα)', () => {
    scriptRounds([
      { sizedIds: ['C1', 'B1'], reinforcedIds: ['C1'], footingIds: ['F1'], diags: ['warning'] },
      { sizedIds: ['C2'], reinforcedIds: [], footingIds: [], diags: [] },
    ]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(2);
    expect(r.converged).toBe(true);
    expect(r.remaining).toHaveLength(0);
    expect(r.columns).toBe(2); // C1 (1 φορά παρά size+reinforce+2 γύρους) + C2
    expect(r.beams).toBe(1); // B1
    expect(r.slabs).toBe(0);
    expect(r.footings).toBe(1); // F1
  });

  it('σταματά όταν τίποτα δεν αλλάζει αλλά μένει κόκκινο (converged=false)', () => {
    scriptRounds([
      { sizedIds: ['C1'], reinforcedIds: [], footingIds: [], diags: ['error'] },
      { sizedIds: [], reinforcedIds: [], footingIds: [], diags: ['error'] },
    ]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(2);
    expect(r.converged).toBe(false);
    expect(r.remaining).toHaveLength(1);
    expect(r.columns).toBe(1);
  });

  it('exit-to-human: φτάνει στο όριο γύρων όταν επιμένει το κόκκινο', () => {
    scriptRounds([{ sizedIds: ['C1'], reinforcedIds: ['B1'], footingIds: [], diags: ['error'] }]);
    const r = runAutoStudy(LEVEL, deps({ maxRounds: 3 }));
    expect(r.rounds).toBe(3);
    expect(r.converged).toBe(false);
    expect(r.remaining).toHaveLength(1);
    expect(r.columns).toBe(1); // ίδιο id σε 3 γύρους → unique 1
    expect(r.beams).toBe(1);
  });

  it('atomic undo: 1η αλλαγή → execute, υπόλοιπες → executeGrouped', () => {
    scriptRounds([{ sizedIds: ['C1'], reinforcedIds: ['B1'], footingIds: ['F1'], diags: [] }]);
    runAutoStudy(LEVEL, deps());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(executeGrouped).toHaveBeenCalledTimes(2);
  });

  it('already-converged → no-op (καμία execute, rounds=1)', () => {
    scriptRounds([{ sizedIds: [], reinforcedIds: [], footingIds: [], diags: [] }]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.columns + r.beams + r.slabs + r.footings).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    expect(executeGrouped).not.toHaveBeenCalled();
  });

  it("severity 'info' ΔΕΝ είναι blocking → συγκλίνει", () => {
    scriptRounds([{ sizedIds: ['C1'], reinforcedIds: [], footingIds: [], diags: ['info'] }]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.remaining).toHaveLength(0);
  });

  it('FEM solve δεν τρέχει όταν δεν είναι engaged (gate)', () => {
    scriptRounds([{ sizedIds: [], reinforcedIds: [], footingIds: [], diags: [] }]);
    runAutoStudy(LEVEL, deps());
    expect(runStructuralAnalysis).not.toHaveBeenCalled();
  });

  it('default maxRounds = MAX_STUDY_ROUNDS', () => {
    scriptRounds([{ sizedIds: ['C1'], reinforcedIds: [], footingIds: [], diags: ['error'] }]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(MAX_STUDY_ROUNDS);
  });
});
