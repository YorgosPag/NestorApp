/**
 * ADR-933 — Contextual ribbon tab «Περιοχή» (Revit «Modify | Place Room/Area» · ArchiCAD Zone Info Box).
 *
 * Trigger: `overlay-region-active` — από τον `TOOL_ACTIVE_TRIGGER` όταν `activeTool === 'layering'`
 * (το εργαλείο σχεδίασης περιοχών κάτοψης· `NormalView` ⇒ `overlayMode = 'draw'`).
 *
 * Panels:
 *   Είδος   → widget `overlay-kind` (ποιο είδος γεννά το επόμενο κλικ — property/parking/storage/
 *             common_space/footprint)
 *   Μέθοδος → widget `overlay-draw-method` (πολυγωνική · ορθογώνια)
 *
 * Τα widgets γράφουν στο `overlayDrawSettingsStore` (SSoT)· η πόρτα αποθήκευσης
 * (`commitOverlayPolygon`) το διαβάζει τη στιγμή της αποθήκευσης.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-933-region-command.md
 */

import type { RibbonTab } from '../types/ribbon-types';

export const OVERLAY_REGION_CONTEXTUAL_TRIGGER = 'overlay-region-active';

export const CONTEXTUAL_OVERLAY_REGION_TAB: RibbonTab = {
  id: 'overlay-region',
  labelKey: 'ribbon.tabs.overlayRegion',
  isContextual: true,
  contextualTrigger: OVERLAY_REGION_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'overlay-region-kind',
      labelKey: 'ribbon.panels.overlayRegionKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'overlay-kind',
              command: {
                id: 'overlayRegion.kind',
                labelKey: 'ribbon.commands.overlayRegion.kind.section',
                commandKey: 'overlayRegion.kind.field',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'overlay-region-method',
      labelKey: 'ribbon.panels.overlayRegionMethod',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'overlay-draw-method',
              command: {
                id: 'overlayRegion.method',
                labelKey: 'ribbon.commands.overlayRegion.method.section',
                commandKey: 'overlayRegion.method.field',
              },
            },
          ],
        },
      ],
    },
  ],
};
