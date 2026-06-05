/**
 * ADR-408 Φ12 — Contextual ribbon tab για τον plumbing manifold (συλλέκτη ύδρευσης
 * / θέρμανσης). Kind `floor-manifold`: 1 inlet + N outlets.
 *
 * Trigger: `mep-manifold-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-manifold` με kind `floor-manifold`). The φρεάτιο (kind `drainage-collector`)
 * uses its own tab — see `contextual-drainage-collector-tab.ts`.
 *
 * Both tabs are built from the SAME `buildMepManifoldContextualTab` factory (SSoT
 * for the panel structure + command keys) and driven by the SAME
 * `useRibbonMepManifoldBridge` — they differ only in labels and combobox presets.
 *
 * Panels: Σύστημα (classification) → Γεωμετρία → Έξοδοι → Δίκτυο (fold-in,
 * self-hiding) → Ενέργειες.
 *
 * @see mep-manifold-contextual-tab-factory.ts
 * @see contextual-drainage-collector-tab.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  buildMepManifoldContextualTab,
  mmOptions,
  countOptions,
} from './mep-manifold-contextual-tab-factory';

export const MEP_MANIFOLD_CONTEXTUAL_TRIGGER = 'mep-manifold-selected';

export const CONTEXTUAL_MEP_MANIFOLD_TAB: RibbonTab = buildMepManifoldContextualTab({
  tabId: 'mep-manifold-editor',
  panelIdPrefix: 'mep-manifold',
  trigger: MEP_MANIFOLD_CONTEXTUAL_TRIGGER,
  tabLabelKey: 'ribbon.tabs.mepManifoldProperties',
  includeSystemPanel: true,
  panelLabelKeys: {
    geometry: 'ribbon.panels.mepManifoldGeometry',
    connections: 'ribbon.panels.mepManifoldOutlets',
    actions: 'ribbon.panels.mepManifoldActions',
  },
  fieldLabelKeys: {
    width: 'ribbon.commands.mepManifoldEditor.width',
    length: 'ribbon.commands.mepManifoldEditor.length',
    bodyHeight: 'ribbon.commands.mepManifoldEditor.bodyHeight',
    mountingElevation: 'ribbon.commands.mepManifoldEditor.mountingElevation',
    count: 'ribbon.commands.mepManifoldEditor.outletCount',
    inletDiameter: 'ribbon.commands.mepManifoldEditor.inletDiameter',
    outletDiameter: 'ribbon.commands.mepManifoldEditor.outletDiameter',
    close: 'ribbon.commands.mepManifoldEditor.close',
    delete: 'ribbon.commands.mepManifoldEditor.delete',
  },
  presets: {
    // Thin distribution-bar geometry: width = the run outlets line up along.
    width: mmOptions([200, 300, 400, 600, 800]),
    length: mmOptions([60, 80, 100, 120]),
    bodyHeight: mmOptions([40, 60, 80, 100]),
    mountingElevation: mmOptions([200, 300, 400, 600]),
    count: countOptions([2, 3, 4, 5, 6, 8, 10, 12]),
    // Supply header (1 inlet) + PEX branch diameters (N outlets).
    inletDiameter: mmOptions([20, 25, 32, 40]),
    outletDiameter: mmOptions([12, 16, 20, 25]),
  },
});
