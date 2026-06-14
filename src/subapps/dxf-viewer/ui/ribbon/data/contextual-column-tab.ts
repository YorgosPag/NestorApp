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

import type { RibbonTab, RibbonComboboxOption } from '../types/ribbon-types';
import {
  COLUMN_RIBBON_KEYS,
  COLUMN_RIBBON_KEYS_ACTIONS,
  COLUMN_RIBBON_BADGE_KEYS,
  COLUMN_RIBBON_VISIBILITY_KEYS,
  COLUMN_FINISH_KEYS,
  COLUMN_STRUCTURAL_KEYS,
  COLUMN_STRUCTURAL_READOUT_KEYS,
} from '../hooks/bridge/column-command-keys';
import { ENVELOPE_FUNCTION_OPTIONS } from '../hooks/bridge/envelope-function-param';
import {
  FINISH_ENABLED_OPTIONS,
  FINISH_MATERIAL_OPTIONS,
  FINISH_THICKNESS_OPTIONS,
} from '../hooks/bridge/finish-param';
import {
  STRUCTURAL_CODE_OPTIONS,
  CONCRETE_GRADE_OPTIONS,
  LONGITUDINAL_DIAMETER_OPTIONS,
  LONGITUDINAL_COUNT_OPTIONS,
  STIRRUP_DIAMETER_OPTIONS,
  STIRRUP_SPACING_OPTIONS,
  STIRRUP_CRITICAL_SPACING_OPTIONS,
  COVER_OPTIONS,
} from '../hooks/bridge/structural-param';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';
import {
  CATALOG_CUSTOM_SENTINEL,
  ISHAPE_CATALOG,
  SHEAR_WALL_CATALOG,
  formatIShapePresetLabel,
} from '../../../bim/columns/section-catalog';

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
  // ADR-363 Phase 2b — Π/κανάλι τοιχείο (channel). Industry-standard parametric
  // section (Tekla/ETABS «Channel»). Composite ΔΕΝ μπαίνει εδώ — μόνο από-περίγραμμα.
  { value: 'U-shape',     labelKey: 'ribbon.commands.columnEditor.kind.uShape',      isLiteralLabel: false },
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

// ADR-363 Phase 2b — U-shape (Π) leg/base thickness presets (RC wall typical, mm).
const U_PLATE_THICKNESS_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '130', labelKey: '130', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
] as const;

// ADR-363 Phase 8E / ADR-409 §C — SSoT: dropdown options GENERATED from the
// section catalog. Adding a preset in `section-catalog.ts` surfaces it here
// automatically — never hand-maintain a parallel list.
const CATALOG_CUSTOM_OPTION: RibbonComboboxOption = {
  value: CATALOG_CUSTOM_SENTINEL,
  labelKey: 'ribbon.commands.columnEditor.catalogProfile.custom',
  isLiteralLabel: false,
};

// Shear-wall RC concrete catalog (Eurocode 2 / EN 1992-1-1). i18n labels —
// contain translatable text ("πάχος"/"thickness").
const SHEAR_WALL_CATALOG_OPTIONS: readonly RibbonComboboxOption[] = [
  CATALOG_CUSTOM_OPTION,
  ...SHEAR_WALL_CATALOG.map((p) => ({ value: p.id, labelKey: p.labelKey, isLiteralLabel: false })),
];

// I-shape steel section catalog (EN 10365 IPE/HEA/HEB/HEM). Literal labels
// derived from the data (code + dims, not translatable).
const ISHAPE_CATALOG_OPTIONS: readonly RibbonComboboxOption[] = [
  CATALOG_CUSTOM_OPTION,
  ...ISHAPE_CATALOG.map((p) => ({ value: p.id, labelKey: formatIShapePresetLabel(p), isLiteralLabel: true })),
];

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
      // ADR-363 Phase 2b — U-shape (Π) manual parametric inputs (leg + base
      // thickness). Visible iff `params.kind === 'U-shape'` ΚΑΙ δεν υπάρχει
      // polygon (polygon-backed → per-vertex grips) via bridge.getPanelVisibility.
      id: 'column-ushape-params',
      labelKey: 'ribbon.panels.columnUshape',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.ushapeParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.legThickness',
                labelKey: 'ribbon.commands.columnEditor.legThickness',
                commandKey: COLUMN_RIBBON_KEYS.params.legThickness,
                comboboxWidthPx: 80,
                options: U_PLATE_THICKNESS_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.baseThickness',
                labelKey: 'ribbon.commands.columnEditor.baseThickness',
                commandKey: COLUMN_RIBBON_KEYS.params.baseThickness,
                comboboxWidthPx: 80,
                options: U_PLATE_THICKNESS_OPTIONS,
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
      // ADR-456 Slice 2 — Στατικά/Οπλισμός: building-level κανονισμός + per-element
      // κατηγορία σκυροδέματος + διαμήκης/εγκάρσιος οπλισμός + επικάλυψη, με κουμπί
      // «Auto οπλισμός» (code-suggested) + live readouts (βάρη/ρ%). Visible μόνο για
      // RC kinds (rectangular/shear-wall) — βλ. getPanelVisibility.
      id: 'column-structural',
      labelKey: 'ribbon.panels.columnStructural',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.structural,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.code',
                labelKey: 'ribbon.commands.columnStructural.code',
                tooltipKey: 'ribbon.commands.columnStructural.codeTooltip',
                commandKey: COLUMN_STRUCTURAL_KEYS.code,
                comboboxWidthPx: 150,
                options: STRUCTURAL_CODE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.concreteGrade',
                labelKey: 'ribbon.commands.columnStructural.concreteGrade',
                commandKey: COLUMN_STRUCTURAL_KEYS.concreteGrade,
                comboboxWidthPx: 110,
                options: CONCRETE_GRADE_OPTIONS,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.structural.auto',
                labelKey: 'ribbon.commands.columnStructural.auto',
                tooltipKey: 'ribbon.commands.columnStructural.autoTooltip',
                icon: 'struct-auto-reinforce',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.autoReinforce,
                action: COLUMN_RIBBON_KEYS_ACTIONS.autoReinforce,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.longitudinalDiameter',
                labelKey: 'ribbon.commands.columnStructural.longitudinalDiameter',
                commandKey: COLUMN_STRUCTURAL_KEYS.longitudinalDiameter,
                comboboxWidthPx: 90,
                options: LONGITUDINAL_DIAMETER_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.longitudinalCount',
                labelKey: 'ribbon.commands.columnStructural.longitudinalCount',
                commandKey: COLUMN_STRUCTURAL_KEYS.longitudinalCount,
                comboboxWidthPx: 80,
                options: LONGITUDINAL_COUNT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.stirrupDiameter',
                labelKey: 'ribbon.commands.columnStructural.stirrupDiameter',
                commandKey: COLUMN_STRUCTURAL_KEYS.stirrupDiameter,
                comboboxWidthPx: 90,
                options: STIRRUP_DIAMETER_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.stirrupSpacing',
                labelKey: 'ribbon.commands.columnStructural.stirrupSpacing',
                commandKey: COLUMN_STRUCTURAL_KEYS.stirrupSpacing,
                comboboxWidthPx: 90,
                options: STIRRUP_SPACING_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.stirrupCriticalSpacing',
                labelKey: 'ribbon.commands.columnStructural.stirrupCriticalSpacing',
                commandKey: COLUMN_STRUCTURAL_KEYS.stirrupCriticalSpacing,
                comboboxWidthPx: 90,
                options: STIRRUP_CRITICAL_SPACING_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.cover',
                labelKey: 'ribbon.commands.columnStructural.cover',
                commandKey: COLUMN_STRUCTURAL_KEYS.cover,
                comboboxWidthPx: 80,
                options: COVER_OPTIONS,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              // Read-only readout — bridge δίνει value, options:[] (μη επεξεργάσιμο).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.concreteWeight',
                labelKey: 'ribbon.commands.columnStructural.concreteWeight',
                commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.concreteWeight,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.steelWeight',
                labelKey: 'ribbon.commands.columnStructural.steelWeight',
                commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.steelWeight,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.structural.ratio',
                labelKey: 'ribbon.commands.columnStructural.ratio',
                commandKey: COLUMN_STRUCTURAL_READOUT_KEYS.ratio,
                comboboxWidthPx: 90,
                options: [],
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-449 Slice 5 — σοβάς (structural finish skin) per-element override:
      // enabled + υλικό εσωτ./εξωτ. + πάχος. Shared SSoT options/helpers με δοκάρι.
      id: 'column-finish-skin',
      labelKey: 'ribbon.panels.columnFinishSkin',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.finish.enabled',
                labelKey: 'ribbon.commands.finishEditor.enabled.section.title',
                commandKey: COLUMN_FINISH_KEYS.enabled,
                comboboxWidthPx: 110,
                options: FINISH_ENABLED_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.finish.interiorMaterialId',
                labelKey: 'ribbon.commands.finishEditor.interiorMaterial',
                commandKey: COLUMN_FINISH_KEYS.interiorMaterialId,
                comboboxWidthPx: 170,
                options: FINISH_MATERIAL_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.finish.exteriorMaterialId',
                labelKey: 'ribbon.commands.finishEditor.exteriorMaterial',
                commandKey: COLUMN_FINISH_KEYS.exteriorMaterialId,
                comboboxWidthPx: 170,
                options: FINISH_MATERIAL_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.finish.thickness',
                labelKey: 'ribbon.commands.finishEditor.thickness',
                commandKey: COLUMN_FINISH_KEYS.thickness,
                comboboxWidthPx: 110,
                options: FINISH_THICKNESS_OPTIONS,
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
      // ADR-401 Phase F.3 — manual «Attach/Detach Top/Base to structural» (Revit
      // parity, mirror του wall panel). Attach buttons activate a pick-host tool
      // (commandKey = ToolType, no `action`); detach buttons fire a bridge action.
      id: 'column-structural-attach',
      labelKey: 'ribbon.panels.columnStructuralAttach',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.attachTop',
                labelKey: 'ribbon.commands.columnEditor.attachTop',
                icon: 'bim-wall-attach-top',
                commandKey: 'column-attach-top',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.attachBase',
                labelKey: 'ribbon.commands.columnEditor.attachBase',
                icon: 'bim-wall-attach-base',
                commandKey: 'column-attach-base',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.detachTop',
                labelKey: 'ribbon.commands.columnEditor.detachTop',
                icon: 'bim-wall-detach',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.detachTop,
                action: COLUMN_RIBBON_KEYS_ACTIONS.detachTop,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'column.detachBase',
                labelKey: 'ribbon.commands.columnEditor.detachBase',
                icon: 'bim-wall-detach',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.detachBase,
                action: COLUMN_RIBBON_KEYS_ACTIONS.detachBase,
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
