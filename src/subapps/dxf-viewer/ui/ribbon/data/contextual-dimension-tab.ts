/**
 * ADR-362 Phase E2 + ADR-562 Φ4 — Contextual ribbon tab: DIMENSION editor.
 *
 * Appears in the tab bar when the primary selection is a DimensionEntity
 * (`type === 'dimension'`). AutoCAD/Revit pattern: one unified tab for all
 * 10 dimension sub-types (linear, radial, angular, ordinate, etc.).
 *
 * ADR-562 Φ4 — the single «Παράκαμψη» stub panel is split into AutoCAD-grade
 * PER-PART panels, each a ≤3-field column (Revit «Dimension Line / Extension
 * Lines / Arrowheads / Text»). Every per-part control routes through
 * `useRibbonDimBridge` → `entity.overrides` (undoable `UpdateEntityCommand`):
 *
 *   Στυλ            → DIMSTYLE chooser + Apply / Edit / Reset
 *   Γραμμή Διάστ.   → Χρώμα (dimclrd) · Πάχος (dimlwd) · Τύπος (dimltype)
 *   Προεκτάσεις     → Χρώμα (dimclre) · Πάχος (dimlwe) · Τύπος (dimltex1/2)
 *   Βελάκια         → Στυλ (dimblk) · Χρώμα (arrowColor) · Μέγεθος (dimasz)
 *   Κείμενο         → Χρώμα (dimclrt) · Γραμματοσειρά · Ύψος · Θέση · Στροφή · …
 *   Τροποποίηση     → DIMBREAK · DIMSPACE
 *   Ιδιότητες       → Layer · Annotation scale · Properties
 *
 * SSoT reuse (καμία διπλή λίστα): lineweight = `LINEWEIGHT_RIBBON_OPTIONS`
 * (shared)· linetype + arrow-style options = ΚΕΝΑ εδώ, τα τροφοδοτεί live το
 * bridge (`listSelectableLinetypeNames` / `listArrowheadBlockNames`).
 *
 * Trigger token: 'dim-selected' (resolved by `resolveContextualTrigger`
 * in `app/ribbon-contextual-config.ts` when `entity.type === 'dimension'`).
 */

import type { RibbonTab } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS } from '../hooks/bridge/dim-command-keys';
import { LINEWEIGHT_RIBBON_OPTIONS } from './lineweight-ribbon-options';

export const DIMENSION_CONTEXTUAL_TRIGGER = 'dim-selected';

// Static DIMSTYLE presets (E2 stub — Phase F bridges to DimStyleRegistry).
const DIMSTYLE_OPTIONS = [
  { value: 'iso-129',       labelKey: 'ribbon.commands.dimContextual.styleOptions.iso',           isLiteralLabel: false },
  { value: 'asme-y14',      labelKey: 'ribbon.commands.dimContextual.styleOptions.asme',          isLiteralLabel: false },
  { value: 'architectural', labelKey: 'ribbon.commands.dimContextual.styleOptions.architectural', isLiteralLabel: false },
] as const;

// ADR-562 Φ7 — the per-part color controls now use the enterprise color picker
// (`comboboxVariant:'dxf-color'`), so the former ACI `COLOR_OPTIONS` dropdown list
// was removed. The bridge speaks hex ↔ ACI+true-color; the picker ignores `options`.

// ADR-362 — linetype DENSITY presets (dimltscale, Path A). Numeric literals —
// editable (type any value > 0). ×0.5 = πυκνά, ×1 = catalog, ×2 = αραιά.
const LINETYPE_SCALE_OPTIONS = [
  { value: '0.5', labelKey: '0.5', isLiteralLabel: true },
  { value: '0.75', labelKey: '0.75', isLiteralLabel: true },
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '1.5', labelKey: '1.5', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
] as const;

// Arrow size presets (paper mm). Numeric literals — editable (type any value).
const ARROW_SIZE_OPTIONS = [
  { value: '1.5', labelKey: '1.5', isLiteralLabel: true },
  { value: '2.0', labelKey: '2.0', isLiteralLabel: true },
  { value: '2.5', labelKey: '2.5', isLiteralLabel: true },
  { value: '3.5', labelKey: '3.5', isLiteralLabel: true },
  { value: '5.0', labelKey: '5.0', isLiteralLabel: true },
] as const;

// Font-family presets (names are literal — not translatable).
const FONT_OPTIONS = [
  { value: 'Arial',           labelKey: 'Arial',           isLiteralLabel: true },
  { value: 'Roboto',          labelKey: 'Roboto',          isLiteralLabel: true },
  { value: 'Helvetica',       labelKey: 'Helvetica',       isLiteralLabel: true },
  { value: 'Times New Roman', labelKey: 'Times New Roman', isLiteralLabel: true },
  { value: 'Courier New',     labelKey: 'Courier New',     isLiteralLabel: true },
] as const;

// Paper-space text height presets (mm). Numeric literals — not translatable.
const TEXT_HEIGHT_OPTIONS = [
  { value: '2.5',  labelKey: '2.5',  isLiteralLabel: true },
  { value: '3.5',  labelKey: '3.5',  isLiteralLabel: true },
  { value: '5.0',  labelKey: '5.0',  isLiteralLabel: true },
  { value: '7.0',  labelKey: '7.0',  isLiteralLabel: true },
  { value: '10.0', labelKey: '10.0', isLiteralLabel: true },
] as const;

// DIMTAD text-position presets (above / center / below dim line).
const TEXT_POSITION_OPTIONS = [
  { value: 'above',    labelKey: 'ribbon.commands.dimContextual.textPositionOptions.above',    isLiteralLabel: false },
  { value: 'centered', labelKey: 'ribbon.commands.dimContextual.textPositionOptions.centered', isLiteralLabel: false },
  { value: 'below',    labelKey: 'ribbon.commands.dimContextual.textPositionOptions.below',    isLiteralLabel: false },
] as const;

// Text-rotation presets (degrees). Numeric literals — not translatable.
const TEXT_ROTATION_OPTIONS = [
  { value: '0',   labelKey: '0°',   isLiteralLabel: true },
  { value: '15',  labelKey: '15°',  isLiteralLabel: true },
  { value: '30',  labelKey: '30°',  isLiteralLabel: true },
  { value: '45',  labelKey: '45°',  isLiteralLabel: true },
  { value: '90',  labelKey: '90°',  isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
] as const;

const O = DIM_RIBBON_KEYS.override;
// ADR-362 Round 36 — per-part visibility toggle keys («Ορατότητα» panel).
const VIS = DIM_RIBBON_KEYS.visibility;

export const DIMENSION_CONTEXTUAL_TAB: RibbonTab = {
  id: 'dimension',
  labelKey: 'ribbon.tabs.dimension',
  isContextual: true,
  contextualTrigger: DIMENSION_CONTEXTUAL_TRIGGER,
  panels: [
    // (A) Στυλ — DIMSTYLE chooser + apply / edit / reset
    {
      id: 'dim-style',
      labelKey: 'ribbon.panels.dimStyle',
      // Compact single-column stack (Giorgio 2026-07-07): DIMSTYLE chooser on top,
      // Apply / Edit / Reset stacked beneath it — one column instead of two.
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.style.chooser',
                labelKey: 'ribbon.commands.dimStyleChooser',
                commandKey: DIM_RIBBON_KEYS.style.chooser,
                comboboxWidthPx: 160,
                options: DIMSTYLE_OPTIONS,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.style.apply',
                labelKey: 'ribbon.commands.dimApplyStyle',
                icon: 'dim-apply-style',
                commandKey: DIM_RIBBON_KEYS.style.applyStyle,
                action: DIM_RIBBON_KEYS.style.applyStyle,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.style.edit',
                labelKey: 'ribbon.commands.dimEditStyle',
                icon: 'dim-edit-style',
                commandKey: DIM_RIBBON_KEYS.style.editStyle,
                comingSoon: true,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.override.reset',
                labelKey: 'ribbon.commands.dimResetOverrides',
                icon: 'dim-reset-overrides',
                commandKey: O.resetOverrides,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (B) Γραμμή Διάστασης — χρώμα / πάχος / τύπος (ADR-562 Φ4)
    {
      id: 'dim-line',
      labelKey: 'ribbon.panels.dimLine',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.color',
                labelKey: 'ribbon.commands.dimColorOverride',
                commandKey: O.color,
                comboboxWidthPx: 110,
                // ADR-562 Φ7 — enterprise color picker (hex/true-color) instead of the
                // ACI dropdown. Bridge maps hex ↔ ACI+true-color. Options unused here.
                comboboxVariant: 'dxf-color',
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.lineWeight',
                labelKey: 'ribbon.commands.dimLineWeight',
                commandKey: O.lineWeight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_RIBBON_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.lineType',
                labelKey: 'ribbon.commands.dimLineType',
                commandKey: O.lineType,
                comboboxWidthPx: 120,
                // Options supplied live by the bridge (LinetypeRegistry).
                options: [],
              },
            },
          ],
        },
        // ADR-362 — 2η στήλη (Giorgio 2026-07-07 «δεξιά αν δεν χωρούν κάτω»): density
        // + «Νέος τύπος» δεξιά του «Τύπος» → μηδέν κάθετο scroll στη στήλη.
        {
          isInFlyout: false,
          buttons: [
            // Path A — πυκνότητα ΓΡΑΜΜΗΣ ΔΙΑΣΤΑΣΗΣ (dimltscale). Editable > 0.
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.lineTypeScale',
                labelKey: 'ribbon.commands.dimLineTypeScale',
                commandKey: O.lineTypeScale,
                comboboxWidthPx: 80,
                options: LINETYPE_SCALE_OPTIONS,
                numericInput: { editable: true, min: 0 },
              },
            },
            // Path B — «＋ Νέος τύπος» launcher (self-contained widget: opens the
            // Line Pattern editor; the new type appears live in «Τύπος»).
            {
              type: 'widget',
              size: 'small',
              widgetId: 'dim-new-line-pattern',
              command: {
                id: 'dim.override.newLineType',
                labelKey: 'ribbon.commands.dimNewLineType',
                commandKey: O.newLineType,
              },
            },
          ],
        },
      ],
    },
    // (C) Προεκτάσεις — χρώμα / πάχος / τύπος (+ πυκνότητα σε 2η στήλη)
    {
      id: 'dim-ext',
      labelKey: 'ribbon.panels.dimExt',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extColor',
                labelKey: 'ribbon.commands.dimExtColor',
                commandKey: O.extColor,
                comboboxWidthPx: 110,
                comboboxVariant: 'dxf-color', // ADR-562 Φ7 — enterprise color picker
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extWeight',
                labelKey: 'ribbon.commands.dimExtWeight',
                commandKey: O.extWeight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_RIBBON_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extType',
                labelKey: 'ribbon.commands.dimExtType',
                commandKey: O.extType,
                comboboxWidthPx: 120,
                options: [],
              },
            },
          ],
        },
        // ADR-362 — 2η στήλη: πυκνότητα ΒΟΗΘΗΤΙΚΩΝ (dimltexscale), δεξιά του «Τύπος»
        // (ανεξάρτητη από τη γραμμή διάστασης). Giorgio 2026-07-07.
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.extTypeScale',
                labelKey: 'ribbon.commands.dimLineTypeScale',
                commandKey: O.extTypeScale,
                comboboxWidthPx: 80,
                options: LINETYPE_SCALE_OPTIONS,
                numericInput: { editable: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
    // (D) Βελάκια — στυλ / χρώμα / μέγεθος
    {
      id: 'dim-arrow',
      labelKey: 'ribbon.panels.dimArrow',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowStyle',
                labelKey: 'ribbon.commands.dimArrowStyle',
                commandKey: O.arrowStyle,
                comboboxWidthPx: 130,
                // Options supplied live by the bridge (20 arrowhead blocks).
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowColor',
                labelKey: 'ribbon.commands.dimArrowColor',
                commandKey: O.arrowColor,
                comboboxWidthPx: 110,
                comboboxVariant: 'dxf-color', // ADR-562 Φ7 — enterprise color picker
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.arrowSize',
                labelKey: 'ribbon.commands.dimArrowSize',
                commandKey: O.arrowSize,
                comboboxWidthPx: 80,
                options: ARROW_SIZE_OPTIONS,
                // Editable paper-mm size (> 0).
                numericInput: { editable: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
    // (D2) Ορατότητα — ADR-362 Round 36. Per-part show/hide toggles (any combination):
    // βοηθητικές (αρ./δεξ.), κεντρική γραμμή, σημάδια άκρου (αρ./δεξ.). «Πατημένο» =
    // ορατό· γράφει τα `suppress*` overrides μέσω useRibbonDimBridge (AutoCAD-grade
    // per-entity, undoable). Το ΣΧΗΜΑ του σημαδιού μένει στο panel «Βελάκια».
    {
      id: 'dim-visibility',
      labelKey: 'ribbon.panels.dimVisibility',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'dim.visibility.extLine1',
                labelKey: 'ribbon.commands.dimVisibility.extLine1',
                icon: 'dim-visibility',
                commandKey: VIS.extLine1,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'dim.visibility.dimLine',
                labelKey: 'ribbon.commands.dimVisibility.dimLine',
                icon: 'dim-visibility',
                commandKey: VIS.dimLine,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'dim.visibility.extLine2',
                labelKey: 'ribbon.commands.dimVisibility.extLine2',
                icon: 'dim-visibility',
                commandKey: VIS.extLine2,
              },
            },
            // Giorgio 2026-07-07 — τα δύο σημάδια άκρου (αριστ./δεξί) στοιβάζονται
            // κάτω από τη «Δεξιά Βοηθητική» → όλα τα toggles σε μία στήλη.
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'dim.visibility.arrow1',
                labelKey: 'ribbon.commands.dimVisibility.arrow1',
                icon: 'dim-visibility',
                commandKey: VIS.arrow1,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'dim.visibility.arrow2',
                labelKey: 'ribbon.commands.dimVisibility.arrow2',
                icon: 'dim-visibility',
                commandKey: VIS.arrow2,
              },
            },
          ],
        },
      ],
    },
    // (E) Κείμενο — χρώμα / γραμματοσειρά / ύψος / θέση / στροφή / override / mask
    {
      id: 'dim-text',
      labelKey: 'ribbon.panels.dimText',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.textColor',
                labelKey: 'ribbon.commands.dimTextColor',
                commandKey: O.textColor,
                comboboxWidthPx: 110,
                comboboxVariant: 'dxf-color', // ADR-562 Φ7 — enterprise color picker
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.override.textFont',
                labelKey: 'ribbon.commands.dimTextFont',
                commandKey: O.textFont,
                comboboxWidthPx: 130,
                options: FONT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.text.height',
                labelKey: 'ribbon.commands.dimTextHeight',
                commandKey: DIM_RIBBON_KEYS.text.height,
                comboboxWidthPx: 80,
                options: TEXT_HEIGHT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.text.position',
                labelKey: 'ribbon.commands.dimTextPosition',
                commandKey: DIM_RIBBON_KEYS.text.position,
                comboboxWidthPx: 120,
                options: TEXT_POSITION_OPTIONS,
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
                id: 'dim.text.rotation',
                labelKey: 'ribbon.commands.dimTextRotation',
                commandKey: DIM_RIBBON_KEYS.text.rotation,
                comboboxWidthPx: 80,
                options: TEXT_ROTATION_OPTIONS,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.resetPosition',
                labelKey: 'ribbon.commands.dimResetTextPosition',
                icon: 'dim-reset-text-position',
                commandKey: DIM_RIBBON_KEYS.text.resetPosition,
                comingSoon: true,
              },
            },
            // ADR-362 Phase G1 — text override editor
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.override',
                labelKey: 'ribbon.commands.dimTextOverride',
                icon: 'dim-text-override',
                commandKey: DIM_RIBBON_KEYS.text.override,
                action: 'dim.text.override',
              },
            },
            // ADR-362 Phase K3 — DIMTFILL background mask toggle
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.text.tfillToggle',
                labelKey: 'ribbon.commands.dimTfillToggle',
                icon: 'dim-tfill-toggle',
                commandKey: DIM_RIBBON_KEYS.text.tfillToggle,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (F) Τροποποίηση — DIMBREAK + DIMSPACE (ADR-362 Phase K)
    {
      id: 'dim-modify',
      labelKey: 'ribbon.panels.dimModify',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.modify.dimBreak',
                labelKey: 'ribbon.commands.dimBreak',
                icon: 'dim-break',
                commandKey: DIM_RIBBON_KEYS.modify.dimBreak,
                action: DIM_RIBBON_KEYS.modify.dimBreak,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.modify.dimSpace',
                labelKey: 'ribbon.commands.dimSpace',
                icon: 'dim-space',
                commandKey: DIM_RIBBON_KEYS.modify.dimSpace,
                action: DIM_RIBBON_KEYS.modify.dimSpace,
              },
            },
            // ADR-362 — «Επιλογή σειράς»: grow the pick to the whole collinear row.
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.select.row',
                labelKey: 'ribbon.commands.dimSelectRow',
                icon: 'dim-select-row',
                commandKey: DIM_RIBBON_KEYS.modify.selectRow,
                action: DIM_RIBBON_KEYS.modify.selectRow,
              },
            },
            // ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» toggle (self-contained widget
            // that flips DimRowHandleModeStore; live pressed state via useSyncExternalStore).
            // Giorgio 2026-07-07 — stacked below «Επιλογή Σειράς» in the same column.
            {
              type: 'widget',
              size: 'small',
              widgetId: 'dim-row-handles-toggle',
              command: {
                id: 'dim.rowHandles.toggle',
                labelKey: 'ribbon.commands.dimRowHandles.label',
                commandKey: DIM_RIBBON_KEYS.modify.rowHandles,
              },
            },
          ],
        },
      ],
    },
    // (G) Ιδιότητες — layer + annotation scale
    {
      id: 'dim-properties',
      labelKey: 'ribbon.panels.dimProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'dim.properties.layer',
                labelKey: 'ribbon.commands.dimLayer',
                commandKey: DIM_RIBBON_KEYS.properties.layer,
                comboboxWidthPx: 160,
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'annotation-scale',
              command: {
                id: 'dim.properties.annotationScale',
                labelKey: 'ribbon.commands.dimAnnotationScale',
                commandKey: DIM_RIBBON_KEYS.properties.annotationScale,
              },
            },
            // Giorgio 2026-07-07 — «Ιδιότητες» stacked below «Κλίμακα Σχολιασμού».
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.properties.openPanel',
                labelKey: 'ribbon.commands.dimOpenPanel',
                icon: 'dim-open-panel',
                commandKey: DIM_RIBBON_KEYS.properties.openPanel,
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    // (H) Ενέργειες — «Κλείσιμο» + «Διαγραφή» (mirror of the BIM contextual tabs,
    // e.g. «Ιδιότητες Κολώνας»). Close = central deselect+tool-reset SSoT· Delete =
    // canonical undoable delete (via `dim:delete-requested` → useDimensionModify).
    {
      id: 'dim-actions',
      labelKey: 'ribbon.panels.dimActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.actions.close',
                labelKey: 'ribbon.commands.dimContextual.close',
                icon: 'select',
                commandKey: DIM_RIBBON_KEYS.actions.close,
                action: DIM_RIBBON_KEYS.actions.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'dim.actions.delete',
                labelKey: 'ribbon.commands.dimContextual.delete',
                icon: 'trash',
                commandKey: DIM_RIBBON_KEYS.actions.delete,
                action: DIM_RIBBON_KEYS.actions.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
