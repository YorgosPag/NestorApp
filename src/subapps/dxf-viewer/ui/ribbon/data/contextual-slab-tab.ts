/**
 * ADR-363 Phase 3 — Contextual ribbon tab για slab editor.
 *
 * Trigger: `slab-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'slab'`, OR activeTool === 'slab').
 *
 * Panels (Phase 3 — minimal):
 *   Kind      → kind combobox (5 τύποι) + reinforcement
 *   Geometry  → thickness (mm) + elevation (mm)
 *   Actions   → close + delete
 *
 * Live behavior: bridge (`useRibbonSlabBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useSlabPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  SLAB_RIBBON_KEYS,
  SLAB_RIBBON_KEYS_ACTIONS,
  SLAB_RIBBON_BADGE_KEYS,
  SLAB_STRUCTURAL_VISIBILITY_KEYS,
} from '../hooks/bridge/slab-command-keys';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';
// ADR-404 Phase 5c — κεκλιμένη/ρύση πλάκα: option sentinels (SSoT, reused από τον resolver).
import { SLOPE_ENABLED_ON, SLOPE_ENABLED_OFF } from '../hooks/bridge/slab-slope-param';
import {
  SLAB_SLOPE_UNIT_DEGREES,
  SLAB_SLOPE_UNIT_PERCENT,
  SLAB_SLOPE_UNIT_RATIO,
} from '../hooks/bridge/slab-slope-unit';

export const SLAB_CONTEXTUAL_TRIGGER = 'slab-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const SLAB_KIND_OPTIONS = [
  { value: 'floor',      labelKey: 'ribbon.commands.slabEditor.kind.floor',      isLiteralLabel: false },
  { value: 'ceiling',    labelKey: 'ribbon.commands.slabEditor.kind.ceiling',    isLiteralLabel: false },
  { value: 'roof',       labelKey: 'ribbon.commands.slabEditor.kind.roof',       isLiteralLabel: false },
  { value: 'ground',     labelKey: 'ribbon.commands.slabEditor.kind.ground',     isLiteralLabel: false },
  { value: 'foundation', labelKey: 'ribbon.commands.slabEditor.kind.foundation', isLiteralLabel: false },
] as const;

const REINFORCEMENT_OPTIONS = [
  { value: 'one-way', labelKey: 'ribbon.commands.slabEditor.reinforcement.oneWay', isLiteralLabel: false },
  { value: 'two-way', labelKey: 'ribbon.commands.slabEditor.reinforcement.twoWay', isLiteralLabel: false },
  { value: 'waffle',  labelKey: 'ribbon.commands.slabEditor.reinforcement.waffle', isLiteralLabel: false },
  { value: 'flat',    labelKey: 'ribbon.commands.slabEditor.reinforcement.flat',   isLiteralLabel: false },
] as const;

const THICKNESS_MM_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
] as const;

// ADR-363 Phase 4.5e-A — slab material picker (ENABLED). 3 preset options.
// Phase 6.5 material library will expand to full catalog.
const SLAB_MATERIAL_OPTIONS = [
  { value: 'rc',        labelKey: 'ribbon.commands.slabEditor.material.rc',        isLiteralLabel: false },
  { value: 'composite', labelKey: 'ribbon.commands.slabEditor.material.composite', isLiteralLabel: false },
  { value: 'wood',      labelKey: 'ribbon.commands.slabEditor.material.wood',      isLiteralLabel: false },
] as const;

// ADR-534 Φ4 — φινίρισμα παρειάς οροφής (soffit finish). Curated subset του shared paint/plaster
// catalog (μπογιές + σοβάς + σπατουλαριστό + γυψοσανίδα)· '' = χωρίς finish (raw σκυρόδεμα).
const SOFFIT_FINISH_OPTIONS = [
  { value: '',                    labelKey: 'ribbon.commands.slabEditor.soffitFinish.none', isLiteralLabel: false },
  { value: 'paint-white',         labelKey: 'wallCovering.materials.paintWhite',            isLiteralLabel: false },
  { value: 'paint-blue',          labelKey: 'wallCovering.materials.paintBlue',             isLiteralLabel: false },
  { value: 'paint-yellow',        labelKey: 'wallCovering.materials.paintYellow',           isLiteralLabel: false },
  { value: 'paint-red',           labelKey: 'wallCovering.materials.paintRed',              isLiteralLabel: false },
  { value: 'paint-green',         labelKey: 'wallCovering.materials.paintGreen',            isLiteralLabel: false },
  { value: 'plaster-traditional', labelKey: 'wallCovering.materials.plasterTraditional',    isLiteralLabel: false },
  { value: 'plaster-spackle',     labelKey: 'wallCovering.materials.plasterSpackle',        isLiteralLabel: false },
  { value: 'knauf-gypsum-board',  labelKey: 'wallCovering.materials.knaufGypsumBoard',      isLiteralLabel: false },
] as const;

const ELEVATION_MM_OPTIONS = [
  { value: '-500', labelKey: '-500', isLiteralLabel: true },
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
  { value: '2800', labelKey: '2800', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '6000', labelKey: '6000', isLiteralLabel: true },
] as const;

// ─── ADR-404 Phase 5c — κεκλιμένη/ρύση πλάκα (Sloped slab) ────────────────────
// on/off + μονάδα (%/μοίρες/λόγος) + τιμή + φορά° (ελεύθερη) + άξονας. Το angle
// αποθηκεύεται ΠΑΝΤΑ ως % (η μονάδα είναι display pref· numericInput-safe values).
const SLAB_SLOPE_ENABLED_OPTIONS = [
  { value: SLOPE_ENABLED_ON,  labelKey: 'ribbon.commands.slabEditor.slope.on',  isLiteralLabel: false },
  { value: SLOPE_ENABLED_OFF, labelKey: 'ribbon.commands.slabEditor.slope.off', isLiteralLabel: false },
] as const;

const SLAB_SLOPE_UNIT_OPTIONS = [
  { value: SLAB_SLOPE_UNIT_PERCENT, labelKey: 'ribbon.commands.slabEditor.slope.unitPercent', isLiteralLabel: false },
  { value: SLAB_SLOPE_UNIT_DEGREES, labelKey: 'ribbon.commands.slabEditor.slope.unitDegrees', isLiteralLabel: false },
  { value: SLAB_SLOPE_UNIT_RATIO,   labelKey: 'ribbon.commands.slabEditor.slope.unitRatio',   isLiteralLabel: false },
] as const;

// Παρουσιαζόμενα presets σε όρους % (drainage συνηθισμένα)· numericInput δέχεται ό,τι αξία.
const SLAB_SLOPE_ANGLE_OPTIONS = [
  { value: '1',  labelKey: '1',  isLiteralLabel: true },
  { value: '2',  labelKey: '2',  isLiteralLabel: true },
  { value: '3',  labelKey: '3',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
] as const;

// Φορά «ανηφόρας» σε μοίρες CCW (0=Αν, 90=Β, 180=Δ, 270=Ν)· numericInput ελεύθερη 0..360.
const SLAB_SLOPE_DIRECTION_OPTIONS = [
  { value: '0',   labelKey: '0',   isLiteralLabel: true },
  { value: '90',  labelKey: '90',  isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
] as const;

const SLAB_SLOPE_PIVOT_OPTIONS = [
  { value: 'center', labelKey: 'ribbon.commands.slabEditor.slope.pivotCenter', isLiteralLabel: false },
  { value: 'N',      labelKey: 'ribbon.commands.slabEditor.slope.pivotN',      isLiteralLabel: false },
  { value: 'S',      labelKey: 'ribbon.commands.slabEditor.slope.pivotS',      isLiteralLabel: false },
  { value: 'E',      labelKey: 'ribbon.commands.slabEditor.slope.pivotE',      isLiteralLabel: false },
  { value: 'W',      labelKey: 'ribbon.commands.slabEditor.slope.pivotW',      isLiteralLabel: false },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_SLAB_TAB: RibbonTab = {
  id: 'slab-editor',
  labelKey: 'ribbon.tabs.slabProperties',
  isContextual: true,
  contextualTrigger: SLAB_CONTEXTUAL_TRIGGER,
  badgeKey: SLAB_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      // ADR-412 — Slab Family Type: pick/assign the composite type + open the
      // «Edit Slab Type» dialog (layers + live 3D preview). Self-hides for
      // untyped slabs via the widget. Mirrors the wall «Τύπος» panel.
      id: 'slab-family-type',
      labelKey: 'ribbon.panels.slabType',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'slab-family-type',
              command: {
                id: 'slab.familyType',
                labelKey: 'ribbon.commands.slabFamilyType.type',
                commandKey: 'slab.familyType',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-kind',
      labelKey: 'ribbon.panels.slabKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.kind',
                labelKey: 'ribbon.commands.slabEditor.kind.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: SLAB_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.reinforcement',
                labelKey: 'ribbon.commands.slabEditor.reinforcement.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.reinforcement,
                comboboxWidthPx: 130,
                options: REINFORCEMENT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-geometry',
      labelKey: 'ribbon.panels.slabGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.thickness',
                labelKey: 'ribbon.commands.slabEditor.thickness',
                commandKey: SLAB_RIBBON_KEYS.params.thickness,
                comboboxWidthPx: 80,
                options: THICKNESS_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.levelElevation',
                labelKey: 'ribbon.commands.slabEditor.levelElevation',
                commandKey: SLAB_RIBBON_KEYS.params.levelElevation,
                comboboxWidthPx: 90,
                options: ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-404 Phase 5c — κεκλιμένη/ρύση πλάκα (Revit «Sloped slab / slope arrow»).
      // Toggle «Κεκλιμένη» (drawing → born-sloped overrides· selected → params.slope) +
      // μονάδα + τιμή + φορά° + άξονας. Πάντα ορατό. Logic SSoT = slab-slope-param.
      id: 'slab-slope',
      labelKey: 'ribbon.panels.slabSlope',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.slopeEnabled',
                labelKey: 'ribbon.commands.slabEditor.slope.enabled',
                commandKey: SLAB_RIBBON_KEYS.slope.enabled,
                comboboxWidthPx: 90,
                options: SLAB_SLOPE_ENABLED_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.slopeUnit',
                labelKey: 'ribbon.commands.slabEditor.slope.unit',
                commandKey: SLAB_RIBBON_KEYS.slope.unit,
                comboboxWidthPx: 120,
                options: SLAB_SLOPE_UNIT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.slopeAngle',
                labelKey: 'ribbon.commands.slabEditor.slope.angle',
                commandKey: SLAB_RIBBON_KEYS.slope.angle,
                comboboxWidthPx: 80,
                options: SLAB_SLOPE_ANGLE_OPTIONS,
                numericInput: { min: 0, max: 1000 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.slopeDirection',
                labelKey: 'ribbon.commands.slabEditor.slope.direction',
                commandKey: SLAB_RIBBON_KEYS.slope.direction,
                comboboxWidthPx: 80,
                options: SLAB_SLOPE_DIRECTION_OPTIONS,
                numericInput: { min: 0, max: 360 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.slopePivot',
                labelKey: 'ribbon.commands.slabEditor.slope.pivot',
                commandKey: SLAB_RIBBON_KEYS.slope.pivot,
                comboboxWidthPx: 100,
                options: SLAB_SLOPE_PIVOT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-material',
      labelKey: 'ribbon.panels.slabMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.material',
                labelKey: 'ribbon.commands.slabEditor.material.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 180,
                options: SLAB_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-534 Φ4 — «Φινίρισμα οροφής» (soffit finish): μπογιά/σοβάς/σπατουλαριστό στην κάτω
      // παρειά. Visible ΜΟΝΟ σε kind='ceiling' (reflected ceiling plan). Reuse shared catalog.
      id: 'slab-soffit-finish',
      labelKey: 'ribbon.panels.slabSoffitFinish',
      visibilityKey: SLAB_STRUCTURAL_VISIBILITY_KEYS.ceilingFinish,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.soffitFinish',
                labelKey: 'ribbon.commands.slabEditor.soffitFinish.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.soffitFinish,
                comboboxWidthPx: 180,
                options: SOFFIT_FINISH_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-476 — δομοστατικά: show/hide οπλισμού (κοινό per-view flag/widget με την
      // καρτέλα Προβολή· default OFF) + «Αυτόματος Οπλισμός». Visible μόνο για RC πλάκα.
      id: 'slab-reinforcement-actions',
      labelKey: 'ribbon.panels.slabStructural',
      visibilityKey: SLAB_STRUCTURAL_VISIBILITY_KEYS.structural,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'show-reinforcement-toggle',
              command: {
                id: 'view.reinforcement.slab',
                labelKey: 'ribbon.commands.reinforcement.label',
                icon: '',
                commandKey: 'show-reinforcement-toggle',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.structural.auto',
                labelKey: 'ribbon.commands.autoReinforceOrganism',
                tooltipKey: 'ribbon.tooltips.autoReinforceOrganism',
                icon: 'struct-auto-reinforce',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.autoReinforce,
                action: SLAB_RIBBON_KEYS_ACTIONS.autoReinforce,
              },
            },
            {
              // ADR-476 Slice 5 — «Λεπτομέρεια Οπλισμού»: φύλλο σχεδίου (κάτοψη/τομή/3Δ/στοιχεία) + PDF.
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.structural.reinforcementDetail',
                labelKey: 'ribbon.commands.slabStructural.reinforcementDetail',
                tooltipKey: 'ribbon.commands.slabStructural.reinforcementDetailTooltip',
                icon: 'column-reinforcement-detail',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.reinforcementDetail,
                action: SLAB_RIBBON_KEYS_ACTIONS.reinforcementDetail,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'slab.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-actions',
      labelKey: 'ribbon.panels.slabActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.close',
                labelKey: 'ribbon.commands.slabEditor.close',
                icon: 'select',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.close,
                action: SLAB_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.delete',
                labelKey: 'ribbon.commands.slabEditor.delete',
                icon: 'trash',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.delete,
                action: SLAB_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
