/**
 * ADR-363 Phase 3.7 — Contextual ribbon tab για slab-opening editor.
 *
 * Trigger: `slab-opening-selected` (dispatched από `resolveContextualTrigger`
 * όταν primary-selected entity έχει `type === 'slab-opening'`, OR
 * activeTool === 'slab-opening').
 *
 * Panels (Phase 3.7 — minimal):
 *   Kind      → kind combobox (4 τύποι: shaft / well / duct / chimney)
 *   Actions   → close + delete
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  SLAB_OPENING_RIBBON_KEYS,
  SLAB_OPENING_RIBBON_KEYS_ACTIONS,
  SLAB_OPENING_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/slab-opening-command-keys';

export const SLAB_OPENING_CONTEXTUAL_TRIGGER = 'slab-opening-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const SLAB_OPENING_KIND_OPTIONS = [
  { value: 'shaft',   labelKey: 'ribbon.commands.slabOpeningEditor.kind.shaft',   isLiteralLabel: false },
  { value: 'well',    labelKey: 'ribbon.commands.slabOpeningEditor.kind.well',    isLiteralLabel: false },
  { value: 'duct',    labelKey: 'ribbon.commands.slabOpeningEditor.kind.duct',    isLiteralLabel: false },
  { value: 'chimney', labelKey: 'ribbon.commands.slabOpeningEditor.kind.chimney', isLiteralLabel: false },
] as const;

// ADR-363 Phase 3.7b — fire rating options (minutes). Applicable to shaft/chimney.
// Stored as number in SlabOpeningParams.fireRating (60 | 90 | 120 | undefined).
const SLAB_OPENING_FIRE_RATING_OPTIONS = [
  { value: '',    labelKey: 'ribbon.commands.slabOpeningEditor.fireRating.none', isLiteralLabel: false },
  { value: '60',  labelKey: 'ribbon.commands.slabOpeningEditor.fireRating.60',  isLiteralLabel: false },
  { value: '90',  labelKey: 'ribbon.commands.slabOpeningEditor.fireRating.90',  isLiteralLabel: false },
  { value: '120', labelKey: 'ribbon.commands.slabOpeningEditor.fireRating.120', isLiteralLabel: false },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_SLAB_OPENING_TAB: RibbonTab = {
  id: 'slab-opening-editor',
  labelKey: 'ribbon.tabs.slabOpeningProperties',
  isContextual: true,
  contextualTrigger: SLAB_OPENING_CONTEXTUAL_TRIGGER,
  badgeKey: SLAB_OPENING_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'slab-opening-kind',
      labelKey: 'ribbon.panels.slabOpeningKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab-opening.kind',
                labelKey: 'ribbon.commands.slabOpeningEditor.kind.section.title',
                commandKey: SLAB_OPENING_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 150,
                options: SLAB_OPENING_KIND_OPTIONS,
              },
            },
            {
              // ADR-363 Phase 3.7b — fire rating combobox. Applicable to shaft/chimney.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab-opening.fireRating',
                labelKey: 'ribbon.commands.slabOpeningEditor.fireRating.section.title',
                commandKey: SLAB_OPENING_RIBBON_KEYS.stringParams.fireRating,
                comboboxWidthPx: 110,
                options: SLAB_OPENING_FIRE_RATING_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-opening-actions',
      labelKey: 'ribbon.panels.slabOpeningActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab-opening.close',
                labelKey: 'ribbon.commands.slabOpeningEditor.close',
                icon: 'select',
                commandKey: SLAB_OPENING_RIBBON_KEYS_ACTIONS.close,
                action: SLAB_OPENING_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab-opening.delete',
                labelKey: 'ribbon.commands.slabOpeningEditor.delete',
                icon: 'trash',
                commandKey: SLAB_OPENING_RIBBON_KEYS_ACTIONS.delete,
                action: SLAB_OPENING_RIBBON_KEYS_ACTIONS.delete,
              },
            },
            {
              // ADR-363 Phase 3.7b+ — copy to all floors (multi-storey stack).
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab-opening.copyToFloors',
                labelKey: 'ribbon.commands.slabOpeningEditor.copyToFloors',
                icon: 'copy',
                commandKey: SLAB_OPENING_RIBBON_KEYS_ACTIONS.copyToFloors,
                action: SLAB_OPENING_RIBBON_KEYS_ACTIONS.copyToFloors,
              },
            },
          ],
        },
      ],
    },
  ],
};
