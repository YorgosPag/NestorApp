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
