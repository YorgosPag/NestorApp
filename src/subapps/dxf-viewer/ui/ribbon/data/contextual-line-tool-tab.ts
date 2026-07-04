/**
 * ADR-357 Phase 17 / ADR-510 Φ2E + Φ4 — Contextual ribbon tab for a drawing
 * primitive: draw-time «Quick Style» defaults AND a selected-entity property
 * editor (Revit «διάλεξε → σχεδίασε» + «επίλεξε → επεξεργάσου»).
 *
 * ADR-510 Φ4 — the fields were a single 5-combobox column that forced vertical
 * scrolling. They are now split into AutoCAD-grade panels laid out HORIZONTALLY
 * (each panel = a ≤3-field column → zero scroll):
 *
 *   Γενικά (General)         → Χρώμα · Επίπεδο · Διαφάνεια
 *   Εμφάνιση Γραμμής         → [Τύπος · Πάχος · Κλίμακα] [Πλάτος]
 *   Γεωμετρία (line-only)    → [Μήκος · Γωνία] [Αρχή Χ · Αρχή Υ] [Τέλος Χ · Τέλος Υ] [ΔΧ · ΔΥ]
 *
 * ALL fields are visible inline (Giorgio 2026-07-01): every `RibbonRow` is a
 * NON-flyout column, and the panel body lays its rows out HORIZONTALLY
 * (`.dxf-ribbon-panel-body` = flex-row), so 2-field columns spread sideways with
 * zero vertical scroll AND zero flyout expander — nothing is hidden behind a ▼.
 *
 * ADR-510 Φ4g — the «Τροποποίηση» panel now leads the tab with 5 LARGE modify
 * tools (Trim · Extend · Offset · Fillet · Chamfer, left→right — Revit «Modify»
 * panel). Their numeric parameters no longer crowd that panel: the FILLET radius
 * and the CHAMFER distances/angle live in dedicated «Options Bar» panels that
 * surface ONLY while the matching tool is active (`visibilityKey` → `activeTool`),
 * so the tab stays zero-scroll:
 *
 *   Τροποποίηση              → [Trim] [Extend] [Offset] [Fillet] [Chamfer]  (large)
 *   Επιλογές Συναρμογής*     → Ακτίνα                       (*fillet active only)
 *   Επιλογές Λοξοτομής*      → Απόσταση 1 · Απόσταση 2 · Γωνία (*chamfer active only)
 *
 * Panel-level self-hiding: the Geometry panel is line-only, and the fillet/chamfer
 * option panels are active-tool-only — all via `visibilityKey` → `getPanelVisibility`
 * in `useRibbonLineToolBridge` (active-tool SSoT: `stores/ToolStateStore.ts`).
 *
 * Bridge: `useRibbonLineToolBridge`. Store SSoT: `stores/QuickStyleStore.ts`
 * (draw-defaults) + `UpdateEntityCommand` (selected entity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../hooks/bridge/line-tool-command-keys';
// ADR-357 §G15 / ADR-507 Φ2 — ByLayer + ISO subset, shared SSoT (boy-scout extract).
import { LINEWEIGHT_RIBBON_OPTIONS } from './lineweight-ribbon-options';
// ADR-510 Φ4g — SSoT LARGE tool-button factory (Revit «Modify» flat buttons).
import { toolBtn } from './ribbon-large-button-helpers';

export const LINE_TOOL_CONTEXTUAL_TRIGGER = 'line-tool-active';

// ─── Lineweight options ───────────────────────────────────────────────────────

const LINEWEIGHT_OPTIONS = LINEWEIGHT_RIBBON_OPTIONS;

// ─── Linetype options ─────────────────────────────────────────────────────────
// ADR-510 Φ4b — τις τροφοδοτεί ΖΩΝΤΑΝΑ το bridge (`buildLinetypeRibbonOptions`,
// κοινό SSoT με τις διαστάσεις) με inline-SVG thumbnails· καμία στατική λίστα εδώ.

// ADR-510 Φ4b — το «Χρώμα» πεδίο χρησιμοποιεί πλέον τον κεντρικό dxf-color picker
// (`comboboxVariant:'dxf-color'`), τον ΙΔΙΟ με τις «Ρυθμίσεις DXF» + τις διαστάσεις.
// Ο former ACI `COLOR_OPTIONS` dropdown αφαιρέθηκε — ο picker μιλάει hex, το bridge
// μεταφράζει hex ↔ true-color + πλησιέστερο ACI (καμία στατική λίστα εδώ).

// ─── Linetype scale (CELTSCALE) options ───────────────────────────────────────
// Numeric presets → RibbonCombobox renders an EDITABLE type-to-enter field (the
// list is purely numeric); `numericInput.editable` keeps free typing too.

const LINETYPE_SCALE_OPTIONS = [
  { value: '0.25', labelKey: '0.25', isLiteralLabel: true },
  { value: '0.5',  labelKey: '0.5',  isLiteralLabel: true },
  { value: '1',    labelKey: '1',    isLiteralLabel: true },
  { value: '2',    labelKey: '2',    isLiteralLabel: true },
  { value: '4',    labelKey: '4',    isLiteralLabel: true },
] as const;

// ─── Polyline width options (ADR-510 Φ3d) ─────────────────────────────────────
// Edge-to-edge width in the ACTIVE display unit (default cm). Presets are just
// shortcuts — the field is editable (numericInput), so any value can be typed.
// 0 = hairline. Values chosen to be VISIBLE at the default cm unit (1 cm = 10 mm).

const WIDTH_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '1',  labelKey: '1',  isLiteralLabel: true },
  { value: '2',  labelKey: '2',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
] as const;

// ─── Transparency options (ADR-510 Φ4) ────────────────────────────────────────
// AutoCAD object transparency 0 (opaque) .. 90. Editable integer, presets are
// shortcuts. Draw-defaults show 0.

const TRANSPARENCY_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '75', labelKey: '75', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
] as const;

// ADR-510 Φ4 — editable numeric config for a signed display-unit coordinate/delta.
const COORD_INPUT = { editable: true, allowNegative: true, allowDecimal: true } as const;

// ─── Fillet radius options (ADR-510 Φ4e) ──────────────────────────────────────
// AutoCAD FILLETRAD. Editable (any value typed), presets are shortcuts. 0 = extend.
const FILLET_RADIUS_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
] as const;

// ─── Chamfer distance / angle options (ADR-510 Φ4f) ────────────────────────────
const CHAMFER_DIST_OPTIONS = [
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
] as const;
const CHAMFER_ANGLE_OPTIONS = [
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
] as const;

// ─── Tab definition ───────────────────────────────────────────────────────────

export const CONTEXTUAL_LINE_TOOL_TAB: RibbonTab = {
  id: 'line-tool-style',
  labelKey: 'ribbon.tabs.lineToolStyle',
  isContextual: true,
  contextualTrigger: LINE_TOOL_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Τροποποίηση (Revit «Modify | Lines») ──────────────────────────────────
    // ADR-510 Φ4g — 5 LARGE modify tools (Trim · Extend · Offset · Fillet · Chamfer),
    // αριστερά→δεξιά, στην ΑΡΧΗ της καρτέλας (mirror του Revit «Modify» panel). ΙΔΙΑ
    // command keys ('trim'/'extend'/'offset'/'fillet'/'chamfer') → ο tab-agnostic
    // `routeRibbonAction` τα στέλνει στον ΙΔΙΟ generic handler· μηδέν νέο wiring. Τα
    // μεγάλα κουμπιά = SSoT `toolBtn` (ribbon-large-button-helpers). Οι numeric
    // παράμετροι (fillet radius / chamfer d1·d2·γωνία) ΔΕΝ ζουν εδώ: εμφανίζονται
    // contextually στα δικά τους panels μόλις ενεργοποιηθεί το εργαλείο (Revit
    // «Options Bar») → η καρτέλα μένει ZERO-SCROLL, χωρίς flyout που κρύβει πεδία.
    {
      id: 'line-modify',
      labelKey: 'ribbon.panels.lineModify',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('lineModify.trim', 'ribbon.commands.trim', 'trim', 'trim', 'TR'),
            toolBtn('lineModify.extend', 'ribbon.commands.extend', 'extend', 'extend', 'EX'),
            toolBtn('lineModify.offset', 'ribbon.commands.offset', 'offset', 'offset', 'OF'),
            toolBtn('lineModify.fillet', 'ribbon.commands.fillet', 'fillet', 'fillet', 'F'),
            toolBtn('lineModify.chamfer', 'ribbon.commands.chamfer', 'chamfer', 'chamfer'),
          ],
        },
      ],
    },
    // ── Επιλογές Συναρμογής (Fillet «Options Bar» — ορατό ΜΟΝΟ όταν ενεργό το Fillet) ─
    // ADR-510 Φ4g — FILLET radius (editable numeric· presets 0/5/10/20/50). Οδηγεί τον
    // FilletToolStore μέσω του line-tool bridge (commandKey filletRadius). Το panel
    // αυτο-κρύβεται (`visibilityKey` → activeTool==='fillet') → zero-scroll στη ρίζα.
    {
      id: 'line-fillet-options',
      labelKey: 'ribbon.panels.lineFilletOptions',
      visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.filletOptions,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineModify.filletRadius',
                labelKey: 'ribbon.commands.filletRadius',
                commandKey: LINE_TOOL_RIBBON_KEYS.filletRadius,
                comboboxWidthPx: 80,
                options: FILLET_RADIUS_OPTIONS,
                numericInput: { editable: true, min: 0, allowDecimal: true },
              },
            },
          ],
        },
      ],
    },
    // ── Επιλογές Λοξοτομής (Chamfer «Options Bar» — ορατό ΜΟΝΟ όταν ενεργό το Chamfer) ─
    // ADR-510 Φ4g — CHAMFER distance 1/2 + γωνία → ChamferToolStore (d1/d2/angle). Το
    // panel αυτο-κρύβεται (`visibilityKey` → activeTool==='chamfer').
    {
      id: 'line-chamfer-options',
      labelKey: 'ribbon.panels.lineChamferOptions',
      visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.chamferOptions,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineModify.chamferDist1',
                labelKey: 'ribbon.commands.chamferDist1',
                commandKey: LINE_TOOL_RIBBON_KEYS.chamferDist1,
                comboboxWidthPx: 70,
                options: CHAMFER_DIST_OPTIONS,
                numericInput: { editable: true, min: 0, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineModify.chamferDist2',
                labelKey: 'ribbon.commands.chamferDist2',
                commandKey: LINE_TOOL_RIBBON_KEYS.chamferDist2,
                comboboxWidthPx: 70,
                options: CHAMFER_DIST_OPTIONS,
                numericInput: { editable: true, min: 0, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineModify.chamferAngle',
                labelKey: 'ribbon.commands.chamferAngle',
                commandKey: LINE_TOOL_RIBBON_KEYS.chamferAngle,
                comboboxWidthPx: 70,
                options: CHAMFER_ANGLE_OPTIONS,
                numericInput: { editable: true, min: 0, max: 179, allowDecimal: true },
              },
            },
          ],
        },
      ],
    },
    // ── Γενικά (AutoCAD «General») ────────────────────────────────────────────
    {
      id: 'line-general',
      labelKey: 'ribbon.panels.lineGeneral',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              // ADR-570 Φ1 — «Στυλ Γραμμής ▾» (ByStyle). Options fed live by the
              // bridge from the LineStyleRegistry snapshot.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.lineStyle',
                labelKey: 'ribbon.commands.quickStyle.lineStyle',
                commandKey: LINE_TOOL_RIBBON_KEYS.lineStyle,
                comboboxWidthPx: 150,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.color',
                labelKey: 'ribbon.commands.quickStyle.color',
                commandKey: LINE_TOOL_RIBBON_KEYS.color,
                comboboxWidthPx: 100,
                // ADR-510 Φ4b — κεντρικός dxf-color picker (hex/true-color), όχι ACI dropdown.
                comboboxVariant: 'dxf-color',
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.layer',
                labelKey: 'ribbon.commands.quickStyle.layer',
                commandKey: LINE_TOOL_RIBBON_KEYS.layer,
                comboboxWidthPx: 150,
                // Options come from the bridge (live LayerStore).
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.transparency',
                labelKey: 'ribbon.commands.quickStyle.transparency',
                commandKey: LINE_TOOL_RIBBON_KEYS.transparency,
                comboboxWidthPx: 80,
                options: TRANSPARENCY_OPTIONS,
                numericInput: { editable: true, min: 0, max: 90, allowDecimal: false },
              },
            },
          ],
        },
      ],
    },
    // ── Εμφάνιση Γραμμής (linetype / lineweight / scale + width flyout) ────────
    {
      id: 'line-appearance',
      labelKey: 'ribbon.panels.lineAppearance',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.linetype',
                labelKey: 'ribbon.commands.quickStyle.linetype',
                commandKey: LINE_TOOL_RIBBON_KEYS.linetype,
                comboboxWidthPx: 120,
                // Options + thumbnails τροφοδοτούνται live από το bridge (SSoT).
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.lineweight',
                labelKey: 'ribbon.commands.quickStyle.lineweight',
                commandKey: LINE_TOOL_RIBBON_KEYS.lineweight,
                comboboxWidthPx: 100,
                options: LINEWEIGHT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.linetypeScale',
                labelKey: 'ribbon.commands.quickStyle.linetypeScale',
                commandKey: LINE_TOOL_RIBBON_KEYS.linetypeScale,
                comboboxWidthPx: 80,
                options: LINETYPE_SCALE_OPTIONS,
                // ADR-510 Φ2E #2 — editable numeric (CELTSCALE > 0), Revit-grade.
                numericInput: { editable: true, min: 0.01 },
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
                id: 'lineToolStyle.width',
                labelKey: 'ribbon.commands.quickStyle.width',
                commandKey: LINE_TOOL_RIBBON_KEYS.width,
                comboboxWidthPx: 80,
                options: WIDTH_OPTIONS,
                // ADR-510 Φ3d — editable numeric polyline width (≥ 0, display unit).
                numericInput: { editable: true, min: 0 },
              },
            },
          ],
        },
      ],
    },
    // ── Γεωμετρία (AutoCAD «Geometry», line-only → self-hides otherwise) ───────
    {
      id: 'line-geometry',
      labelKey: 'ribbon.panels.lineGeometry',
      visibilityKey: LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.length',
                labelKey: 'ribbon.commands.quickStyle.length',
                commandKey: LINE_TOOL_RIBBON_KEYS.length,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { editable: true, allowDecimal: true, min: 0.0001 },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.angle',
                labelKey: 'ribbon.commands.quickStyle.angle',
                commandKey: LINE_TOOL_RIBBON_KEYS.angle,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { editable: true, allowNegative: true, allowDecimal: true },
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
                id: 'lineToolStyle.startX',
                labelKey: 'ribbon.commands.quickStyle.startX',
                commandKey: LINE_TOOL_RIBBON_KEYS.startX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.startY',
                labelKey: 'ribbon.commands.quickStyle.startY',
                commandKey: LINE_TOOL_RIBBON_KEYS.startY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
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
                id: 'lineToolStyle.endX',
                labelKey: 'ribbon.commands.quickStyle.endX',
                commandKey: LINE_TOOL_RIBBON_KEYS.endX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.endY',
                labelKey: 'ribbon.commands.quickStyle.endY',
                commandKey: LINE_TOOL_RIBBON_KEYS.endY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
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
                id: 'lineToolStyle.deltaX',
                labelKey: 'ribbon.commands.quickStyle.deltaX',
                commandKey: LINE_TOOL_RIBBON_KEYS.deltaX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'lineToolStyle.deltaY',
                labelKey: 'ribbon.commands.quickStyle.deltaY',
                commandKey: LINE_TOOL_RIBBON_KEYS.deltaY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: COORD_INPUT,
              },
            },
          ],
        },
      ],
    },
  ],
};
