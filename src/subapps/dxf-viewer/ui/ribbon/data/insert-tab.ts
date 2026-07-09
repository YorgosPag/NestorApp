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
