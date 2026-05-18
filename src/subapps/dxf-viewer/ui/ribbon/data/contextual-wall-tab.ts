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
import {
  WALL_RIBBON_KEYS,
  WALL_RIBBON_KEYS_ACTIONS,
  WALL_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/wall-command-keys';

export const WALL_CONTEXTUAL_TRIGGER = 'wall-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const WALL_CATEGORY_OPTIONS = [
  { value: 'exterior',  labelKey: 'ribbon.commands.wallEditor.category.exterior',  isLiteralLabel: false },
  { value: 'interior',  labelKey: 'ribbon.commands.wallEditor.category.interior',  isLiteralLabel: false },
  { value: 'partition', labelKey: 'ribbon.commands.wallEditor.category.partition', isLiteralLabel: false },
  { value: 'parapet',   labelKey: 'ribbon.commands.wallEditor.category.parapet',   isLiteralLabel: false },
  { value: 'fence',     labelKey: 'ribbon.commands.wallEditor.category.fence',     isLiteralLabel: false },
] as const;

const HEIGHT_MM_OPTIONS = [
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
  { value: '2700', labelKey: '2700', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '3600', labelKey: '3600', isLiteralLabel: true },
  { value: '4000', labelKey: '4000', isLiteralLabel: true },
] as const;

const THICKNESS_MM_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
] as const;

const FLIP_OPTIONS = [
  { value: 'false', labelKey: 'ribbon.commands.wallEditor.flip.off', isLiteralLabel: false },
  { value: 'true',  labelKey: 'ribbon.commands.wallEditor.flip.on',  isLiteralLabel: false },
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
      id: 'wall-geometry',
      labelKey: 'ribbon.panels.wallGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.height',
                labelKey: 'ribbon.commands.wallEditor.height',
                commandKey: WALL_RIBBON_KEYS.params.height,
                comboboxWidthPx: 80,
                options: HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.thickness',
                labelKey: 'ribbon.commands.wallEditor.thickness',
                commandKey: WALL_RIBBON_KEYS.params.thickness,
                comboboxWidthPx: 80,
                options: THICKNESS_MM_OPTIONS,
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
