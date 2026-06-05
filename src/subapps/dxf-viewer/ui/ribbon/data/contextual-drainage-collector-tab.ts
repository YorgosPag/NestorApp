/**
 * ADR-408 Φ14 — Contextual ribbon tab για το φρεάτιο αποχέτευσης (drainage
 * collector). Kind `drainage-collector`: N gravity inlets + 1 sewer outlet — the
 * REVERSE of a water manifold, so it reads as its own family in the palette
 * (Revit shows a catch basin and a manifold with their own type properties).
 *
 * Trigger: `drainage-collector-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-manifold` με kind `drainage-collector`).
 *
 * Built from the SAME `buildMepManifoldContextualTab` factory as the water
 * manifold tab (SSoT for structure + command keys) and driven by the SAME
 * `useRibbonMepManifoldBridge` — it differs only in:
 *   - labels: «Ιδιότητες Φρεατίου», panel «Είσοδοι» (not «Έξοδοι»),
 *   - presets: square catch-basin sizes + DN drainage diameters,
 *   - no System panel: a φρεάτιο is always sanitary (no classification picker).
 *
 * The `outletCount` field counts the N branch INLETS here (the connector builder
 * reverses the roles for a drainage-collector — see `buildMepManifoldConnectors`).
 *
 * @see mep-manifold-contextual-tab-factory.ts
 * @see contextual-mep-manifold-tab.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  buildMepManifoldContextualTab,
  mmOptions,
  countOptions,
} from './mep-manifold-contextual-tab-factory';

export const DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER = 'drainage-collector-selected';

export const CONTEXTUAL_DRAINAGE_COLLECTOR_TAB: RibbonTab = buildMepManifoldContextualTab({
  tabId: 'drainage-collector-editor',
  panelIdPrefix: 'drainage-collector',
  trigger: DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER,
  tabLabelKey: 'ribbon.tabs.mepDrainageCollectorProperties',
  // A φρεάτιο is always sanitary-drainage — no hydraulic-classification picker.
  includeSystemPanel: false,
  panelLabelKeys: {
    geometry: 'ribbon.panels.mepManifoldGeometry', // «Γεωμετρία» — shared word
    connections: 'ribbon.panels.mepDrainageCollectorInlets', // «Είσοδοι / Έξοδος»
    actions: 'ribbon.panels.mepManifoldActions', // «Ενέργειες» — shared word
  },
  fieldLabelKeys: {
    width: 'ribbon.commands.mepDrainageCollectorEditor.width',
    length: 'ribbon.commands.mepDrainageCollectorEditor.length',
    bodyHeight: 'ribbon.commands.mepDrainageCollectorEditor.bodyHeight',
    mountingElevation: 'ribbon.commands.mepDrainageCollectorEditor.mountingElevation',
    count: 'ribbon.commands.mepDrainageCollectorEditor.inletCount',
    inletDiameter: 'ribbon.commands.mepDrainageCollectorEditor.inletDiameter',
    outletDiameter: 'ribbon.commands.mepDrainageCollectorEditor.outletDiameter',
    close: 'ribbon.commands.mepDrainageCollectorEditor.close',
    delete: 'ribbon.commands.mepDrainageCollectorEditor.delete',
  },
  presets: {
    // Square catch-basin footprint (default 450 mm) — matches the φρεάτιο defaults.
    width: mmOptions([300, 400, 450, 500, 600]),
    length: mmOptions([300, 400, 450, 500, 600]),
    bodyHeight: mmOptions([200, 300, 400, 500]),
    mountingElevation: mmOptions([200, 300, 400, 600]),
    // Branch INLET count (gravity inlets), 1..6.
    count: countOptions([1, 2, 3, 4, 6]),
    // DN drainage diameters: branch inlets (smaller) + single sewer outlet (larger).
    inletDiameter: mmOptions([50, 75, 100, 110]),
    outletDiameter: mmOptions([100, 110, 125, 160]),
  },
});
