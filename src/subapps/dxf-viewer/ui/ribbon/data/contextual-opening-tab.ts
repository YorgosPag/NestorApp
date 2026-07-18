/**
 * ADR-363 Phase 2 — Contextual ribbon tab για τον Opening editor.
 *
 * Trigger: `opening-selected` (dispatched by `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'opening'`, OR active tool === 'opening').
 *
 * ─── LAYOUT (ADR-676 ΒΗΜΑ 2 UI, Giorgio 2026-07-18) ──────────────────────────
 * ΚΑΝΟΝΑΣ: ΚΑΘΟΛΟΥ flyout/dropdown — όλα ορατά. Κάθε `row` με small buttons
 * αποδίδεται από το CSS ως **ΚΑΘΕΤΗ στήλη** (`.dxf-ribbon-panel-row[data-row-size=
 * "small"] { flex-direction: column }`), και πολλές rows = **στήλες δίπλα-δίπλα**.
 * Άρα: κάθε panel = **ΜΙΑ row** (μία στήλη) με **έως 4 εντολές** τη μία κάτω από
 * την άλλη· μόνο όταν οι εντολές είναι >4 μπαίνει 2η row (δεύτερη στήλη). Έτσι το
 * tab δεν απλώνεται οριζόντια εκτός οθόνης.
 *
 * Panels (9):
 *   Σήμανση        → mark · reset-tag · renumber · schedule            (1 στήλη ×4)
 *   Τύπος          → kind · handing · openDirection                    (1 στήλη ×3)
 *   Οικογένεια     → familyType · type-properties · hardware           (1 στήλη ×3)
 *   Διαστάσεις     → width · height · sill                             (1 στήλη ×3)
 *   Κατώφλι        → hasThreshold · embed · embed-mm                    (1 στήλη ×3)
 *   Διατομή Κάσας  → manufacturer·profile·faceWidth·depth | save-mine   (2 στήλες 4+1)
 *   Ετικέτα        → ορατότητα·font·border·leader-style | leader-visible·χρώματα (2 στήλες 4+3)
 *   IFC            → pset                                               (1 στήλη ×1)
 *   Ενέργειες      → close · delete                                     (1 στήλη ×2)
 *
 * Live behavior: bridge (`useRibbonOpeningBridge`) dispatches updates
 * σε κάθε combobox change. Auto-save 500ms debounce via `useOpeningPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library-parametric.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  OPENING_RIBBON_KEYS,
  OPENING_RIBBON_KEYS_ACTIONS,
  OPENING_RIBBON_BADGE_KEYS,
  OPENING_TAG_STYLE_KEYS,
} from '../hooks/bridge/opening-command-keys';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';

export const OPENING_CONTEXTUAL_TRIGGER = 'opening-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const OPENING_KIND_OPTIONS = [
  // ─── Doors ──────────────────────────────────────────────────────────────
  { value: 'door',                labelKey: 'ribbon.commands.openingEditor.kind.door',               isLiteralLabel: false },
  { value: 'double-door',         labelKey: 'ribbon.commands.openingEditor.kind.doubleDoor',         isLiteralLabel: false },
  { value: 'sliding-door',        labelKey: 'ribbon.commands.openingEditor.kind.slidingDoor',        isLiteralLabel: false },
  { value: 'double-sliding-door', labelKey: 'ribbon.commands.openingEditor.kind.doubleSlidingDoor',  isLiteralLabel: false },
  { value: 'pocket-door',         labelKey: 'ribbon.commands.openingEditor.kind.pocketDoor',         isLiteralLabel: false },
  { value: 'bifold-door',         labelKey: 'ribbon.commands.openingEditor.kind.bifoldDoor',         isLiteralLabel: false },
  { value: 'overhead-door',       labelKey: 'ribbon.commands.openingEditor.kind.overheadDoor',       isLiteralLabel: false },
  { value: 'revolving-door',      labelKey: 'ribbon.commands.openingEditor.kind.revolvingDoor',      isLiteralLabel: false },
  { value: 'french-door',         labelKey: 'ribbon.commands.openingEditor.kind.frenchDoor',         isLiteralLabel: false },
  // ─── Windows ────────────────────────────────────────────────────────────
  { value: 'window',              labelKey: 'ribbon.commands.openingEditor.kind.window',             isLiteralLabel: false },
  { value: 'fixed',               labelKey: 'ribbon.commands.openingEditor.kind.fixed',              isLiteralLabel: false },
  { value: 'double-hung-window',  labelKey: 'ribbon.commands.openingEditor.kind.doubleHungWindow',   isLiteralLabel: false },
  { value: 'sliding-window',      labelKey: 'ribbon.commands.openingEditor.kind.slidingWindow',      isLiteralLabel: false },
  { value: 'awning-window',       labelKey: 'ribbon.commands.openingEditor.kind.awningWindow',       isLiteralLabel: false },
  { value: 'hopper-window',       labelKey: 'ribbon.commands.openingEditor.kind.hopperWindow',       isLiteralLabel: false },
  { value: 'tilt-turn-window',    labelKey: 'ribbon.commands.openingEditor.kind.tiltTurnWindow',     isLiteralLabel: false },
  { value: 'bay-window',          labelKey: 'ribbon.commands.openingEditor.kind.bayWindow',          isLiteralLabel: false },
] as const;

const HANDING_OPTIONS = [
  { value: 'left',  labelKey: 'ribbon.commands.openingEditor.handing.left',  isLiteralLabel: false },
  { value: 'right', labelKey: 'ribbon.commands.openingEditor.handing.right', isLiteralLabel: false },
] as const;

const OPEN_DIRECTION_OPTIONS = [
  { value: 'inward',  labelKey: 'ribbon.commands.openingEditor.openDirection.inward',  isLiteralLabel: false },
  { value: 'outward', labelKey: 'ribbon.commands.openingEditor.openDirection.outward', isLiteralLabel: false },
] as const;

const WIDTH_MM_OPTIONS = [
  { value: '700',  labelKey: '700',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '900',  labelKey: '900',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1400', labelKey: '1400', isLiteralLabel: true },
  { value: '1800', labelKey: '1800', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
] as const;

const HEIGHT_MM_OPTIONS = [
  { value: '1400', labelKey: '1400', isLiteralLabel: true },
  { value: '1800', labelKey: '1800', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
  { value: '2100', labelKey: '2100', isLiteralLabel: true },
  { value: '2200', labelKey: '2200', isLiteralLabel: true },
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
] as const;

// ─── Tag style options ───────────────────────────────────────────────────────

const FONT_SIZE_OPTIONS = [
  { value: '7',  labelKey: '7px',  isLiteralLabel: true },
  { value: '8',  labelKey: '8px',  isLiteralLabel: true },
  { value: '9',  labelKey: '9px',  isLiteralLabel: true },
  { value: '10', labelKey: '10px', isLiteralLabel: true },
  { value: '11', labelKey: '11px', isLiteralLabel: true },
  { value: '12', labelKey: '12px', isLiteralLabel: true },
  { value: '14', labelKey: '14px', isLiteralLabel: true },
  { value: '16', labelKey: '16px', isLiteralLabel: true },
] as const;

const BORDER_WIDTH_OPTIONS = [
  { value: '0', labelKey: '0px', isLiteralLabel: true },
  { value: '1', labelKey: '1px', isLiteralLabel: true },
  { value: '2', labelKey: '2px', isLiteralLabel: true },
  { value: '3', labelKey: '3px', isLiteralLabel: true },
] as const;

const LEADER_STYLE_OPTIONS = [
  { value: 'solid',  labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderStyleOptions.solid',  isLiteralLabel: false },
  { value: 'dashed', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderStyleOptions.dashed', isLiteralLabel: false },
  { value: 'dotted', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderStyleOptions.dotted', isLiteralLabel: false },
] as const;


const SILL_MM_OPTIONS = [
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '300',  labelKey: '300',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '900',  labelKey: '900',  isLiteralLabel: true },
  { value: '1100', labelKey: '1100', isLiteralLabel: true },
] as const;

// ─── ADR-673 — Κατώφλι (threshold) vertical placement ───────────────────────

const THRESHOLD_EMBED_OPTIONS = [
  { value: 'none',      labelKey: 'ribbon.commands.openingEditor.thresholdEmbed.none',     isLiteralLabel: false },
  { value: 'flush-top', labelKey: 'ribbon.commands.openingEditor.thresholdEmbed.flushTop', isLiteralLabel: false },
  { value: 'on-slab',   labelKey: 'ribbon.commands.openingEditor.thresholdEmbed.onSlab',   isLiteralLabel: false },
  { value: 'custom',    labelKey: 'ribbon.commands.openingEditor.thresholdEmbed.custom',   isLiteralLabel: false },
] as const;

// Editable presets for the custom sink depth (mm) — free typing also allowed
// (RibbonEditableCombobox infers editability from the all-numeric preset list).
const THRESHOLD_EMBED_MM_OPTIONS = [
  { value: '0',  labelKey: '0',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
] as const;

// ─── ADR-611 — Frame profile (διατομή κάσας) preset dims ────────────────────
// Editable presets for the two CONSTANT cross-section dims (mm). Free typing
// is still allowed (RibbonEditableCombobox) — these are just the dropdown
// shortcuts, spanning the seed catalog's face-width/depth range.
const FRAME_PROFILE_FACE_WIDTH_MM_OPTIONS = [
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
  { value: '65', labelKey: '65', isLiteralLabel: true },
  { value: '68', labelKey: '68', isLiteralLabel: true },
  { value: '70', labelKey: '70', isLiteralLabel: true },
  { value: '72', labelKey: '72', isLiteralLabel: true },
  { value: '74', labelKey: '74', isLiteralLabel: true },
  { value: '78', labelKey: '78', isLiteralLabel: true },
  { value: '84', labelKey: '84', isLiteralLabel: true },
] as const;

const FRAME_PROFILE_DEPTH_MM_OPTIONS = [
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '55', labelKey: '55', isLiteralLabel: true },
  { value: '58', labelKey: '58', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
  { value: '62', labelKey: '62', isLiteralLabel: true },
  { value: '70', labelKey: '70', isLiteralLabel: true },
  { value: '75', labelKey: '75', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────
// Κάθε panel έχει ΜΙΑ row (= μία κάθετη στήλη έως 4 εντολών)· τα panels με >4
// εντολές παίρνουν 2η row (δεύτερη στήλη). ΚΑΜΙΑ flyout — όλα ορατά.

export const CONTEXTUAL_OPENING_TAB: RibbonTab = {
  id: 'opening-editor',
  labelKey: 'ribbon.tabs.openingProperties',
  isContextual: true,
  contextualTrigger: OPENING_CONTEXTUAL_TRIGGER,
  badgeKey: OPENING_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      // «Σήμανση»: mark + reset-tag + renumber + schedule → ΜΙΑ στήλη ×4
      // (απορροφά τα πρώην μονο-εντολά panels «Επαναρίθμηση» & «Πίνακας»).
      id: 'opening-mark',
      labelKey: 'ribbon.panels.openingMark',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.mark',
                labelKey: 'ribbon.commands.openingEditor.mark',
                commandKey: OPENING_RIBBON_KEYS.stringParams.mark,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.resetTagPosition',
                labelKey: 'ribbon.commands.openingEditor.resetTagPosition.label',
                icon: 'bim-opening-reset-tag',
                commandKey: OPENING_RIBBON_KEYS_ACTIONS.resetTagPosition,
                action: OPENING_RIBBON_KEYS_ACTIONS.resetTagPosition,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.renumber',
                labelKey: 'ribbon.commands.openingEditor.renumber.label',
                icon: 'bim-opening-renumber',
                commandKey: OPENING_RIBBON_KEYS_ACTIONS.renumber,
                action: OPENING_RIBBON_KEYS_ACTIONS.renumber,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.scheduleExport',
                labelKey: 'ribbon.commands.openingEditor.scheduleExport.label',
                icon: 'bim-opening-schedule-pdf',
                commandKey: OPENING_RIBBON_KEYS_ACTIONS.exportSchedulePdf,
                action: OPENING_RIBBON_KEYS_ACTIONS.exportSchedulePdf,
              },
            },
          ],
        },
      ],
    },
    {
      // «Τύπος»: kind + handing + openDirection → ΜΙΑ στήλη ×3
      id: 'opening-kind',
      labelKey: 'ribbon.panels.openingKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.kind',
                labelKey: 'ribbon.commands.openingEditor.kind.section.title',
                commandKey: OPENING_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: OPENING_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.handing',
                labelKey: 'ribbon.commands.openingEditor.handing.section.title',
                commandKey: OPENING_RIBBON_KEYS.stringParams.handing,
                comboboxWidthPx: 140,
                options: HANDING_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.openDirection',
                labelKey: 'ribbon.commands.openingEditor.openDirection.section.title',
                commandKey: OPENING_RIBBON_KEYS.stringParams.openDirection,
                comboboxWidthPx: 140,
                options: OPEN_DIRECTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-421 SLICE C — «Οικογένεια/Τύπος»: selector + type-properties +
      // instance hardware override (ADR-674 Φ C) → ΜΙΑ στήλη ×3.
      id: 'opening-family-type',
      labelKey: 'ribbon.panels.openingFamilyType',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'opening-family-type',
              command: {
                id: 'opening.familyType',
                labelKey: 'ribbon.commands.bimFamilyType.label',
                commandKey: 'opening.familyType.select',
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'opening-type-properties',
              command: {
                id: 'opening.typeProperties',
                labelKey: 'ribbon.commands.bimFamilyType.properties',
                commandKey: 'opening.familyType.properties',
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'opening-hardware',
              command: {
                id: 'opening.hardware',
                labelKey: 'ribbon.commands.bimFamilyType.editOpeningHardwareButton',
                commandKey: 'opening.hardware.edit',
              },
            },
          ],
        },
      ],
    },
    {
      // «Διαστάσεις»: width + height + sill → ΜΙΑ στήλη ×3
      id: 'opening-size',
      labelKey: 'ribbon.panels.openingSize',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.width',
                labelKey: 'ribbon.commands.openingEditor.width',
                commandKey: OPENING_RIBBON_KEYS.params.width,
                comboboxWidthPx: 120,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.height',
                labelKey: 'ribbon.commands.openingEditor.height',
                commandKey: OPENING_RIBBON_KEYS.params.height,
                comboboxWidthPx: 120,
                options: HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.sillHeight',
                labelKey: 'ribbon.commands.openingEditor.sillHeight',
                commandKey: OPENING_RIBBON_KEYS.params.sillHeight,
                comboboxWidthPx: 120,
                options: SILL_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-673 — «Κατώφλι»: toggle + embed + custom-depth → ΜΙΑ στήλη ×3
      id: 'opening-threshold',
      labelKey: 'ribbon.panels.openingThreshold',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'opening.hasThreshold',
                labelKey: 'ribbon.commands.openingEditor.hasThreshold',
                icon: 'bim-opening-threshold',
                commandKey: OPENING_RIBBON_KEYS.toggles.hasThreshold,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.thresholdEmbed',
                labelKey: 'ribbon.commands.openingEditor.thresholdEmbed.section.title',
                commandKey: OPENING_RIBBON_KEYS.stringParams.thresholdEmbed,
                comboboxWidthPx: 150,
                options: THRESHOLD_EMBED_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.thresholdEmbedMm',
                labelKey: 'ribbon.commands.openingEditor.thresholdEmbedMm',
                commandKey: OPENING_RIBBON_KEYS.params.thresholdEmbedMm,
                comboboxWidthPx: 150,
                options: THRESHOLD_EMBED_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-611/676 — «Διατομή Κάσας»: στήλη1 ×4 (manufacturer·profile·faceWidth·
      // depth) + στήλη2 ×1 (save-as-mine). Δύο στήλες γιατί οι εντολές είναι >4.
      id: 'opening-frame-profile',
      labelKey: 'ribbon.panels.openingFrameProfile',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.frameProfile.manufacturer',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.manufacturer',
                commandKey: OPENING_RIBBON_KEYS.frameProfile.manufacturer,
                comboboxWidthPx: 150,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.frameProfile.profile',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.profile',
                commandKey: OPENING_RIBBON_KEYS.frameProfile.profile,
                comboboxWidthPx: 150,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.frameProfile.faceWidth',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.faceWidth',
                commandKey: OPENING_RIBBON_KEYS.frameProfile.faceWidth,
                comboboxWidthPx: 150,
                options: FRAME_PROFILE_FACE_WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.frameProfile.depth',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.depth',
                commandKey: OPENING_RIBBON_KEYS.frameProfile.depth,
                comboboxWidthPx: 150,
                options: FRAME_PROFILE_DEPTH_MM_OPTIONS,
              },
            },
          ],
        },
        {
          // ADR-676 Phase 3 PILOT — «Αποθήκευση ως δικό μου» / «Αντιγραφή & επεξεργασία».
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'opening-frame-profile-library',
              command: {
                id: 'opening.frameProfile.library',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.saveAsMine',
                commandKey: 'opening.frameProfile.library',
              },
            },
          ],
        },
      ],
    },
    {
      // «Ετικέτα»: στήλη1 ×4 (ορατότητα·font·border·leader-style) + στήλη2 ×3
      // (leader-visible·χρώμα pill·χρώμα οδηγού). Η ορατότητα ετικετών προηγείται του
      // στυλ (scene-wide layer toggle, ADR-363)· >4 εντολές → 2 στήλες.
      id: 'opening-tag-style',
      labelKey: 'ribbon.panels.openingTagStyle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'opening-tag-visibility',
              command: {
                id: 'opening.tagVisibility',
                labelKey: 'ribbon.commands.openingEditor.tagVisibility.label',
                commandKey: 'opening.tagVisibility.toggle',
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.fontSizePx',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.fontSize',
                commandKey: OPENING_TAG_STYLE_KEYS.fontSizePx,
                comboboxWidthPx: 130,
                options: FONT_SIZE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.borderWidthPx',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.borderWidth',
                commandKey: OPENING_TAG_STYLE_KEYS.borderWidthPx,
                comboboxWidthPx: 130,
                options: BORDER_WIDTH_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.leaderStyle',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.leaderStyleLabel',
                commandKey: OPENING_TAG_STYLE_KEYS.leaderStyle,
                comboboxWidthPx: 130,
                options: LEADER_STYLE_OPTIONS,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'opening.tagStyle.leaderVisible',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.leaderVisibleLabel',
                icon: 'bim-opening-leader-visible',
                commandKey: OPENING_TAG_STYLE_KEYS.leaderVisible,
              },
            },
            {
              type: 'widget',
              size: 'small',
              command: {
                id: 'opening.tagStyle.pillBgColor',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.bgColorLabel',
                commandKey: OPENING_TAG_STYLE_KEYS.pillBgColor,
              },
              widgetId: 'opening-tag-pill-color',
            },
            {
              type: 'widget',
              size: 'small',
              command: {
                id: 'opening.tagStyle.leaderColor',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.leaderColorLabel',
                commandKey: OPENING_TAG_STYLE_KEYS.leaderColor,
              },
              widgetId: 'opening-tag-leader-color',
            },
          ],
        },
      ],
    },
    {
      // «IFC»: property-set editor → ΜΙΑ στήλη ×1
      id: 'opening-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'opening.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      // «Ενέργειες»: close + delete → ΜΙΑ στήλη ×2
      id: 'opening-actions',
      labelKey: 'ribbon.panels.openingActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.close',
                labelKey: 'ribbon.commands.openingEditor.close',
                icon: 'select',
                commandKey: OPENING_RIBBON_KEYS_ACTIONS.close,
                action: OPENING_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.delete',
                labelKey: 'ribbon.commands.openingEditor.delete',
                icon: 'trash',
                commandKey: OPENING_RIBBON_KEYS_ACTIONS.delete,
                action: OPENING_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
