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
// ADR-583 / CHECK 3.28 — SSoT builder for literal-number combobox ladders (kills the
// hand-written `{ value, labelKey, isLiteralLabel }` clone across the preset arrays).
import { literalNumberOptions } from './ribbon-numeric-options';

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

// ─── ADR-510 Φ2E #5 — CELTSCALE / width / transparency / coordinate specs MOVED ──
// The per-object linetype-scale, polyline width, transparency and geometry
// (coordinate/delta) fields no longer live in this contextual ribbon tab: they
// migrated to the left Properties palette (AutoCAD-grade split — Ribbon = tools +
// quick draw-defaults; palette = the selected object's full truth). Their option
// ladders + numeric configs now live in `ui/line-advanced-panel/line-property-fields.ts`.

// ─── Fillet radius options (ADR-510 Φ4e) ──────────────────────────────────────
// AutoCAD FILLETRAD. Editable (any value typed), presets are shortcuts. 0 = extend.
const FILLET_RADIUS_OPTIONS = literalNumberOptions(['0', '5', '10', '20', '50']);

// ─── Chamfer distance / angle options (ADR-510 Φ4f) ────────────────────────────
const CHAMFER_DIST_OPTIONS = literalNumberOptions(['5', '10', '20', '50']);
const CHAMFER_ANGLE_OPTIONS = literalNumberOptions(['15', '30', '45', '60']);

// ─── Tab definition ───────────────────────────────────────────────────────────

export const CONTEXTUAL_LINE_TOOL_TAB: RibbonTab = {
  id: 'line-tool-style',
  labelKey: 'ribbon.tabs.lineToolStyle',
  isContextual: true,
  contextualTrigger: LINE_TOOL_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Γραμμή (draw υπο-λειτουργίες — Revit «Modify | Lines» Draw panel) ──────
    // ADR-510 Φ4h — οι draw υπο-λειτουργίες της γραμμής ζουν ΕΔΩ (μεταφέρθηκαν από το
    // Home split, όπου έμεινε ΜΟΝΟ η βασική «Γραμμή»): Βασική · Κάθετη · Παράλληλη
    // Γραμμή. ΙΔΙΑ command keys ('line'/'line-perpendicular'/'line-parallel' — draw
    // ToolTypes, **ΞΕΧΩΡΙΣΤΑ** από το modify 'offset'/«Παράλληλη Μετατόπιση»)· μηδέν νέο
    // wiring. Το contextual trigger παραμένει ενεργό και για τα τρία (βλ. `ribbon-
    // contextual-config.ts`) → η καρτέλα δεν εξαφανίζεται όταν αλλάζεις υπο-λειτουργία.
    // Large buttons = SSoT `toolBtn` (ribbon-large-button-helpers).
    {
      id: 'line-draw',
      labelKey: 'ribbon.panels.lineDraw',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('lineDraw.line', 'ribbon.commands.lineVariants.line', 'line', 'line', 'L'),
            toolBtn('lineDraw.perpendicular', 'ribbon.commands.lineVariants.perpendicular', 'line-perpendicular', 'line-perpendicular'),
            toolBtn('lineDraw.parallel', 'ribbon.commands.lineVariants.parallel', 'line-parallel', 'line-parallel'),
          ],
        },
      ],
    },
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
            // ADR-510 Φ2E #5 — «Διαφάνεια» moved to the left Properties palette (Γενικά).
          ],
        },
      ],
    },
    // ── Εμφάνιση Γραμμής (linetype / lineweight + «＋ Νέος τύπος») ──────────────
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
            // ADR-510 Φ2E #5 — «Κλίμακα» (CELTSCALE) moved to the left Properties palette (Γενικά).
          ],
        },
        // ADR-510 Φ2E #3 — «＋ Νέος τύπος» launcher σε 2η στήλη (δεξιά από «Τύπος»,
        // mirror του dim tab). Ανοίγει τον reusable `LinePatternEditorDialog`· στο save
        // ο `LineNewLinePatternWidget` ΑΝΑΘΕΤΕΙ τον νέο τύπο στην επιλεγμένη γραμμή
        // (undoable) ή στα draw-defaults — Revit «όρισε μοτίβο διακεκομμένης».
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'line-new-line-pattern',
              command: {
                id: 'lineToolStyle.newLineType',
                labelKey: 'ribbon.commands.lineNewLineType',
                commandKey: LINE_TOOL_RIBBON_KEYS.newLineType,
              },
            },
            // ADR-642 — «✎ Επεξεργασία / ⧉ Διπλότυπο» for the current linetype (contextual: the
            // widget self-selects edit-in-place vs duplicate by the current type's origin, and
            // renders nothing for solid/ByLayer). Mirror του «Νέος τύπος», reuse του launcher.
            {
              type: 'widget',
              size: 'small',
              widgetId: 'line-edit-line-pattern',
              command: {
                id: 'lineToolStyle.editLineType',
                labelKey: 'ribbon.commands.lineEditLineType',
                commandKey: LINE_TOOL_RIBBON_KEYS.editLineType,
              },
            },
          ],
        },
      ],
    },
    // ── ADR-510 Φ2E #5 — «Πλάτος» (polyline width) + «Γεωμετρία» (Μήκος/Γωνία/Αρχή/
    // Τέλος/Δ) panels MOVED to the left Properties palette. Geometry is a selection-only
    // surface (no draw-default meaning) → it belongs in the object editor, not the ribbon
    // (AutoCAD: geometry lives in Ctrl+1 Properties, never in the ribbon). The ribbon tab
    // now stays ~1 row: tools + quick appearance (Στυλ/Χρώμα/Επίπεδο/Τύπος/Πάχος/＋Νέος).
    // The `getPanelVisibility(geometry|widthApplicable)` predicates stay in the bridge —
    // the palette now consumes them for its own line-only / polyline-only gating.
  ],
};
