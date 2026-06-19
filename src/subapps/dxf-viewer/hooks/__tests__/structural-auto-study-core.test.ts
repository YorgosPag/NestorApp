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
 */

jest.mock('../structural-load-takedown-core', () => ({ runStructuralLoadTakedown: jest.fn(() => 0) }));
jest.mock('../member-auto-size-core', () => ({ runMemberAutoSize: jest.fn(() => 0) }));
jest.mock('../structural-auto-reinforce-core', () => ({ runOrganismAutoReinforce: jest.fn(() => 0) }));
jest.mock('../auto-foundation-design-core', () => ({
  runAutoFoundationDesign: jest.fn(() => ({ created: 0, updated: 0, removed: 0, combined: 0 })),
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
import type { StructuralDiagnostic } from '../../bim/structural/organism/structural-organism-types';

type Sev = StructuralDiagnostic['severity'];
interface RoundScript {
  sized: number;
  reinforced: number;
  footed: number;
  diags: readonly Sev[];
}

const FAKE_CMD = {} as ICommand;
const diag = (severity: Sev): StructuralDiagnostic =>
  ({ id: 'd', code: 'analyticalModelUnstable', severity, messageKey: 'k', primaryEntityId: 'e', entityIds: ['e'] });

const LEVEL: AutoStudyLevelManager = {
  currentLevelId: 'L1',
  levels: [],
  getLevelScene: () => null,
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
    const n = cur().sized;
    if (n > 0) exec(FAKE_CMD);
    return n;
  });
  (runOrganismAutoReinforce as jest.Mock).mockImplementation((_l, _ids, _p, exec: (c: ICommand) => void) => {
    const n = cur().reinforced;
    if (n > 0) exec(FAKE_CMD);
    return n;
  });
  (runAutoFoundationDesign as jest.Mock).mockImplementation((_l, { exec }: { exec: (c: ICommand) => void }) => {
    const n = cur().footed;
    if (n > 0) exec(FAKE_CMD);
    return { created: n, updated: 0, removed: 0, combined: 0 };
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
  it('συγκλίνει όταν μηδενίσει το blocking (converged=true) + αθροίζει counts', () => {
    scriptRounds([
      { sized: 2, reinforced: 1, footed: 1, diags: ['warning'] }, // round0: άλλαξε, μένει warning
      { sized: 1, reinforced: 0, footed: 0, diags: [] }, // round1: άλλαξε, μηδέν κόκκινο → break
    ]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(2);
    expect(r.converged).toBe(true);
    expect(r.remaining).toHaveLength(0);
    expect(r.sized).toBe(3);
    expect(r.reinforced).toBe(1);
    expect(r.footed).toBe(1);
  });

  it('σταματά όταν τίποτα δεν αλλάζει αλλά μένει κόκκινο (converged=false)', () => {
    scriptRounds([
      { sized: 1, reinforced: 0, footed: 0, diags: ['error'] }, // round0: άλλαξε
      { sized: 0, reinforced: 0, footed: 0, diags: ['error'] }, // round1: τίποτα → break stuck
    ]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(2);
    expect(r.converged).toBe(false);
    expect(r.remaining).toHaveLength(1);
  });

  it('exit-to-human: φτάνει στο όριο γύρων όταν επιμένει το κόκκινο', () => {
    scriptRounds([{ sized: 1, reinforced: 1, footed: 0, diags: ['error'] }]); // πάντα ίδιο
    const r = runAutoStudy(LEVEL, deps({ maxRounds: 3 }));
    expect(r.rounds).toBe(3);
    expect(r.converged).toBe(false);
    expect(r.remaining).toHaveLength(1);
    expect(r.sized).toBe(3); // 1 ανά γύρο × 3
  });

  it('atomic undo: 1η αλλαγή → execute, υπόλοιπες → executeGrouped', () => {
    scriptRounds([{ sized: 1, reinforced: 1, footed: 1, diags: [] }]); // 3 commands, μετά break
    runAutoStudy(LEVEL, deps());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(executeGrouped).toHaveBeenCalledTimes(2);
  });

  it('already-converged → no-op (καμία execute, rounds=1)', () => {
    scriptRounds([{ sized: 0, reinforced: 0, footed: 0, diags: [] }]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.sized + r.reinforced + r.footed).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    expect(executeGrouped).not.toHaveBeenCalled();
  });

  it("severity 'info' ΔΕΝ είναι blocking → συγκλίνει", () => {
    scriptRounds([{ sized: 1, reinforced: 0, footed: 0, diags: ['info'] }]);
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.remaining).toHaveLength(0);
  });

  it('FEM solve δεν τρέχει όταν δεν είναι engaged (gate)', () => {
    scriptRounds([{ sized: 0, reinforced: 0, footed: 0, diags: [] }]);
    runAutoStudy(LEVEL, deps());
    expect(runStructuralAnalysis).not.toHaveBeenCalled();
  });

  it('default maxRounds = MAX_STUDY_ROUNDS', () => {
    scriptRounds([{ sized: 1, reinforced: 0, footed: 0, diags: ['error'] }]); // ατέρμονο κόκκινο
    const r = runAutoStudy(LEVEL, deps());
    expect(r.rounds).toBe(MAX_STUDY_ROUNDS);
  });
});
