/**
 * ADR-363 Phase 3 — Contextual ribbon tab για slab editor.
 *
 * Trigger: `slab-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'slab'`, OR activeTool === 'slab').
 *
 * Panels (Phase 3 — minimal):
 *   Kind      → kind combobox (5 τύποι) + reinforcement
 *   Geometry  → thickness (mm) + elevation (mm)
 *   Actions   → close + delete
 *
 * Live behavior: bridge (`useRibbonSlabBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useSlabPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  SLAB_RIBBON_KEYS,
  SLAB_RIBBON_KEYS_ACTIONS,
  SLAB_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/slab-command-keys';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';

export const SLAB_CONTEXTUAL_TRIGGER = 'slab-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const SLAB_KIND_OPTIONS = [
  { value: 'floor',      labelKey: 'ribbon.commands.slabEditor.kind.floor',      isLiteralLabel: false },
  { value: 'ceiling',    labelKey: 'ribbon.commands.slabEditor.kind.ceiling',    isLiteralLabel: false },
  { value: 'roof',       labelKey: 'ribbon.commands.slabEditor.kind.roof',       isLiteralLabel: false },
  { value: 'ground',     labelKey: 'ribbon.commands.slabEditor.kind.ground',     isLiteralLabel: false },
  { value: 'foundation', labelKey: 'ribbon.commands.slabEditor.kind.foundation', isLiteralLabel: false },
] as const;

const REINFORCEMENT_OPTIONS = [
  { value: 'one-way', labelKey: 'ribbon.commands.slabEditor.reinforcement.oneWay', isLiteralLabel: false },
  { value: 'two-way', labelKey: 'ribbon.commands.slabEditor.reinforcement.twoWay', isLiteralLabel: false },
  { value: 'waffle',  labelKey: 'ribbon.commands.slabEditor.reinforcement.waffle', isLiteralLabel: false },
  { value: 'flat',    labelKey: 'ribbon.commands.slabEditor.reinforcement.flat',   isLiteralLabel: false },
] as const;

const THICKNESS_MM_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
] as const;

// ADR-363 Phase 4.5e-A — slab material picker (ENABLED). 3 preset options.
// Phase 6.5 material library will expand to full catalog.
const SLAB_MATERIAL_OPTIONS = [
  { value: 'rc',        labelKey: 'ribbon.commands.slabEditor.material.rc',        isLiteralLabel: false },
  { value: 'composite', labelKey: 'ribbon.commands.slabEditor.material.composite', isLiteralLabel: false },
  { value: 'wood',      labelKey: 'ribbon.commands.slabEditor.material.wood',      isLiteralLabel: false },
] as const;

const ELEVATION_MM_OPTIONS = [
  { value: '-500', labelKey: '-500', isLiteralLabel: true },
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
  { value: '2800', labelKey: '2800', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '6000', labelKey: '6000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_SLAB_TAB: RibbonTab = {
  id: 'slab-editor',
  labelKey: 'ribbon.tabs.slabProperties',
  isContextual: true,
  contextualTrigger: SLAB_CONTEXTUAL_TRIGGER,
  badgeKey: SLAB_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'slab-kind',
      labelKey: 'ribbon.panels.slabKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.kind',
                labelKey: 'ribbon.commands.slabEditor.kind.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: SLAB_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.reinforcement',
                labelKey: 'ribbon.commands.slabEditor.reinforcement.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.reinforcement,
                comboboxWidthPx: 130,
                options: REINFORCEMENT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-geometry',
      labelKey: 'ribbon.panels.slabGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.thickness',
                labelKey: 'ribbon.commands.slabEditor.thickness',
                commandKey: SLAB_RIBBON_KEYS.params.thickness,
                comboboxWidthPx: 80,
                options: THICKNESS_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.levelElevation',
                labelKey: 'ribbon.commands.slabEditor.levelElevation',
                commandKey: SLAB_RIBBON_KEYS.params.levelElevation,
                comboboxWidthPx: 90,
                options: ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-material',
      labelKey: 'ribbon.panels.slabMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'slab.material',
                labelKey: 'ribbon.commands.slabEditor.material.section.title',
                commandKey: SLAB_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 180,
                options: SLAB_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'slab.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'slab-actions',
      labelKey: 'ribbon.panels.slabActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.close',
                labelKey: 'ribbon.commands.slabEditor.close',
                icon: 'select',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.close,
                action: SLAB_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'slab.delete',
                labelKey: 'ribbon.commands.slabEditor.delete',
                icon: 'trash',
                commandKey: SLAB_RIBBON_KEYS_ACTIONS.delete,
                action: SLAB_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
