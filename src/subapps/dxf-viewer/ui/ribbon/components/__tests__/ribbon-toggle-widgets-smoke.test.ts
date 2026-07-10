/**
 * ADR-599 — Import smoke for the 13 store-backed ribbon toggles migrated to the
 * `RibbonToggleWidget` / `RibbonInlineToggleButton` SSoT.
 *
 * Cheap module-graph guard: every migrated call-site must still export its named
 * component (RibbonPanel imports each by name). Importing the module executes the
 * top-level config literal + icon imports without invoking any store hook (those
 * live inside `useToggleState` closures), so it catches renamed exports, broken
 * relative imports, and missing icons without needing a store/Firestore harness.
 */

import { HideBimToggle } from '../HideBimToggle';
import { MepWireToggle } from '../MepWireToggle';
import { DrainPipeToggle } from '../DrainPipeToggle';
import { ColorBySystemToggle } from '../ColorBySystemToggle';
import { ShowHeatLoadToggle } from '../ShowHeatLoadToggle';
import { ShowFinishSkinToggle } from '../ShowFinishSkinToggle';
import { ShowReinforcementToggle } from '../ShowReinforcementToggle';
import { ShowPipeSizingToggle } from '../ShowPipeSizingToggle';
import { ShowBalancingToggle } from '../ShowBalancingToggle';
import { ShowAnalysisDiagramsToggle } from '../ShowAnalysisDiagramsToggle';
import { ShowUtilizationToggle } from '../ShowUtilizationToggle';
import { DisciplineVisibilityToggle } from '../DisciplineVisibilityToggle';
import { DimRowHandlesToggle } from '../DimRowHandlesToggle';
// ADR-531 Φ5b.3 — «Μόνο κάτοψη DXF» plan-lines toggle (ίδιο RibbonToggleWidget SSoT).
import { PlanLinesToggle } from '../PlanLinesToggle';

const MIGRATED_TOGGLES = {
  HideBimToggle,
  PlanLinesToggle,
  MepWireToggle,
  DrainPipeToggle,
  ColorBySystemToggle,
  ShowHeatLoadToggle,
  ShowFinishSkinToggle,
  ShowReinforcementToggle,
  ShowPipeSizingToggle,
  ShowBalancingToggle,
  ShowAnalysisDiagramsToggle,
  ShowUtilizationToggle,
  DisciplineVisibilityToggle,
  DimRowHandlesToggle,
};

describe('ADR-599 — migrated ribbon toggles export their named component', () => {
  it('exposes all 14 call-sites as function components', () => {
    const entries = Object.entries(MIGRATED_TOGGLES);
    expect(entries).toHaveLength(14);
    for (const [name, component] of entries) {
      expect(typeof component).toBe('function');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
