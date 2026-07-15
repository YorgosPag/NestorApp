/**
 * ADR-662 Φάση 1 — Permanent «Τοπογραφικό» (Topography) discipline ribbon tab.
 *
 * Το τοπογραφικό ήταν η ΜΟΝΑΔΙΚΗ μελέτη εκτός Ribbon (ζούσε ως καρτέλα στο αριστερό
 * floating panel — `TopographyPanel`). Οι big players (Revit «Massing & Site», Civil 3D
 * «Surface», ArchiCAD Toolbox) βάζουν τις authoring εντολές εδάφους σε ΜΟΝΙΜΟ ribbon tab.
 * Αυτό το data file μιμείται ΑΚΡΙΒΩΣ τα άλλα discipline tabs (ADR-443/444 «Δομικά»/«ΗΛΜ»):
 * reuse των SSoT `toolBtn`/`actionBtn` (ribbon-large-button-helpers.ts) — ΚΑΜΙΑ νέα λογική.
 *
 * Wiring:
 *   - `toolBtn(..., commandKey)`  → ToolStateStore.selectTool (ήδη ζωντανά tools:
 *     `topo-breakline`, `topo-boundary`).
 *   - `actionBtn(..., 'topo.*')`  → routeRibbonAction → dxf-special-actions →
 *     EventBus.emit('topo:ribbon-action') → `TopoRibbonHost` (mount-time topo hooks +
 *     stores + section-in-dialog). Τα topo actions/hooks/stores μένουν ΑΘΙΚΤΑ.
 *
 * Φάση 1 scope: authoring εντολές (import / generate / bake / compute / QA / deliverables /
 * geo-reference) + tools. Οι numeric παράμετροι (ισοδιάσταση/index/βήμα κανάβου) + τα live
 * pressed-state toggles μένουν προς το παρόν στο αριστερό `TopographyPanel` (dual access,
 * μηδέν regression) — τα ribbon commands διαβάζουν τις τρέχουσες τιμές των persisted stores.
 * Οι numeric ribbon widgets + τα contextual/Properties είναι Φάσεις 1b/2/3 (ADR-662 §6.5).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 * @see ./systems-discipline-tabs.ts (ADR-444 — το πρότυπο MEP discipline tabs)
 */

import type { RibbonTab } from '../types/ribbon-types';
import { toolBtn, actionBtn } from './ribbon-large-button-helpers';

const K = 'ribbon.commands.topo';

/** action helper: topo command whose `commandKey` mirrors the `action` (dialog/one-shot). */
function topoAction(id: string, labelKey: string, icon: string, action: string) {
  return actionBtn(id, labelKey, icon, action, action);
}

export const TOPOGRAPHY_TAB: RibbonTab = {
  id: 'topography',
  labelKey: 'ribbon.tabs.topography',
  panels: [
    {
      id: 'topo-data',
      labelKey: 'ribbon.panels.topoData',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            topoAction('topoTab.import', `${K}.import.label`, 'import-wizard', 'topo.import.open'),
            topoAction('topoTab.cloudToggle', `${K}.cloudToggle.label`, 'topo-cloud', 'topo.cloud.toggle'),
            topoAction('topoTab.cloudRemove', `${K}.cloudRemove.label`, 'delete', 'topo.cloud.remove'),
          ],
        },
      ],
    },
    {
      id: 'topo-surface',
      labelKey: 'ribbon.panels.topoSurface',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('topoTab.breakline', `${K}.breakline.label`, 'topo-breakline', 'topo-breakline'),
            topoAction('topoTab.generate', `${K}.generate.label`, 'topo-contours', 'topo.contours.generate'),
            topoAction('topoTab.autoBreakline', `${K}.autoBreakline.label`, 'topo-auto-breakline', 'topo.autoBreakline.detect'),
          ],
        },
      ],
    },
    {
      id: 'topo-georef',
      labelKey: 'ribbon.panels.topoGeoRef',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            topoAction('topoTab.geoRef', `${K}.geoRef.label`, 'topo-georef', 'topo.geoRef.open'),
          ],
        },
      ],
    },
    {
      id: 'topo-presentation',
      labelKey: 'ribbon.panels.topoPresentation',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            topoAction('topoTab.gridToggle', `${K}.gridToggle.label`, 'display-grid', 'topo.grid.toggle'),
            topoAction('topoTab.gridBake', `${K}.gridBake.label`, 'display-grid', 'topo.grid.bake'),
            topoAction('topoTab.northToggle', `${K}.northToggle.label`, 'north-arrow', 'topo.north.toggle'),
            topoAction('topoTab.northBake', `${K}.northBake.label`, 'north-arrow', 'topo.north.bake'),
            topoAction('topoTab.pointLabels', `${K}.pointLabels.label`, 'topo-labels', 'topo.pointLabels.generate'),
          ],
        },
      ],
    },
    {
      id: 'topo-analysis',
      labelKey: 'ribbon.panels.topoAnalysis',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('topoTab.boundary', `${K}.boundary.label`, 'topo-boundary', 'topo-boundary'),
            topoAction('topoTab.cutFill', `${K}.cutFill.label`, 'topo-cutfill', 'topo.cutFill.compute'),
            topoAction('topoTab.qaRun', `${K}.qaRun.label`, 'topo-qa', 'topo.qa.run'),
            topoAction('topoTab.qaClear', `${K}.qaClear.label`, 'delete', 'topo.qa.clear'),
          ],
        },
      ],
    },
    {
      id: 'topo-deliverables',
      labelKey: 'ribbon.panels.topoDeliverables',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            topoAction('topoTab.deliverables', `${K}.deliverables.label`, 'export-dxf', 'topo.deliverables.open'),
          ],
        },
      ],
    },
  ],
};
