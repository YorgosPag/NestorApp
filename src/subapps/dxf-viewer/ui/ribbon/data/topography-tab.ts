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
 * geo-reference) + tools.
 *
 * Φάση 1b (ADR-662 §6.5): τα Φάσης-1 άχρωμα toggle actions (grid/north/cloud) γίνονται live
 * pressed-state `widget` toggles (ON/OFF όπως Revit/ArchiCAD) + προστίθενται mode toggles
 * (στυλ ισοϋψών, mode Βορρά, αναφορά Cut/Fill) και editable numeric fields (ισοδιάσταση/index/
 * βήμα κανάβου). Τα widgets subscribe-άρουν ΑΠΕΥΘΕΙΑΣ τα persisted topo stores (self-contained,
 * μηδέν bridge) — reuse `RibbonToggleWidget`/`RibbonNumericFieldWidget`, ΚΑΜΙΑ νέα λογική. Το
 * αριστερό `TopographyPanel` **αποσύρθηκε** (ADR-662 Φάση 4)· τα review sections (QA/auto-
 * breakline/cut-fill/cloud) ζουν πλέον ως section-in-dialog μέσω `TopoRibbonHost` (`.open`
 * actions), τα object-bound displays στο Properties palette (Φ2β Δρόμος Γ).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 * @see ./systems-discipline-tabs.ts (ADR-444 — το πρότυπο MEP discipline tabs)
 * @see ../components/TopoRibbonToggleWidgets.tsx · ../components/TopoRibbonNumericWidgets.tsx
 */

import type { RibbonTab, RibbonButton } from '../types/ribbon-types';
import { toolBtn, actionBtn } from './ribbon-large-button-helpers';

const K = 'ribbon.commands.topo';

/** action helper: topo command whose `commandKey` mirrors the `action` (dialog/one-shot). */
function topoAction(id: string, labelKey: string, icon: string, action: string) {
  return actionBtn(id, labelKey, icon, action, action);
}

/**
 * ADR-662 Φάση 1b — inline `widget` button (live toggle / numeric field). The
 * real icon + state live in the widget component (RibbonPanel `widgetId` map);
 * `command.icon` stays empty like every other ribbon widget button.
 */
function topoWidget(id: string, labelKey: string, widgetId: string): RibbonButton {
  return {
    type: 'widget',
    size: 'small',
    widgetId,
    command: { id, labelKey, icon: '', commandKey: widgetId },
  };
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
            topoWidget('topoTab.cloudVisible', `${K}.cloudVisible.label`, 'topo-cloud-visible'),
            // ADR-662 Φ4 — «Νέφος σημείων…»: store-subscribed widget που ανοίγει τον cloud
            // manager dialog (stats + show/hide + remove)· **disabled + tooltip** όταν δεν
            // υπάρχει νέφος (big-player: εντολή με ανεκπλήρωτη προϋπόθεση = greyed, ΟΧΙ κενό
            // dialog). Ο quick-toggle widget μένει δίπλα για γρήγορο on/off (Revit-style).
            topoWidget('topoTab.cloud', `${K}.cloud.label`, 'topo-cloud-manage'),
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
            // ADR-662 Φ4 — καθαρισμός breaklines (ήταν στο αριστερό panel· ο tool δίπλα το γεννά).
            topoAction('topoTab.breaklineClear', `${K}.breakline.clear`, 'delete', 'topo.breakline.clear'),
            topoWidget('topoTab.contourInterval', `${K}.intervalField.label`, 'topo-contour-interval'),
            topoWidget('topoTab.contourIndex', `${K}.indexField.label`, 'topo-contour-index'),
            topoWidget('topoTab.contourStyle', `${K}.contourStyle.label`, 'topo-contour-style'),
            topoAction('topoTab.generate', `${K}.generate.label`, 'topo-contours', 'topo.contours.generate'),
            // ADR-662 Φ4 — «Αυτόματες ασυνέχειες»: ανοίγει dialog (detect → review → approve, §9).
            topoAction('topoTab.autoBreakline', `${K}.autoBreakline.label`, 'topo-auto-breakline', 'topo.autoBreakline.open'),
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
            topoWidget('topoTab.gridVisible', `${K}.gridVisible.label`, 'topo-grid-visible'),
            topoWidget('topoTab.gridStep', `${K}.gridStepField.label`, 'topo-grid-step'),
            topoAction('topoTab.gridBake', `${K}.gridBake.label`, 'display-grid', 'topo.grid.bake'),
            topoWidget('topoTab.northVisible', `${K}.northVisible.label`, 'topo-north-visible'),
            topoWidget('topoTab.northMode', `${K}.northMode.label`, 'topo-north-mode'),
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
            topoWidget('topoTab.cutFillMode', `${K}.cutFillMode.label`, 'topo-cutfill-mode'),
            // ADR-662 Φ4 — «Όγκοι εκσκαφών»/«Έλεγχος ποιότητας»: ανοίγουν dialog με πλήρη ροή
            // (mode/όγκοι· run/review/zoom-to-flag). Το mode quick-toggle widget μένει δίπλα.
            topoAction('topoTab.cutFill', `${K}.cutFill.label`, 'topo-cutfill', 'topo.cutFill.open'),
            topoAction('topoTab.qaRun', `${K}.qaRun.label`, 'topo-qa', 'topo.qa.open'),
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
