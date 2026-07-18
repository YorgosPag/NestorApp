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
} from '../hooks/bridge/column-command-keys';
import { STOREY_RIBBON_KEYS } from '../hooks/bridge/storey-command-keys';
// ADR-363 Phase 4 / Properties-palette split — τα αναλυτικά groups (Στατικά/
// Οπλισμός, Σοβάς, Κέλυφος, Υλικό) μετακινήθηκαν στο docked Properties panel
// (`ui/column-advanced-panel/`). Το ribbon κρατά συχνά + εργαλεία.
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';
import {
  CATALOG_CUSTOM_SENTINEL,
  ISHAPE_CATALOG,
  SHEAR_WALL_CATALOG,
  formatIShapePresetLabel,
} from '../../../bim/columns/section-catalog';
import { literalNumberOptions } from './ribbon-numeric-options';

export const COLUMN_CONTEXTUAL_TRIGGER = 'column-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

// ADR-521 — exported (was const): reused by the structural-tab «Τύποι» dropdown so
// the kind→label mapping lives in ONE place (μηδέν διπλό option list).
export const COLUMN_KIND_OPTIONS = [
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
const POLYGON_SIDES_OPTIONS = literalNumberOptions([3, 4, 5, 6, 7, 8, 10, 12]);

// ADR-363 Phase 8D — I-shape flange thickness presets (IPE/HEA typical range).
const I_FLANGE_THICKNESS_OPTIONS = literalNumberOptions([8, 10, 12, 15, 20, 25, 30]);

// ADR-363 Phase 8D — I-shape web thickness presets (IPE/HEA typical range).
const I_WEB_THICKNESS_OPTIONS = literalNumberOptions([6, 8, 10, 12, 15, 18, 20]);

// ADR-363 Phase 2b — U-shape (Π) leg/base thickness presets (RC wall typical, mm).
const U_PLATE_THICKNESS_OPTIONS = literalNumberOptions([100, 130, 150, 200, 250, 300]);

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

const WIDTH_MM_OPTIONS = literalNumberOptions([250, 300, 400, 500, 600, 800, 1000]);

const DEPTH_MM_OPTIONS = literalNumberOptions([250, 300, 400, 500, 600, 800, 1000]);

const HEIGHT_MM_OPTIONS = literalNumberOptions([2400, 2700, 3000, 3300, 3600, 4000]);

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 15, 30, 45, 60, 90, 135, 180]);

// ADR-404 Φ5 — κεκλιμένη κολώνα: on/off toggle + γωνία (μοίρες από κατακόρυφο, 0..80°,
// editable-free) + φορά (reuse ROTATION_DEG_OPTIONS ως ring 0..180°). Exported ώστε το
// docked Properties panel (`column-property-fields.ts`) να τα κάνει reuse — μηδέν διπλό list.
export const TILT_ENABLED_OPTIONS = [
  { value: 'on',  labelKey: 'ribbon.commands.columnEditor.tilt.on',  isLiteralLabel: false },
  { value: 'off', labelKey: 'ribbon.commands.columnEditor.tilt.off', isLiteralLabel: false },
] as const;

export const TILT_ANGLE_DEG_OPTIONS = literalNumberOptions([0, 5, 10, 15, 20, 30, 45, 60]);

export const TILT_DIRECTION_DEG_OPTIONS = ROTATION_DEG_OPTIONS;

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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
              },
            },
            // ADR-451 Slice 4 — «Ύψος Ορόφου»: γράφει το ύψος του ΕΝΕΡΓΟΥ ορόφου (ΙΔΙΟ
            // SSoT με Κτίρια→Όροφοι). Storey-bound κολώνα ακολουθεί (το διπλανό «Ύψος»
            // είναι read-only/derived). ΟΧΙ column param — storey key.
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'storey.height',
                labelKey: 'ribbon.commands.columnEditor.storeyHeight',
                commandKey: STOREY_RIBBON_KEYS.height,
                comboboxWidthPx: 90,
                options: HEIGHT_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'angle' },
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-404 Φ5 — κεκλιμένη κολώνα (Revit «Slanted Column»). Toggle «Κεκλιμένη»
      // (drawing → slantMode 2-κλικ· selected → params.tilt) + γωνία + φορά κλίσης.
      // Πάντα ορατό (η κλίση αφορά κάθε τύπο διατομής).
      id: 'column-tilt',
      labelKey: 'ribbon.panels.columnTilt',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.tiltEnabled',
                labelKey: 'ribbon.commands.columnEditor.tilt.enabled',
                commandKey: COLUMN_RIBBON_KEYS.stringParams.tiltEnabled,
                comboboxWidthPx: 90,
                options: TILT_ENABLED_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.tiltAngle',
                labelKey: 'ribbon.commands.columnEditor.tilt.angle',
                commandKey: COLUMN_RIBBON_KEYS.params.tiltAngle,
                comboboxWidthPx: 80,
                options: TILT_ANGLE_DEG_OPTIONS,
                numericInput: { quantityKind: 'angle', min: 0, max: 80 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'column.tiltDirection',
                labelKey: 'ribbon.commands.columnEditor.tilt.direction',
                commandKey: COLUMN_RIBBON_KEYS.params.tiltDirection,
                comboboxWidthPx: 80,
                options: TILT_DIRECTION_DEG_OPTIONS,
                numericInput: { quantityKind: 'angle' },
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
                numericInput: { quantityKind: 'count' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
      // ADR-363 Phase 4 / Properties-palette split — lean «Οπλισμός» actions panel.
      // Οι αναλυτικές παράμετροι (κανονισμός/σκυρόδεμα/διαμήκης/συνδετήρες/readouts)
      // ζουν πλέον στο docked Properties panel· εδώ κρατάμε ΜΟΝΟ τις συχνές ενέργειες:
      // show/hide οπλισμού + «Auto οπλισμός». Visible μόνο για RC kinds.
      id: 'column-reinforcement-actions',
      labelKey: 'ribbon.panels.columnStructural',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.structural,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            // ADR-456 Slice 3 — «Οπλισμός» εμφάνιση/απόκρυψη (ίδιο widget με την
            // καρτέλα Προβολή· κοινό per-view flag).
            {
              type: 'widget',
              size: 'small',
              widgetId: 'show-reinforcement-toggle',
              command: {
                id: 'view.reinforcement',
                labelKey: 'ribbon.commands.reinforcement.label',
                icon: '',
                commandKey: 'show-reinforcement-toggle',
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
      ],
    },
    {
      // ADR-457 — «Λεπτομέρεια Οπλισμού»: ανοίγει φύλλο σχεδίου (5 ενότητες) με
      // τον οπλισμό + πλήρη διαστασιολόγηση + εξαγωγή PDF. Visible μόνο για RC
      // kinds (ίδιο gating με το structural panel — οπλισμός υπάρχει μόνο σε RC).
      id: 'column-detail',
      labelKey: 'ribbon.panels.columnDetail',
      visibilityKey: COLUMN_RIBBON_VISIBILITY_KEYS.structural,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'column.reinforcementDetail',
                labelKey: 'ribbon.commands.columnEditor.reinforcementDetail',
                tooltipKey: 'ribbon.commands.columnEditor.reinforcementDetailTooltip',
                icon: 'column-reinforcement-detail',
                commandKey: COLUMN_RIBBON_KEYS_ACTIONS.reinforcementDetail,
                action: COLUMN_RIBBON_KEYS_ACTIONS.reinforcementDetail,
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
