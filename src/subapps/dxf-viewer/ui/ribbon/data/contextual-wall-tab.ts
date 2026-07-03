/**
 * ADR-363 Phase 1 — Contextual ribbon tab για τον Wall editor.
 *
 * Trigger: `wall-selected` (dispatched by `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'wall'`, OR ο active tool === 'wall').
 *
 * Panels (Phase 1 — minimal):
 *   Category  → category combobox (5 τύποι: exterior/interior/partition/parapet/fence)
 *               + flip toggle (εξωτερική όψη)
 *   Geometry  → height (mm) + thickness (read-only display όταν DNA set)
 *   Actions   → close
 *
 * Live behavior: bridge (`useRibbonWallBridge`, Phase 1.5) dispatches
 * `UpdateWallParamsCommand` σε κάθε combobox change. Phase 1 emits the events
 * αλλά δεν υπάρχει listener — wall update operations land Phase 1.5.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.9
 */

import type { RibbonTab } from '../types/ribbon-types';
// ADR-443 §wall-entry-split — τα εργαλεία τοίχου (πρώην στο permanent «Δομικά» tab)
// φιλοξενούνται εδώ ως LARGE buttons· κοινοί helpers (SSoT) με το structural-tab.
import { toolBtn, actionVariant, splitActionBtn } from './ribbon-large-button-helpers';
import {
  WALL_RIBBON_KEYS,
  WALL_RIBBON_KEYS_ACTIONS,
  WALL_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/wall-command-keys';
import { ENVELOPE_FUNCTION_OPTIONS } from '../hooks/bridge/envelope-function-param';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';
// ADR-404 Phase 5b — κεκλιμένος τοίχος: option-value sentinels (SSoT με τον resolver).
import {
  TILT_ENABLED_ON,
  TILT_ENABLED_OFF,
  TILT_SIDE_LEFT,
  TILT_SIDE_RIGHT,
} from '../hooks/bridge/wall-tilt-param';

export const WALL_CONTEXTUAL_TRIGGER = 'wall-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const WALL_CATEGORY_OPTIONS = [
  { value: 'exterior',  labelKey: 'ribbon.commands.wallEditor.category.exterior',  isLiteralLabel: false },
  { value: 'interior',  labelKey: 'ribbon.commands.wallEditor.category.interior',  isLiteralLabel: false },
  { value: 'partition', labelKey: 'ribbon.commands.wallEditor.category.partition', isLiteralLabel: false },
  { value: 'parapet',   labelKey: 'ribbon.commands.wallEditor.category.parapet',   isLiteralLabel: false },
  { value: 'fence',     labelKey: 'ribbon.commands.wallEditor.category.fence',     isLiteralLabel: false },
] as const;

const FLIP_OPTIONS = [
  { value: 'false', labelKey: 'ribbon.commands.wallEditor.flip.off', isLiteralLabel: false },
  { value: 'true',  labelKey: 'ribbon.commands.wallEditor.flip.on',  isLiteralLabel: false },
] as const;

// ADR-363 Phase 4.5e-B — wall material picker options (ENABLED).
// Real activation lands with WallDna Phase 1D (composable wall layer stack with
// per-layer material). Until then the combobox is greyed out and clicks fire
// the shared `onComingSoon` toast.
const WALL_MATERIAL_OPTIONS = [
  { value: 'rc',                labelKey: 'ribbon.commands.wallEditor.material.rc',               isLiteralLabel: false },
  { value: 'masonry',           labelKey: 'ribbon.commands.wallEditor.material.masonry',          isLiteralLabel: false },
  { value: 'aerated-concrete',  labelKey: 'ribbon.commands.wallEditor.material.aeratedConcrete',  isLiteralLabel: false },
  { value: 'gypsum',            labelKey: 'ribbon.commands.wallEditor.material.gypsum',           isLiteralLabel: false },
] as const;

// ADR-404 Phase 5b — κεκλιμένος (battered) τοίχος: on/off + γωνία (μέγεθος 0..80°) +
// πλευρά. Ο τοίχος είναι 1-DOF (lean ⟂ run)· δεν υπάρχει «φορά» όπως στην κολώνα.
const WALL_TILT_ENABLED_OPTIONS = [
  { value: TILT_ENABLED_ON,  labelKey: 'ribbon.commands.wallEditor.tilt.on',  isLiteralLabel: false },
  { value: TILT_ENABLED_OFF, labelKey: 'ribbon.commands.wallEditor.tilt.off', isLiteralLabel: false },
] as const;

const WALL_TILT_ANGLE_DEG_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
] as const;

const WALL_TILT_SIDE_OPTIONS = [
  { value: TILT_SIDE_LEFT,  labelKey: 'ribbon.commands.wallEditor.tilt.left',  isLiteralLabel: false },
  { value: TILT_SIDE_RIGHT, labelKey: 'ribbon.commands.wallEditor.tilt.right', isLiteralLabel: false },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_WALL_TAB: RibbonTab = {
  id: 'wall-editor',
  labelKey: 'ribbon.tabs.wallProperties',
  isContextual: true,
  contextualTrigger: WALL_CONTEXTUAL_TRIGGER,
  badgeKey: WALL_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      // ADR-443 §wall-entry-split — «Εργαλεία τοίχου» (Revit «Modify | Place Wall»):
      // ΟΛΑ τα εργαλεία σχεδίασης τοίχου ως LARGE buttons, μεταφερμένα από το permanent
      // «Δομικά» tab (που κρατά πλέον μόνο το entry-point «Τοίχος»). Ίδια tool ids /
      // labelKeys / icons / actions — μηδέν νέα command semantics. Πρώτο panel (leftmost),
      // πριν το «Draw Options Bar», όπως τα placement tools στο Revit contextual tab.
      id: 'wall-tools',
      labelKey: 'ribbon.panels.wallTools',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.wallOnEntity', 'ribbon.commands.bim.wallOnEntity.label', 'struct-wall-on-entity', 'wall-on-entity'),
            toolBtn('structuralTab.wallRegionLines', 'ribbon.commands.bim.wallRegionLines.label', 'struct-wall-region-lines', 'wall-region-lines'),
            toolBtn('structuralTab.wallRegionInside', 'ribbon.commands.bim.wallRegionInside.label', 'struct-wall-region-inside', 'wall-region-inside'),
            toolBtn('structuralTab.wallRegionBox', 'ribbon.commands.bim.wallRegionBox.label', 'struct-wall-region-box', 'wall-region-box'),
            toolBtn('structuralTab.wallFromPerimeter', 'ribbon.commands.bim.wallFromPerimeter.label', 'struct-wall-from-perimeter', 'wall-from-perimeter'),
            // ADR-441 Slice GEN-WALL / 3-mode — «Τοίχοι από κάναβο»: split-button· main =
            // inner (default), dropdown = Wall Location Line (Εσωτερικά/Κεντρικά/Εξωτερικά).
            splitActionBtn(
              'structuralTab.wallsFromGrid',
              'ribbon.commands.bim.wallsFromGrid.label',
              'struct-wall-from-grid',
              'wall.actions.fromGrid',
              [
                actionVariant('structuralTab.wallsFromGridInner', 'ribbon.commands.bim.wallsFromGridInner.label', 'struct-wall-from-grid', 'wall.actions.fromGrid'),
                actionVariant('structuralTab.wallsFromGridCenter', 'ribbon.commands.bim.wallsFromGridCenter.label', 'struct-wall-from-grid', 'wall.actions.fromGridCenter'),
                actionVariant('structuralTab.wallsFromGridOuter', 'ribbon.commands.bim.wallsFromGridOuter.label', 'struct-wall-from-grid', 'wall.actions.fromGridOuter'),
              ],
            ),
          ],
        },
      ],
    },
    {
      // ADR-565 §12 / Φ1.x — «Draw Options Bar» (Revit «Draw» panel): επιλογέας τρόπου
      // σχεδίασης (Ευθύς / Καμπύλος×4 / Πολυγραμμή) ως σειρά εικονιδίων. Πρώτο panel,
      // όπως στο Revit. Custom widget (`RibbonWallDrawModeWidget`) — reactive στο active FSM.
      id: 'wall-draw',
      labelKey: 'ribbon.panels.wallDraw',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'wall-draw-mode',
              command: {
                id: 'wall.drawMode',
                labelKey: 'ribbon.commands.wallEditor.drawMode.section',
                commandKey: 'wall.drawMode.field',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-category',
      labelKey: 'ribbon.panels.wallCategory',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.category',
                labelKey: 'ribbon.commands.wallEditor.category.section.title',
                commandKey: WALL_RIBBON_KEYS.stringParams.category,
                comboboxWidthPx: 140,
                options: WALL_CATEGORY_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.flip',
                labelKey: 'ribbon.commands.wallEditor.flip.section.title',
                commandKey: WALL_RIBBON_KEYS.toggles.flip,
                comboboxWidthPx: 100,
                options: FLIP_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-412 Φ4 — BIM Family Type: selector (Radix Select, ADR-001) +
      // per-instance override editor. Selector assigns/detaches the wall's
      // `typeId`; properties widget edits overrides + renames user types.
      id: 'wall-family-type',
      labelKey: 'ribbon.panels.wallFamilyType',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'wall-family-type',
              command: {
                id: 'wall.familyType',
                labelKey: 'ribbon.commands.bimFamilyType.label',
                commandKey: 'wall.familyType.select',
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'wall-type-properties',
              command: {
                id: 'wall.typeProperties',
                labelKey: 'ribbon.commands.bimFamilyType.properties',
                commandKey: 'wall.familyType.properties',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-geometry',
      labelKey: 'ribbon.panels.wallGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              // Editable height (meters) — typing (. or ,) + preset dropdown +
              // steppers + real-time commit. RibbonWallDimensionWidget SSoT.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-height',
              command: {
                id: 'wall.height',
                labelKey: 'ribbon.commands.wallEditor.height',
                commandKey: 'wall.height.field',
              },
            },
            {
              // Editable thickness (meters) — same widget as height.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-thickness',
              command: {
                id: 'wall.thickness',
                labelKey: 'ribbon.commands.wallEditor.thickness',
                commandKey: 'wall.thickness.field',
              },
            },
            {
              // Editable axis length (meters). Read = computed geometry length;
              // commit moves the end endpoint along the axis (Revit location-line
              // length edit). Free-form (no preset dropdown), straight-only.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-length',
              command: {
                id: 'wall.length',
                labelKey: 'ribbon.commands.wallEditor.length',
                commandKey: 'wall.length.field',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-404 Phase 5b — κεκλιμένος (battered) τοίχος (Revit «Slanted wall»). Toggle
      // «Κεκλιμένος» (drawing → born-tilted overrides· selected → params.tilt) + γωνία
      // (μέγεθος 0..80°) + πλευρά. Πάντα ορατό (η κλίση αφορά κάθε κατηγορία τοίχου).
      id: 'wall-tilt',
      labelKey: 'ribbon.panels.wallTilt',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.tiltEnabled',
                labelKey: 'ribbon.commands.wallEditor.tilt.enabled',
                commandKey: WALL_RIBBON_KEYS.tilt.enabled,
                comboboxWidthPx: 90,
                options: WALL_TILT_ENABLED_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.tiltAngle',
                labelKey: 'ribbon.commands.wallEditor.tilt.angle',
                commandKey: WALL_RIBBON_KEYS.tilt.angle,
                comboboxWidthPx: 80,
                options: WALL_TILT_ANGLE_DEG_OPTIONS,
                numericInput: { min: 0, max: 80 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.tiltSide',
                labelKey: 'ribbon.commands.wallEditor.tilt.side',
                commandKey: WALL_RIBBON_KEYS.tilt.side,
                comboboxWidthPx: 100,
                options: WALL_TILT_SIDE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 1L-J — explicit wall-join override (Revit «Wall Joins»). Two
      // dropdowns (start / end endpoint): Auto / Miter / Butt / Square / Disallow.
      // Custom widget — writes startJoin/endJoin via UpdateWallParamsCommand then
      // triggers the retrim effect. Straight-only (self-hides otherwise).
      id: 'wall-joins',
      labelKey: 'ribbon.panels.wallJoins',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'wall-joins',
              command: {
                id: 'wall.joins',
                labelKey: 'ribbon.panels.wallJoins',
                commandKey: 'wall.joins.field',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 4.5e-B — wall material picker (ENABLED). Wired to wall-level
      // hatch; DNA-bearing walls ignore this field (per-layer DNA rendering governs).
      id: 'wall-material',
      labelKey: 'ribbon.panels.wallMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.material',
                labelKey: 'ribbon.commands.wallEditor.material.section.title',
                tooltipKey: 'ribbon.commands.wallEditor.material.tooltip',
                commandKey: WALL_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 200,
                options: WALL_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-396 v2 Φ6a — ETICS θερμοπρόσοψη: per-element override της αυτόματης
      // ταξινόμησης κελύφους (auto / εξωτερικό / εσωτερικό), Revit Wall-Function.
      id: 'wall-envelope',
      labelKey: 'ribbon.panels.envelopeFunction',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.envelopeFunction',
                labelKey: 'ribbon.commands.envelopeFunction.section.title',
                tooltipKey: 'ribbon.commands.envelopeFunction.tooltip',
                commandKey: WALL_RIBBON_KEYS.stringParams.envelopeFunction,
                comboboxWidthPx: 150,
                options: ENVELOPE_FUNCTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'wall.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-401 Phase E.1 — manual «Attach/Detach Top/Base to structural» (Revit
      // parity). Attach buttons activate a pick-host tool (commandKey = ToolType,
      // no `action`); detach buttons fire a bridge action on the selected walls.
      id: 'wall-structural-attach',
      labelKey: 'ribbon.panels.wallStructuralAttach',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.attachTop',
                labelKey: 'ribbon.commands.wallEditor.attachTop',
                icon: 'bim-wall-attach-top',
                commandKey: 'wall-attach-top',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.attachBase',
                labelKey: 'ribbon.commands.wallEditor.attachBase',
                icon: 'bim-wall-attach-base',
                commandKey: 'wall-attach-base',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.detachTop',
                labelKey: 'ribbon.commands.wallEditor.detachTop',
                icon: 'bim-wall-detach',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.detachTop,
                action: WALL_RIBBON_KEYS_ACTIONS.detachTop,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.detachBase',
                labelKey: 'ribbon.commands.wallEditor.detachBase',
                icon: 'bim-wall-detach',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.detachBase,
                action: WALL_RIBBON_KEYS_ACTIONS.detachBase,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-actions',
      labelKey: 'ribbon.panels.wallActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.split',
                labelKey: 'ribbon.commands.wallEditor.split',
                icon: 'bim-wall-split',
                commandKey: 'wall-split',
              },
            },
            {
              // ADR-566 — «Ένωση Τοίχων» (AutoCAD JOIN για τοίχους). Tool button
              // (commandKey, χωρίς action) → onToolChange('wall-merge'). Δουλεύει
              // ΚΑΙ command-first (πάτα→κλικ 2 τοίχους) ΚΑΙ selection-first
              // (επίλεξε 2→πάτα). Αντίστροφο του wall.split, δίπλα του.
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.merge',
                labelKey: 'ribbon.commands.wallEditor.merge',
                icon: 'bim-wall-merge',
                commandKey: 'wall-merge',
              },
            },
            {
              // ADR-568 — «Γεφύρωση με Κούφωμα». Αδελφό του wall.merge: ενώνει 2
              // ομοαξονικούς τοίχους με ΚΕΝΟ σε έναν τοίχο + τοποθετεί αυτόματα
              // κούφωμα (πόρτα) στο κενό. Tool button (commandKey, χωρίς action).
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.gapOpening',
                labelKey: 'ribbon.commands.wallEditor.gapOpening',
                icon: 'bim-wall-gap-opening',
                commandKey: 'wall-gap-opening',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.close',
                labelKey: 'ribbon.commands.wallEditor.close',
                icon: 'select',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.close,
                action: WALL_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.delete',
                labelKey: 'ribbon.commands.wallEditor.delete',
                icon: 'trash',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.delete,
                action: WALL_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
