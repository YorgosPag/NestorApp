/**
 * ADR-345 §3 Fase 6 — Insert tab definition.
 * Houses all file import/export operations (AutoCAD/Revit Insert+Output pattern).
 * Buttons migrated from EnhancedDXFToolbar second toolbar.
 */

import type { RibbonTab } from '../types/ribbon-types';

export const INSERT_TAB: RibbonTab = {
  id: 'insert',
  labelKey: 'ribbon.tabs.insert',
  panels: [
    {
      id: 'floorplan',
      labelKey: 'ribbon.panels.insert',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.floorplan-wizard',
                labelKey: 'ribbon.commands.floorplanWizard',
                icon: 'import-wizard',
                commandKey: 'import-floorplan-wizard',
                action: 'import-floorplan-wizard',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'dxfFiles',
      labelKey: 'ribbon.panels.dxfFiles',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.enhanced-import',
                labelKey: 'ribbon.commands.enhancedImport',
                icon: 'import-enhanced',
                commandKey: 'import-dxf-enhanced',
                action: 'import-dxf-enhanced',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'insert.upload-legacy',
                labelKey: 'ribbon.commands.uploadDxfLegacy',
                icon: 'import-legacy',
                commandKey: 'import-dxf-legacy',
                action: 'import-dxf-legacy',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'insert.import-tek',
                labelKey: 'ribbon.commands.importTek',
                icon: 'import-legacy',
                commandKey: 'import-tek',
                action: 'import-tek',
              },
            },
          ],
        },
      ],
    },
    {
      // Block Library M1 — «Τα Blocks μου»: opens the browsable palette of session/imported
      // DXF blocks (action, όχι tool commandKey· η επιλογή κάρτας ενεργοποιεί το placement tool).
      id: 'blockLibrary',
      labelKey: 'ribbon.panels.blockLibrary',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.block-library',
                labelKey: 'ribbon.commands.blockLibrary',
                icon: 'block-library',
                commandKey: 'block-library',
                action: 'toggle-block-library-panel',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-654 — «Έπιπλα Κάτοψης»: opens the browsable palette of top-view furniture
      // entourage cut-outs (action, όχι tool commandKey· η επιλογή κάρτας ενεργοποιεί
      // το placement tool 'furniture-plan' — mirror του Block Library M1 panel above).
      id: 'furniturePlan',
      labelKey: 'ribbon.panels.furniturePlan',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.furniture-plan',
                labelKey: 'ribbon.commands.furniturePlan',
                icon: 'furniture-plan',
                commandKey: 'furniture-plan',
                action: 'toggle-furniture-plan-panel',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-654 M6 — «Άνθρωποι Κάτοψης»: browsable palette of top-view people entourage
      // cut-outs (action· η επιλογή κάρτας ενεργοποιεί το placement tool 'people-plan').
      id: 'peoplePlan',
      labelKey: 'ribbon.panels.peoplePlan',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.people-plan',
                labelKey: 'ribbon.commands.peoplePlan',
                icon: 'people-plan',
                commandKey: 'people-plan',
                action: 'toggle-people-plan-panel',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-654 M6 — «Οχήματα Κάτοψης»: browsable palette of top-view vehicle entourage
      // cut-outs (action· η επιλογή κάρτας ενεργοποιεί το placement tool 'vehicles-plan').
      id: 'vehiclePlan',
      labelKey: 'ribbon.panels.vehiclePlan',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.vehicles-plan',
                labelKey: 'ribbon.commands.vehiclePlan',
                icon: 'vehicles-plan',
                commandKey: 'vehicles-plan',
                action: 'toggle-vehicles-plan-panel',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-654 M7 — «Φυτά Κάτοψης»: browsable palette of top-view plant entourage
      // cut-outs (action· η επιλογή κάρτας ενεργοποιεί το placement tool 'plants-plan').
      id: 'plantsPlan',
      labelKey: 'ribbon.panels.plantsPlan',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.plants-plan',
                labelKey: 'ribbon.commands.plantsPlan',
                icon: 'plants-plan',
                commandKey: 'plants-plan',
                action: 'toggle-plants-plan-panel',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-651 Φάση Β — «Πινακίδα»: single-click placement tool (commandKey = ToolType
      // 'title-block'). Το πρότυπο λύνεται με τα στοιχεία του ενεργού έργου (zero-config
      // auto-fill) και μπαίνει στη σκηνή ως BlockEntity — καμία επιλογή πριν το κλικ.
      id: 'titleBlock',
      labelKey: 'ribbon.panels.titleBlock',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.title-block',
                labelKey: 'ribbon.commands.titleBlock',
                tooltipKey: 'ribbon.commands.titleBlockTooltip',
                icon: 'title-block',
                commandKey: 'title-block',
                shortcut: 'TITLEBLOCK',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-583 — Annotation symbol library (North arrow first). Single-click
      // placement tool (commandKey = ToolType 'north-arrow').
      id: 'annotationSymbols',
      labelKey: 'ribbon.panels.annotationSymbols',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.north-arrow',
                labelKey: 'ribbon.commands.northArrow',
                tooltipKey: 'ribbon.commands.northArrowTooltip',
                icon: 'north-arrow',
                commandKey: 'north-arrow',
                shortcut: 'NORTH',
              },
            },
            {
              // ADR-583 Φ1b — section mark (single-click annotation-symbol placement).
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.section-mark',
                labelKey: 'ribbon.commands.sectionMark',
                tooltipKey: 'ribbon.commands.sectionMarkTooltip',
                icon: 'section-mark',
                commandKey: 'section-mark',
                shortcut: 'SECTION',
              },
            },
            {
              // ADR-583 Φ1c — grid axis bubble.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.grid-bubble',
                labelKey: 'ribbon.commands.gridBubble',
                tooltipKey: 'ribbon.commands.gridBubbleTooltip',
                icon: 'grid-bubble',
                commandKey: 'grid-bubble',
                shortcut: 'GRID',
              },
            },
            {
              // ADR-583 Φ1c — elevation mark.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.elevation-mark',
                labelKey: 'ribbon.commands.elevationMark',
                tooltipKey: 'ribbon.commands.elevationMarkTooltip',
                icon: 'elevation-mark',
                commandKey: 'elevation-mark',
                shortcut: 'ELEV',
              },
            },
            {
              // ADR-583 Φ1c — detail callout.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.detail-callout',
                labelKey: 'ribbon.commands.detailCallout',
                tooltipKey: 'ribbon.commands.detailCalloutTooltip',
                icon: 'detail-callout',
                commandKey: 'detail-callout',
                shortcut: 'CALLOUT',
              },
            },
            {
              // ADR-583 Φ1c — revision tag.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.revision-tag',
                labelKey: 'ribbon.commands.revisionTag',
                tooltipKey: 'ribbon.commands.revisionTagTooltip',
                icon: 'revision-tag',
                commandKey: 'revision-tag',
                shortcut: 'REVTAG',
              },
            },
            {
              // ADR-583 Φ2 — graphic scale-bar: DEDICATED entity type (NOT an
              // annotation-symbol kind). commandKey routes to the generic 2-point
              // drawing tool (RibbonLargeButton → onToolChange), same dispatch as
              // every other tool button — no bespoke annotation-symbol handler.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.scale-bar',
                labelKey: 'ribbon.commands.scaleBar',
                tooltipKey: 'ribbon.commands.scaleBarTooltip',
                icon: 'scale-bar',
                commandKey: 'scale-bar',
                shortcut: 'SCALEBAR',
              },
            },
            {
              // ADR-612 — opening info tag: DEDICATED entity type (NOT an
              // annotation-symbol kind). commandKey routes to the generic SINGLE-CLICK
              // drawing tool (RibbonLargeButton → onToolChange), same dispatch as
              // every other tool button — no bespoke annotation-symbol handler.
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.opening-info-tag',
                labelKey: 'ribbon.commands.openingInfoTag',
                tooltipKey: 'ribbon.commands.openingInfoTagTooltip',
                icon: 'opening-info-tag',
                commandKey: 'opening-info-tag',
                shortcut: 'OPENINGTAG',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'background',
      labelKey: 'ribbon.panels.background',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.pdf-background',
                labelKey: 'ribbon.commands.pdfBackground',
                icon: 'pdf-background',
                commandKey: 'toggle-pdf-background',
                action: 'toggle-pdf-background',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'exportPanel',
      labelKey: 'ribbon.panels.exportPanel',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.export',
                labelKey: 'ribbon.commands.exportDxf',
                icon: 'export-dxf',
                commandKey: 'export',
                action: 'export',
                shortcut: 'Ctrl+E',
              },
            },
            // ADR-369 §Q8.3 — IFC4 export trigger. Dispatched via EventBus
            // 'bim:ifc-export-requested' → IfcExportHost performs the export.
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'insert.export-ifc',
                labelKey: 'ribbon.commands.ifcExport',
                icon: 'export-ifc',
                commandKey: 'export-ifc',
                action: 'export-ifc',
              },
            },
          ],
        },
      ],
    },
  ],
} as const;
