/**
 * ADR-363 Phase 4 — Contextual ribbon tab για column editor.
 *
 * Trigger: `column-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'column'`, OR activeTool === 'column').
 *
 * Panels (Phase 4 — minimal):
 *   Kind     → kind combobox (4 τύποι) + anchor (9 options)
 *   Geometry → width + depth + height + rotation (mm / deg)
 *   Actions  → close + delete
 *
 * Live behavior: bridge (`useRibbonColumnBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useColumnPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  COLUMN_RIBBON_KEYS,
  COLUMN_RIBBON_KEYS_ACTIONS,
  COLUMN_RIBBON_BADGE_KEYS,
  COLUMN_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/column-command-keys';
import { ENVELOPE_FUNCTION_OPTIONS } from '../hooks/bridge/envelope-function-param';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';

export const COLUMN_CONTEXTUAL_TRIGGER = 'column-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const COLUMN_KIND_OPTIONS = [
  { value: 'rectangular', labelKey: 'ribbon.commands.columnEditor.kind.rectangular', isLiteralLabel: false },
  { value: 'circular',    labelKey: 'ribbon.commands.columnEditor.kind.circular',    isLiteralLabel: false },
  { value: 'L-shape',     labelKey: 'ribbon.commands.columnEditor.kind.lShape',      isLiteralLabel: false },
  { value: 'T-shape',     labelKey: 'ribbon.commands.columnEditor.kind.tShape',      isLiteralLabel: false },
  // ADR-363 Phase 8D — 3 new column kinds (industry-standard variants).
  { value: 'polygon',     labelKey: 'ribbon.commands.columnEditor.kind.polygon',     isLiteralLabel: false },
  { value: 'shear-wall',  labelKey: 'ribbon.commands.columnEditor.kind.shearWall',   isLiteralLabel: false },
  { value: 'I-shape',     labelKey: 'ribbon.commands.columnEditor.kind.iShape',      isLiteralLabel: false },
] as const;

// ADR-363 Phase 8D — polygon sides numeric input options (3-12 per MIN/MAX_POLYGON_SIDES).
const POLYGON_SIDES_OPTIONS = [
  { value: '3',  labelKey: '3',  isLiteralLabel: true },
  { value: '4',  labelKey: '4',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '6',  labelKey: '6',  isLiteralLabel: true },
  { value: '7',  labelKey: '7',  isLiteralLabel: true },
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
] as const;

// ADR-363 Phase 8D — I-shape flange thickness presets (IPE/HEA typical range).
const I_FLANGE_THICKNESS_OPTIONS = [
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
] as const;

// ADR-363 Phase 8D — I-shape web thickness presets (IPE/HEA typical range).
const I_WEB_THICKNESS_OPTIONS = [
  { value: '6',  labelKey: '6',  isLiteralLabel: true },
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

// ADR-363 Phase 8E — shear-wall RC concrete catalog (Eurocode 2 / EN 1992-1-1).
const SHEAR_WALL_CATALOG_OPTIONS = [
  { value: 'custom',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.custom',              isLiteralLabel: false },
  { value: 'C20/25',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c2025',     isLiteralLabel: false },
  { value: 'C25/30',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c2530',     isLiteralLabel: false },
  { value: 'C30/37',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c3037',     isLiteralLabel: false },
  { value: 'C35/45',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c3545',     isLiteralLabel: false },
  { value: 'C40/50',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.shearWall.c4050',     isLiteralLabel: false },
] as const;

// ADR-363 Phase 8E — I-shape steel section catalog (EN 10025-2 IPE + HEA families).
const ISHAPE_CATALOG_OPTIONS = [
  { value: 'custom',   labelKey: 'ribbon.commands.columnEditor.catalogProfile.custom',            isLiteralLabel: false },
  { value: 'IPE-200',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe200',     isLiteralLabel: false },
  { value: 'IPE-240',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe240',     isLiteralLabel: false },
  { value: 'IPE-300',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe300',     isLiteralLabel: false },
  { value: 'IPE-360',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe360',     isLiteralLabel: false },
  { value: 'IPE-400',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe400',     isLiteralLabel: false },
  { value: 'IPE-500',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.ipe500',     isLiteralLabel: false },
  { value: 'HEA-200',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea200',     isLiteralLabel: false },
  { value: 'HEA-240',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea240',     isLiteralLabel: false },
  { value: 'HEA-300',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea300',     isLiteralLabel: false },
  { value: 'HEA-400',  labelKey: 'ribbon.commands.columnEditor.catalogProfile.iShape.hea400',     isLiteralLabel: false },
] as const;

const COLUMN_ANCHOR_OPTIONS = [
  { value: 'center', labelKey: 'ribbon.commands.columnEditor.anchor.center', isLiteralLabel: false },
  { value: 'nw',     labelKey: 'ribbon.commands.columnEditor.anchor.nw',     isLiteralLabel: false },
  { value: 'n',      labelKey: 'ribbon.commands.columnEditor.anchor.n',      isLiteralLabel: false },
  { value: 'ne',     labelKey: 'ribbon.commands.columnEditor.anchor.ne',     isLiteralLabel: false },
  { value: 'w',      labelKey: 'ribbon.commands.columnEditor.anchor.w',      isLiteralLabel: false },
  { value: 'e',      labelKey: 'ribbon.commands.columnEditor.anchor.e',      isLiteralLabel: false },
  { value: 'sw',     labelKey: 'ribbon.commands.columnEditor.anchor.sw',     isLiteralLabel: false },
  { value: 's',      labelKey: 'ribbon.commands.columnEditor.anchor.s',      isLiteralLabel: false },
  { value: 'se',     labelKey: 'ribbon.commands.columnEditor.anchor.se',     isLiteralLabel: false },
] as const;

const WIDTH_MM_OPTIONS = [
  { value: '250',  labelKey: '250',  isLiteralLabel: true },
  { value: '300',  labelKey: '300',  isLiteralLabel: true },
  { value: '400',  labelKey: '400',  isLiteralLabel: true },
  { value: '500',  labelKey: '500',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
] as const;

const DEPTH_MM_OPTIONS = [
  { value: '250',  labelKey: '250',  isLiteralLabel: true },
  { value: '300',  labelKey: '300',  isLiteralLabel: true },
  { value: '400',  labelKey: '400',  isLiteralLabel: true },
  { value: '500',  labelKey: '500',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
] as const;

const HEIGHT_MM_OPTIONS = [
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
  { value: '2700', labelKey: '2700', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '3600', labelKey: '3600', isLiteralLabel: true },
  { value: '4000', labelKey: '4000', isLiteralLabel: true },
] as const;

// ADR-363 Phase 4.5d — material picker (ENABLED). 4 options match the hatch
// pattern keys consumed by `resolveMaterialKey` + `ColumnRenderer.drawMaterialHatch`
// (Phase 4.5c.2). Lookup is case-insensitive, unknown → 'rc' fallback.
const COLUMN_MATERIAL_OPTIONS = [
  { value: 'rc',      labelKey: 'ribbon.commands.columnEditor.material.rc',      isLiteralLabel: false },
  { value: 'steel',   labelKey: 'ribbon.commands.columnEditor.material.steel',   isLiteralLabel: false },
  { value: 'masonry', labelKey: 'ribbon.commands.columnEditor.material.masonry', isLiteralLabel: false },
  { value: 'wood',    labelKey: 'ribbon.commands.columnEditor.material.wood',    isLiteralLabel: false },
] as const;

const ROTATION_DEG_OPTIONS = [
  { value: '0',   labelKey: '0',   isLiteralLabel: true },
  { value: '15',  labelKey: '15',  isLiteralLabel: true },
  { value: '30',  labelKey: '30',  isLiteralLabel: true },
  { value: '45',  labelKey: '45',  isLiteralLabel: true },
  { value: '60',  labelKey: '60',  isLiteralLabel: true },
  { value: '90',  labelKey: '90',  isLiteralLabel: true },
  { value: '135', labelKey: '135', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_COLUMN_TAB: RibbonTab = {
  id: 'column-editor',
  labelKey: 'ribbon.tabs.columnProperties',
  isContextual: true,
  contextualTrigger: COLUMN_CONTEXTUAL_TRIGGER,
  badgeKey: COLUMN_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'column-kind',
      labelKey: 'ribbon.panels.columnKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.kind',
                labelKey: 'ribbon.commands.columnEditor.kind.section.title',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: COLUMN_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.anchor',
                labelKey: 'ribbon.commands.columnEditor.anchor.section.title',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.anchor,
                comboboxWidthPx: 110,
                options: COLUMN_ANCHOR_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'column-geometry',
      labelKey: 'ribbon.panels.columnGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.width',
                labelKey: 'ribbon.commands.columnEditor.width',
                commandKey: COLUMN_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.depth',
                labelKey: 'ribbon.commands.columnEditor.depth',
                commandKey: COLUMN_RIBBON_KEYS.params.depth,
                comboboxWidthPx: 80,
                options: DEPTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.height',
                labelKey: 'ribbon.commands.columnEditor.height',
                commandKey: COLUMN_RIBBON_KEYS.params.height,
                comboboxWidthPx: 80,
                options: HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.rotation',
                labelKey: 'ribbon.commands.columnEditor.rotation',
                commandKey: COLUMN_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 8D — polygon-specific input (sides count). Visible iff
      // `params.kind === 'polygon'` via bridge.getPanelVisibility.
      id: 'column-polygon-params',
      labelKey: 'ribbon.panels.columnPolygon',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.sides',
                labelKey: 'ribbon.commands.columnEditor.sides',
                commandKey: COLUMN_RIBBON_KEYS.params.sides,
                comboboxWidthPx: 80,
                options: POLYGON_SIDES_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 8D — I-shape variant inputs (flange tf + web tw). Visible
      // iff `params.kind === 'I-shape'` via bridge.getPanelVisibility.
      id: 'column-ishape-params',
      labelKey: 'ribbon.panels.columnIshape',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.flangeThickness',
                labelKey: 'ribbon.commands.columnEditor.flangeThickness',
                commandKey: COLUMN_RIBBON_KEYS.params.flangeThickness,
                comboboxWidthPx: 80,
                options: I_FLANGE_THICKNESS_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.webThickness',
                labelKey: 'ribbon.commands.columnEditor.webThickness',
                commandKey: COLUMN_RIBBON_KEYS.params.webThickness,
                comboboxWidthPx: 80,
                options: I_WEB_THICKNESS_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 8E — shear-wall RC concrete catalog. Visible iff
      // `params.kind === 'shear-wall'` via bridge.getPanelVisibility.
      id: 'column-shear-wall-catalog',
      labelKey: 'ribbon.panels.columnShearWallCatalog',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.shearWallCatalog,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.shearWallCatalog',
                labelKey: 'ribbon.commands.columnEditor.catalogProfile.section.title',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.catalogProfile,
                comboboxWidthPx: 190,
                options: SHEAR_WALL_CATALOG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 8E — I-shape IPE/HEA profile catalog. Visible iff
      // `params.kind === 'I-shape'` via bridge.getPanelVisibility.
      id: 'column-ishape-catalog',
      labelKey: 'ribbon.panels.columnIshapeCatalog',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.ishapeCatalog',
                labelKey: 'ribbon.commands.columnEditor.catalogProfile.section.title',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.catalogProfile,
                comboboxWidthPx: 190,
                options: ISHAPE_CATALOG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 4.5d — material picker panel. ENABLED — sits between
      // geometry and actions so the engineer can flip RC ↔ Steel ↔ Masonry ↔
      // Wood and immediately observe the hatch update from Phase 4.5c.2
      // (`ColumnRenderer.drawMaterialHatch`).
      id: 'column-material',
      labelKey: 'ribbon.panels.columnMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.material',
                labelKey: 'ribbon.commands.columnEditor.material.section.title',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 180,
                options: COLUMN_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-396 v2 Φ6a — ETICS θερμοπρόσοψη: per-element override της αυτόματης
      // ταξινόμησης κελύφους (auto / εξωτερικό / εσωτερικό), Revit Wall-Function.
      id: 'column-envelope',
      labelKey: 'ribbon.panels.envelopeFunction',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.envelopeFunction',
                labelKey: 'ribbon.commands.envelopeFunction.section.title',
                tooltipKey: 'ribbon.commands.envelopeFunction.tooltip',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.envelopeFunction,
                comboboxWidthPx: 150,
                options: ENVELOPE_FUNCTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'column-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'column.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'column-actions',
      labelKey: 'ribbon.panels.columnActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.close',
                labelKey: 'ribbon.commands.columnEditor.close',
                icon: 'select',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.close,
                action: COLUMN_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.delete',
                labelKey: 'ribbon.commands.columnEditor.delete',
                icon: 'trash',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.delete,
                action: COLUMN_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
