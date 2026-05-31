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
import { ENVELOPE_FUNCTION_OPTIONS } from '../hooks/bridge/envelope-function-param';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';

export const WALL_CONTEXTUAL_TRIGGER = 'wall-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const WALL_CATEGORY_OPTIONS = [
  { value: 'exterior',  labelKey: 'ribbon.commands.wallEditor.category.exterior',  isLiteralLabel: false },
  { value: 'interior',  labelKey: 'ribbon.commands.wallEditor.category.interior',  isLiteralLabel: false },
  { value: 'partition', labelKey: 'ribbon.commands.wallEditor.category.partition', isLiteralLabel: false },
  { value: 'parapet',   labelKey: 'ribbon.commands.wallEditor.category.parapet',   isLiteralLabel: false },
  { value: 'fence',     labelKey: 'ribbon.commands.wallEditor.category.fence',     isLiteralLabel: false },
] as const;

const FLIP_OPTIONS = [
  { value: 'false', labelKey: 'ribbon.commands.wallEditor.flip.off', isLiteralLabel: false },
  { value: 'true',  labelKey: 'ribbon.commands.wallEditor.flip.on',  isLiteralLabel: false },
] as const;

// ADR-363 Phase 4.5e-B — wall material picker options (ENABLED).
// Real activation lands with WallDna Phase 1D (composable wall layer stack with
// per-layer material). Until then the combobox is greyed out and clicks fire
// the shared `onComingSoon` toast.
const WALL_MATERIAL_OPTIONS = [
  { value: 'rc',                labelKey: 'ribbon.commands.wallEditor.material.rc',               isLiteralLabel: false },
  { value: 'masonry',           labelKey: 'ribbon.commands.wallEditor.material.masonry',          isLiteralLabel: false },
  { value: 'aerated-concrete',  labelKey: 'ribbon.commands.wallEditor.material.aeratedConcrete',  isLiteralLabel: false },
  { value: 'gypsum',            labelKey: 'ribbon.commands.wallEditor.material.gypsum',           isLiteralLabel: false },
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
              // Editable height (meters) — typing (. or ,) + preset dropdown +
              // steppers + real-time commit. RibbonWallDimensionWidget SSoT.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-height',
              command: {
                id: 'wall.height',
                labelKey: 'ribbon.commands.wallEditor.height',
                commandKey: 'wall.height.field',
              },
            },
            {
              // Editable thickness (meters) — same widget as height.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-thickness',
              command: {
                id: 'wall.thickness',
                labelKey: 'ribbon.commands.wallEditor.thickness',
                commandKey: 'wall.thickness.field',
              },
            },
            {
              // Editable axis length (meters). Read = computed geometry length;
              // commit moves the end endpoint along the axis (Revit location-line
              // length edit). Free-form (no preset dropdown), straight-only.
              type: 'widget',
              size: 'small',
              widgetId: 'wall-length',
              command: {
                id: 'wall.length',
                labelKey: 'ribbon.commands.wallEditor.length',
                commandKey: 'wall.length.field',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 4.5e-B — wall material picker (ENABLED). Wired to wall-level
      // hatch; DNA-bearing walls ignore this field (per-layer DNA rendering governs).
      id: 'wall-material',
      labelKey: 'ribbon.panels.wallMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.material',
                labelKey: 'ribbon.commands.wallEditor.material.section.title',
                tooltipKey: 'ribbon.commands.wallEditor.material.tooltip',
                commandKey: WALL_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 200,
                options: WALL_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-396 v2 Φ6a — ETICS θερμοπρόσοψη: per-element override της αυτόματης
      // ταξινόμησης κελύφους (auto / εξωτερικό / εσωτερικό), Revit Wall-Function.
      id: 'wall-envelope',
      labelKey: 'ribbon.panels.envelopeFunction',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wall.envelopeFunction',
                labelKey: 'ribbon.commands.envelopeFunction.section.title',
                tooltipKey: 'ribbon.commands.envelopeFunction.tooltip',
                commandKey: WALL_RIBBON_KEYS.stringParams.envelopeFunction,
                comboboxWidthPx: 150,
                options: ENVELOPE_FUNCTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'wall.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-401 Phase E.1 — manual «Attach/Detach Top/Base to structural» (Revit
      // parity). Attach buttons activate a pick-host tool (commandKey = ToolType,
      // no `action`); detach buttons fire a bridge action on the selected walls.
      id: 'wall-structural-attach',
      labelKey: 'ribbon.panels.wallStructuralAttach',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.attachTop',
                labelKey: 'ribbon.commands.wallEditor.attachTop',
                icon: 'bim-wall-attach-top',
                commandKey: 'wall-attach-top',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.attachBase',
                labelKey: 'ribbon.commands.wallEditor.attachBase',
                icon: 'bim-wall-attach-base',
                commandKey: 'wall-attach-base',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.detachTop',
                labelKey: 'ribbon.commands.wallEditor.detachTop',
                icon: 'bim-wall-detach',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.detachTop,
                action: WALL_RIBBON_KEYS_ACTIONS.detachTop,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wall.detachBase',
                labelKey: 'ribbon.commands.wallEditor.detachBase',
                icon: 'bim-wall-detach',
                commandKey: WALL_RIBBON_KEYS_ACTIONS.detachBase,
                action: WALL_RIBBON_KEYS_ACTIONS.detachBase,
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
                id: 'wall.split',
                labelKey: 'ribbon.commands.wallEditor.split',
                icon: 'bim-wall-split',
                commandKey: 'wall-split',
              },
            },
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
