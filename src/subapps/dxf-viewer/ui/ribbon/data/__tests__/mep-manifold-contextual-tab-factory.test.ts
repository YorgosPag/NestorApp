/**
 * ADR-408 Φ12 / Φ14 — the manifold contextual-tab factory + φρεάτιο vs water
 * differentiation. Locks the SSoT contract: both tabs share structure + command
 * keys (one bridge) and differ ONLY in labels + presets + the System panel.
 */

import type { RibbonTab, RibbonButton } from '../../types/ribbon-types';
import { CONTEXTUAL_MEP_MANIFOLD_TAB, MEP_MANIFOLD_CONTEXTUAL_TRIGGER } from '../contextual-mep-manifold-tab';
import {
  CONTEXTUAL_DRAINAGE_COLLECTOR_TAB,
  DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER,
} from '../contextual-drainage-collector-tab';
import { MEP_MANIFOLD_RIBBON_KEYS } from '../../hooks/bridge/mep-manifold-command-keys';

function panelByIdSuffix(tab: RibbonTab, suffix: string) {
  return tab.panels.find((p) => p.id.endsWith(suffix));
}

function buttonByCommandKey(tab: RibbonTab, commandKey: string): RibbonButton | undefined {
  for (const panel of tab.panels) {
    for (const row of panel.rows) {
      const found = row.buttons.find((b) => b.command.commandKey === commandKey);
      if (found) return found;
    }
  }
  return undefined;
}

describe('manifold contextual tab factory — shared structure, divergent palette', () => {
  it('both tabs reuse the SAME command keys (one bridge drives both)', () => {
    const key = MEP_MANIFOLD_RIBBON_KEYS.params.outletCount;
    expect(buttonByCommandKey(CONTEXTUAL_MEP_MANIFOLD_TAB, key)).toBeDefined();
    expect(buttonByCommandKey(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, key)).toBeDefined();
  });

  it('water manifold shows the System (classification) panel; the φρεάτιο does not', () => {
    expect(panelByIdSuffix(CONTEXTUAL_MEP_MANIFOLD_TAB, '-system')).toBeDefined();
    expect(panelByIdSuffix(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, '-system')).toBeUndefined();
  });

  it('the φρεάτιο connections panel reads "inlets", the water tab "outlets"', () => {
    expect(panelByIdSuffix(CONTEXTUAL_MEP_MANIFOLD_TAB, '-connections')?.labelKey).toBe(
      'ribbon.panels.mepManifoldOutlets',
    );
    expect(panelByIdSuffix(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, '-connections')?.labelKey).toBe(
      'ribbon.panels.mepDrainageCollectorInlets',
    );
  });

  it('the φρεάτιο count combobox is labelled as inlets', () => {
    const btn = buttonByCommandKey(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, MEP_MANIFOLD_RIBBON_KEYS.params.outletCount);
    expect(btn?.command.labelKey).toBe('ribbon.commands.mepDrainageCollectorEditor.inletCount');
  });

  it('the φρεάτιο geometry presets are square (include the 450mm default)', () => {
    const widthBtn = buttonByCommandKey(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, MEP_MANIFOLD_RIBBON_KEYS.params.width);
    const values = (widthBtn?.command.options ?? []).map((o) => o.value);
    expect(values).toContain('450');
  });

  it('the φρεάτιο diameter presets are DN drainage sizes (inlet 100, outlet 125)', () => {
    const inlet = buttonByCommandKey(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter);
    const outlet = buttonByCommandKey(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB, MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter);
    expect((inlet?.command.options ?? []).map((o) => o.value)).toContain('100');
    expect((outlet?.command.options ?? []).map((o) => o.value)).toContain('125');
  });

  it('the two tabs carry distinct triggers + titles', () => {
    expect(CONTEXTUAL_MEP_MANIFOLD_TAB.contextualTrigger).toBe(MEP_MANIFOLD_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB.contextualTrigger).toBe(DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_MEP_MANIFOLD_TAB.labelKey).toBe('ribbon.tabs.mepManifoldProperties');
    expect(CONTEXTUAL_DRAINAGE_COLLECTOR_TAB.labelKey).toBe('ribbon.tabs.mepDrainageCollectorProperties');
  });
});
