/**
 * ADR-363 Phase 2 — Contextual ribbon tab για τον Opening editor.
 *
 * Trigger: `opening-selected` (dispatched by `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'opening'`, OR active tool === 'opening').
 *
 * Panels (Phase 2 — minimal):
 *   Kind      → kind combobox (5 τύποι) + handing + openDirection (door only)
 *   Size      → width (mm) + height (mm) + sill (mm)
 *   Actions   → close + delete
 *
 * Live behavior: bridge (`useRibbonOpeningBridge`) dispatches updates
 * σε κάθε combobox change. Auto-save 500ms debounce via `useOpeningPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
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

export const CONTEXTUAL_OPENING_TAB: RibbonTab = {
  id: 'opening-editor',
  labelKey: 'ribbon.tabs.openingProperties',
  isContextual: true,
  contextualTrigger: OPENING_CONTEXTUAL_TRIGGER,
  badgeKey: OPENING_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
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
          ],
        },
      ],
    },
    {
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
                comboboxWidthPx: 100,
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
                comboboxWidthPx: 110,
                options: OPEN_DIRECTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-421 SLICE C — BIM Family Type: selector (Radix Select, ADR-001) +
      // type properties / per-instance override editor. Selector assigns/detaches
      // the opening's `typeId` (a Type can switch the family → 2D/3D/IFC follow);
      // properties widget shows effective dims + renames/edits user types.
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
              // ADR-674 Φ C — INSTANCE-level hardware override trigger («this
              // door: 4 hinges»), sibling of the TYPE-wide properties widget
              // above. Opens `EditOpeningHardwareDialog` for the selection.
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
                comboboxWidthPx: 80,
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
                comboboxWidthPx: 80,
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
                comboboxWidthPx: 80,
                options: SILL_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-673 — Κατώφλι (threshold): on/off toggle + vertical embed selector
      // + custom sink depth (mm, active only when embed==='custom'). Instance-
      // owned, always editable regardless of `opening.typeId` — mirrors
      // `sillHeight`/`handing` (never merged into the ADR-421 type-governed set).
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
                comboboxWidthPx: 80,
                options: THRESHOLD_EMBED_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-611 — Frame Profile (διατομή κάσας): manufacturer + profile/series
      // Radix Selects (cascading — profile options filter by the manufacturer
      // value) plus the two editable, CONSTANT cross-section dims. Instance-
      // owned (never type-governed, unlike kind/width/height above).
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
                comboboxWidthPx: 110,
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
                comboboxWidthPx: 170,
                options: [],
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
                id: 'opening.frameProfile.faceWidth',
                labelKey: 'ribbon.commands.openingEditor.frameProfile.faceWidth',
                commandKey: OPENING_RIBBON_KEYS.frameProfile.faceWidth,
                comboboxWidthPx: 70,
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
                comboboxWidthPx: 70,
                options: FRAME_PROFILE_DEPTH_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
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
      id: 'opening-renumber',
      labelKey: 'ribbon.panels.openingRenumber',
      rows: [
        {
          isInFlyout: false,
          buttons: [
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
          ],
        },
      ],
    },
    {
      id: 'opening-tag-style',
      labelKey: 'ribbon.panels.openingTagStyle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.fontSizePx',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.fontSize',
                commandKey: OPENING_TAG_STYLE_KEYS.fontSizePx,
                comboboxWidthPx: 72,
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
                comboboxWidthPx: 64,
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
                comboboxWidthPx: 120,
                options: LEADER_STYLE_OPTIONS,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
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
          ],
        },
      ],
    },
    {
      id: 'opening-schedule',
      labelKey: 'ribbon.panels.openingSchedule',
      rows: [
        {
          isInFlyout: false,
          buttons: [
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
