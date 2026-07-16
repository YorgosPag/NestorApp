/**
 * ADR-662 Φάση 2β (Δρόμος Γ) Stage C — contextual ribbon tab «Τοπογραφική Επιφάνεια»,
 * ορατό όταν επιλέγεται ένα `TopoSurfaceEntity` (`type:'topo-surface'`).
 *
 * Big-player split (Revit Toposolid / Civil 3D «Surface» / ArchiCAD Mesh / C4D):
 * το contextual tab κρατά ΜΟΝΟ **ενέργειες** — Επιλογή + αναδημιουργία της
 * επιφάνειας/ισοϋψών + ετικέτες σημείων. ΟΛΕΣ οι **ιδιότητες εμφάνισης** (ανάγλυφο/
 * διαφάνεια/στυλ + ετικέτες Ζ/κωδικός/όριο Χ,Υ) ζουν στο αριστερό Properties palette
 * (`TopoSurfacePropertiesTab`), όπως στα μεγάλα CAD — object-bound, selection-driven.
 *
 * Zero-wiring: κάθε κουμπί reuse-άρει ΥΠΑΡΧΟΝ topo ribbon action (routeRibbonAction →
 * dxf-special-actions → `topo:ribbon-action` → `runTopoRibbonAction`). Η «Αναδημιουργία
 * ισοϋψών» (`topo.contours.generate`) (re)build-άρει ΚΑΙ το επιλέξιμο footprint της
 * επιφάνειας από την ΙΔΙΑ TIN (Stage B). Η «Επιλογή» reuse-άρει το SSoT
 * `buildSelectPanel`. ΚΑΜΙΑ δήλωση «Κλείσιμο» — το `withStandardClose` το προσθέτει
 * κεντρικά (ribbon-contextual-config.ts). Κανένα νέο command route/label.
 *
 * @see ./contextual-image-tab.ts — το mirror template (non-BIM sibling, actions-only)
 * @see ./topography-tab.ts — η SSoT των topo actions (`topo.*` command keys)
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';
// SSoT leading «Επιλογή» panel (Revit «Modify | …» opens with Select).
import { buildSelectPanel } from './contextual-select-panel';
// SSoT LARGE button factory (action === commandKey → routeRibbonAction, mirror topography-tab.ts).
import { actionBtn } from './ribbon-large-button-helpers';

export const TOPO_SURFACE_CONTEXTUAL_TRIGGER = 'topo-surface-selected';

/** i18n key prefix for the reused topo command labels (dxf-viewer-shell namespace). */
const K = 'ribbon.commands.topo';

/**
 * ADR-662 Φ4 — SMALL live `widget` button (Civil-3D quick style toggle). Το πραγματικό
 * icon + state ζουν στο widget component (RibbonPanel `widgetId` map), όπως κάθε ribbon
 * widget· `command.icon` μένει κενό (mirror `topography-tab.ts` `topoWidget`).
 */
function topoWidget(id: string, labelKey: string, widgetId: string): RibbonButton {
  return {
    type: 'widget',
    size: 'small',
    widgetId,
    command: { id, labelKey, icon: '', commandKey: widgetId },
  };
}

export const CONTEXTUAL_TOPO_SURFACE_TAB: RibbonTab = {
  id: 'topo-surface-tools',
  labelKey: 'ribbon.tabs.topoSurfaceProperties',
  isContextual: true,
  contextualTrigger: TOPO_SURFACE_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Επιλογή (Revit «Modify | …» leftmost panel) ───────────────────────────
    buildSelectPanel('topoSurface'),
    // ── Εμφάνιση (Civil-3D quick style: ανάγλυφο + υψομετρικό/μονόχρωμο) ────────
    // Object-bound quick toggles πάνω στο ΙΔΙΟ `terrain-3d-store` με το πλήρες
    // `Terrain3DSection` στο Properties palette (quick εδώ, full + opacity εκεί).
    {
      id: 'topo-surface-display',
      labelKey: 'ribbon.panels.topoSurfaceDisplay',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            topoWidget('topoSurfaceTools.terrainVisible', `${K}.terrainVisible.label`, 'topo-terrain-visible'),
            topoWidget('topoSurfaceTools.terrainStyle', `${K}.terrainStyle.label`, 'topo-terrain-style'),
          ],
        },
      ],
    },
    // ── Επιφάνεια (actions — reuse των υπαρχόντων topo ribbon actions) ─────────
    {
      id: 'topo-surface-actions',
      // Reuse του υπάρχοντος panel label «Επιφάνεια» (SSoT — ίδια copy με το μόνιμο tab).
      labelKey: 'ribbon.panels.topoSurface',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            // «Αναδημιουργία ισοϋψών» → `topo.contours.generate` (Stage B: ξαναχτίζει ΚΑΙ
            // το footprint της επιφάνειας από την ΙΔΙΑ TIN). Reuse του label του μόνιμου tab.
            actionBtn(
              'topoSurfaceTools.generate', `${K}.generate.label`,
              'topo-contours', 'topo.contours.generate', 'topo.contours.generate',
            ),
            // «Ετικέτες σημείων» → `topo.pointLabels.generate` (native text/point entities).
            actionBtn(
              'topoSurfaceTools.pointLabels', `${K}.pointLabels.label`,
              'topo-labels', 'topo.pointLabels.generate', 'topo.pointLabels.generate',
            ),
          ],
        },
      ],
    },
  ],
};
