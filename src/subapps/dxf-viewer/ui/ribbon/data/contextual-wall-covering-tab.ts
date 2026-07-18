/**
 * ADR-511 — Contextual ribbon tab για wall-covering (φινίρισμα τοίχου ανά δωμάτιο/παρειά).
 *
 * Trigger: `wall-covering-selected` (dispatched από `ribbon-contextual-config.ts` όταν το
 * primary-selected entity έχει `type === 'wall-covering'`, ή όταν είναι active το tool).
 *
 * Panels:
 *   Finish     → body finish picker (σοβάς/knauf/πλακίδια) + surface paint picker
 *   Geometry   → faceSide (inner/outer) + height
 *   Actions    → close + delete
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { WALL_COVERING_RIBBON_KEYS } from '../hooks/bridge/wall-covering-command-keys';
import { listWallCoveringMaterials } from '../../../bim/wall-coverings/wall-covering-material-catalog';

export const WALL_COVERING_CONTEXTUAL_TRIGGER = 'wall-covering-selected';

// ─── Combobox options (generated from SSoT catalog) ───────────────────────────

/** Body finish υλικά (σοβάς / knauf / πλακίδια / κόλλα) — όχι μπογιές. */
const BODY_OPTIONS = listWallCoveringMaterials()
  .filter((def) => def.defaultFunction !== 'surface')
  .map((def) => ({
    value: def.id,
    labelKey: `wallCovering.materials.${def.labelKeySuffix}`,
    isLiteralLabel: false,
  }));

/** Surface coat υλικά (μπογιές). */
const SURFACE_OPTIONS = listWallCoveringMaterials()
  .filter((def) => def.defaultFunction === 'surface')
  .map((def) => ({
    value: def.id,
    labelKey: `wallCovering.materials.${def.labelKeySuffix}`,
    isLiteralLabel: false,
  }));

const FACE_SIDE_OPTIONS = [
  { value: 'inner', labelKey: 'wallCovering.faceSide.inner', isLiteralLabel: false },
  { value: 'outer', labelKey: 'wallCovering.faceSide.outer', isLiteralLabel: false },
] as const;

const HEIGHT_MM_OPTIONS = [
  { value: '2200', labelKey: '2200 mm', isLiteralLabel: true },
  { value: '2400', labelKey: '2400 mm', isLiteralLabel: true },
  { value: '2700', labelKey: '2700 mm', isLiteralLabel: true },
  { value: '3000', labelKey: '3000 mm', isLiteralLabel: true },
  { value: '3300', labelKey: '3300 mm', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_WALL_COVERING_TAB: RibbonTab = {
  id: 'wall-covering-editor',
  labelKey: 'ribbon.tabs.wallCoveringProperties',
  isContextual: true,
  contextualTrigger: WALL_COVERING_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'wall-covering-finish',
      labelKey: 'ribbon.panels.wallCoveringFinish',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wallCovering.bodyMaterialId',
                labelKey: 'ribbon.commands.wallCoveringEditor.bodyMaterial',
                commandKey: WALL_COVERING_RIBBON_KEYS.stringParams.bodyMaterialId,
                comboboxWidthPx: 170,
                options: BODY_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wallCovering.surfaceMaterialId',
                labelKey: 'ribbon.commands.wallCoveringEditor.surfaceMaterial',
                commandKey: WALL_COVERING_RIBBON_KEYS.stringParams.surfaceMaterialId,
                comboboxWidthPx: 150,
                options: SURFACE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-covering-geometry',
      labelKey: 'ribbon.panels.wallCoveringGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wallCovering.faceSide',
                labelKey: 'ribbon.commands.wallCoveringEditor.faceSide',
                commandKey: WALL_COVERING_RIBBON_KEYS.stringParams.faceSide,
                comboboxWidthPx: 120,
                options: [...FACE_SIDE_OPTIONS],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'wallCovering.heightTopMm',
                labelKey: 'ribbon.commands.wallCoveringEditor.height',
                commandKey: WALL_COVERING_RIBBON_KEYS.params.heightTopMm,
                comboboxWidthPx: 100,
                options: [...HEIGHT_MM_OPTIONS],
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'wall-covering-actions',
      labelKey: 'ribbon.panels.wallCoveringActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wallCovering.close',
                labelKey: 'ribbon.commands.wallCoveringEditor.close',
                icon: 'select',
                commandKey: WALL_COVERING_RIBBON_KEYS.actions.close,
                action: WALL_COVERING_RIBBON_KEYS.actions.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'wallCovering.delete',
                labelKey: 'ribbon.commands.wallCoveringEditor.delete',
                icon: 'trash',
                commandKey: WALL_COVERING_RIBBON_KEYS.actions.delete,
                action: WALL_COVERING_RIBBON_KEYS.actions.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
