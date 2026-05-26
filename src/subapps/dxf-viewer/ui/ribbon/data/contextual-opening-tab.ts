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
  { value: 'door',         labelKey: 'ribbon.commands.openingEditor.kind.door',         isLiteralLabel: false },
  { value: 'window',       labelKey: 'ribbon.commands.openingEditor.kind.window',       isLiteralLabel: false },
  { value: 'sliding-door', labelKey: 'ribbon.commands.openingEditor.kind.slidingDoor',  isLiteralLabel: false },
  { value: 'french-door',  labelKey: 'ribbon.commands.openingEditor.kind.frenchDoor',   isLiteralLabel: false },
  { value: 'fixed',        labelKey: 'ribbon.commands.openingEditor.kind.fixed',        isLiteralLabel: false },
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

const PILL_BG_COLOR_OPTIONS = [
  { value: 'rgba(255,255,255,0.88)', labelKey: 'ribbon.commands.openingEditor.tagStyle.bgColorOptions.white',  isLiteralLabel: false },
  { value: 'rgba(255,253,200,0.88)', labelKey: 'ribbon.commands.openingEditor.tagStyle.bgColorOptions.yellow', isLiteralLabel: false },
  { value: 'rgba(200,220,255,0.88)', labelKey: 'ribbon.commands.openingEditor.tagStyle.bgColorOptions.blue',   isLiteralLabel: false },
  { value: 'rgba(200,240,210,0.88)', labelKey: 'ribbon.commands.openingEditor.tagStyle.bgColorOptions.green',  isLiteralLabel: false },
  { value: 'rgba(40,40,40,0.90)',    labelKey: 'ribbon.commands.openingEditor.tagStyle.bgColorOptions.dark',   isLiteralLabel: false },
] as const;

const LEADER_COLOR_OPTIONS = [
  { value: '#7a8696', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderColorOptions.gray',  isLiteralLabel: false },
  { value: '#000000', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderColorOptions.black', isLiteralLabel: false },
  { value: '#2266cc', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderColorOptions.blue',  isLiteralLabel: false },
  { value: '#cc3333', labelKey: 'ribbon.commands.openingEditor.tagStyle.leaderColorOptions.red',   isLiteralLabel: false },
] as const;

const SILL_MM_OPTIONS = [
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '300',  labelKey: '300',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '900',  labelKey: '900',  isLiteralLabel: true },
  { value: '1100', labelKey: '1100', isLiteralLabel: true },
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
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.pillBgColor',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.bgColorLabel',
                commandKey: OPENING_TAG_STYLE_KEYS.pillBgColor,
                comboboxWidthPx: 130,
                options: PILL_BG_COLOR_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'opening.tagStyle.leaderColor',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.leaderColorLabel',
                commandKey: OPENING_TAG_STYLE_KEYS.leaderColor,
                comboboxWidthPx: 110,
                options: LEADER_COLOR_OPTIONS,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'opening.tagStyle.leaderVisible',
                labelKey: 'ribbon.commands.openingEditor.tagStyle.ribbon.leaderVisibleLabel',
                icon: 'bim-opening-leader-visible',
                commandKey: OPENING_TAG_STYLE_KEYS.leaderVisible,
                action: OPENING_TAG_STYLE_KEYS.leaderVisible,
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
