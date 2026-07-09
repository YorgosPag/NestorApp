/**
 * ADR-600 — Import smoke for the single-click placement tools built on the
 * `createSingleClickPlacementTool` factory.
 *
 * Cheap module-graph guard: every migrated call-site must still export its named
 * hook (consumed across CanvasSection / ribbon bridges / ghost leaves). Importing
 * the module runs the top-level factory call (config + INITIAL_STATE) without
 * invoking any React hook, so it catches renamed exports + broken imports without
 * a render harness.
 */

import { useMepRadiatorTool } from '../useMepRadiatorTool';
import { useMepWaterHeaterTool } from '../useMepWaterHeaterTool';
import { useMepManifoldTool } from '../useMepManifoldTool';
import { useMepBoilerTool } from '../useMepBoilerTool';
import { useMepFixtureTool } from '../useMepFixtureTool';
import { useElectricalPanelTool } from '../useElectricalPanelTool';
import { useFurnitureTool } from '../useFurnitureTool';
import { useFloorplanSymbolTool } from '../useFloorplanSymbolTool';
// ADR-615 — self-hosted (free-standing) opening tool, built on the same factory.
import { useSelfOpeningTool } from '../useSelfOpeningTool';

const MIGRATED_TOOLS = {
  useMepRadiatorTool,
  useMepWaterHeaterTool,
  useMepManifoldTool,
  useMepBoilerTool,
  useMepFixtureTool,
  useElectricalPanelTool,
  useFurnitureTool,
  useFloorplanSymbolTool,
  useSelfOpeningTool,
};

describe('ADR-600 — migrated placement tools export their named hook', () => {
  it('exposes all 9 call-sites as functions', () => {
    const entries = Object.entries(MIGRATED_TOOLS);
    expect(entries).toHaveLength(9);
    for (const [name, hook] of entries) {
      expect(typeof hook).toBe('function');
      expect(name.startsWith('use')).toBe(true);
    }
  });
});
