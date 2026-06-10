/**
 * ADR-436 Slice 1 — Contextual ribbon tab για τον foundation editor.
 *
 * Trigger: `foundation-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'foundation'`, OR activeTool === 'foundation-pad').
 *
 * Panels (Slice 1 — pad):
 *   Kind      → kind combobox (pad) + anchor (9 options)
 *   Geometry  → width + length + thickness + rotation
 *   Elevation → top-face elevation (mm, κάτω από στάθμη)
 *   Actions   → close + delete
 *
 * Live behavior: bridge (`useRibbonFoundationBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useFoundationPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §6
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  FOUNDATION_RIBBON_KEYS,
  FOUNDATION_RIBBON_KEYS_ACTIONS,
  FOUNDATION_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/foundation-command-keys';

export const FOUNDATION_CONTEXTUAL_TRIGGER = 'foundation-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

// Slice 1 = pad μόνο. Τα line-based kinds (strip/tie-beam) προστίθενται στο
// Slice 2 μαζί με το line tool.
const FOUNDATION_KIND_OPTIONS = [
  { value: 'pad', labelKey: 'ribbon.commands.foundationEditor.kind.pad', isLiteralLabel: false },
] as const;

const FOUNDATION_ANCHOR_OPTIONS = [
  { value: 'center', labelKey: 'ribbon.commands.foundationEditor.anchor.center', isLiteralLabel: false },
  { value: 'nw',     labelKey: 'ribbon.commands.foundationEditor.anchor.nw',     isLiteralLabel: false },
  { value: 'n',      labelKey: 'ribbon.commands.foundationEditor.anchor.n',      isLiteralLabel: false },
  { value: 'ne',     labelKey: 'ribbon.commands.foundationEditor.anchor.ne',     isLiteralLabel: false },
  { value: 'w',      labelKey: 'ribbon.commands.foundationEditor.anchor.w',      isLiteralLabel: false },
  { value: 'e',      labelKey: 'ribbon.commands.foundationEditor.anchor.e',      isLiteralLabel: false },
  { value: 'sw',     labelKey: 'ribbon.commands.foundationEditor.anchor.sw',     isLiteralLabel: false },
  { value: 's',      labelKey: 'ribbon.commands.foundationEditor.anchor.s',      isLiteralLabel: false },
  { value: 'se',     labelKey: 'ribbon.commands.foundationEditor.anchor.se',     isLiteralLabel: false },
] as const;

// Τυπικές διαστάσεις μεμονωμένου πεδίλου (mm).
const PAD_DIMENSION_MM_OPTIONS = [
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
  { value: '1800', labelKey: '1800', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
  { value: '2500', labelKey: '2500', isLiteralLabel: true },
] as const;

const PAD_THICKNESS_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

const ROTATION_DEG_OPTIONS = [
  { value: '0',   labelKey: '0',   isLiteralLabel: true },
  { value: '15',  labelKey: '15',  isLiteralLabel: true },
  { value: '30',  labelKey: '30',  isLiteralLabel: true },
  { value: '45',  labelKey: '45',  isLiteralLabel: true },
  { value: '60',  labelKey: '60',  isLiteralLabel: true },
  { value: '90',  labelKey: '90',  isLiteralLabel: true },
] as const;

// Στάθμη άνω παρειάς (mm, κάτω από στάθμη → αρνητική).
const TOP_ELEVATION_MM_OPTIONS = [
  { value: '-500',  labelKey: '-500',  isLiteralLabel: true },
  { value: '-800',  labelKey: '-800',  isLiteralLabel: true },
  { value: '-1000', labelKey: '-1000', isLiteralLabel: true },
  { value: '-1200', labelKey: '-1200', isLiteralLabel: true },
  { value: '-1500', labelKey: '-1500', isLiteralLabel: true },
  { value: '-2000', labelKey: '-2000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_FOUNDATION_TAB: RibbonTab = {
  id: 'foundation-editor',
  labelKey: 'ribbon.tabs.foundationProperties',
  isContextual: true,
  contextualTrigger: FOUNDATION_CONTEXTUAL_TRIGGER,
  badgeKey: FOUNDATION_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'foundation-kind',
      labelKey: 'ribbon.panels.foundationKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.kind',
                labelKey: 'ribbon.commands.foundationEditor.kind.section.title',
                commandKey: FOUNDATION_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 150,
                options: FOUNDATION_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.anchor',
                labelKey: 'ribbon.commands.foundationEditor.anchor.section.title',
                commandKey: FOUNDATION_RIBBON_KEYS.stringParams.anchor,
                comboboxWidthPx: 110,
                options: FOUNDATION_ANCHOR_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'foundation-geometry',
      labelKey: 'ribbon.panels.foundationGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.width',
                labelKey: 'ribbon.commands.foundationEditor.width',
                commandKey: FOUNDATION_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: PAD_DIMENSION_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.length',
                labelKey: 'ribbon.commands.foundationEditor.length',
                commandKey: FOUNDATION_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: PAD_DIMENSION_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.thickness',
                labelKey: 'ribbon.commands.foundationEditor.thickness',
                commandKey: FOUNDATION_RIBBON_KEYS.params.thickness,
                comboboxWidthPx: 80,
                options: PAD_THICKNESS_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.rotation',
                labelKey: 'ribbon.commands.foundationEditor.rotation',
                commandKey: FOUNDATION_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'foundation-elevation',
      labelKey: 'ribbon.panels.foundationElevation',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'foundation.topElevation',
                labelKey: 'ribbon.commands.foundationEditor.topElevation',
                commandKey: FOUNDATION_RIBBON_KEYS.params.topElevation,
                comboboxWidthPx: 90,
                options: TOP_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'foundation-actions',
      labelKey: 'ribbon.panels.foundationActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'foundation.close',
                labelKey: 'ribbon.commands.foundationEditor.close',
                icon: 'select',
                commandKey: FOUNDATION_RIBBON_KEYS_ACTIONS.close,
                action: FOUNDATION_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'foundation.delete',
                labelKey: 'ribbon.commands.foundationEditor.delete',
                icon: 'trash',
                commandKey: FOUNDATION_RIBBON_KEYS_ACTIONS.delete,
                action: FOUNDATION_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
