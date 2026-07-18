/**
 * ADR-419 — Contextual ribbon tab για floor-finish (επικάλυψη δαπέδου).
 *
 * Trigger: `floor-finish-selected` (dispatched από `ribbon-contextual-config.ts`
 * όταν το primary-selected entity έχει `type === 'floor-finish'`).
 *
 * Panels:
 *   Material  → material picker combobox (8 options από SSoT catalog)
 *   Geometry  → thickness combobox (mm presets)
 *   Actions   → close + delete
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { FLOOR_FINISH_RIBBON_KEYS } from '../hooks/bridge/floor-finish-command-keys';
import { listFloorFinishMaterials } from '../../../bim/floor-finishes/floor-finish-material-catalog';

export const FLOOR_FINISH_CONTEXTUAL_TRIGGER = 'floor-finish-selected';

// ─── Combobox options (generated from SSoT catalog) ───────────────────────────

/** Material options — generated from the catalog SSoT (never hand-listed). */
const MATERIAL_OPTIONS = listFloorFinishMaterials().map((def) => ({
  value: def.id,
  labelKey: `floorFinish.materials.${def.labelKeySuffix}`,
  isLiteralLabel: false,
}));

const TILE_DIM_MM_OPTIONS = [
  { value: '100',  labelKey: '100 mm', isLiteralLabel: true },
  { value: '150',  labelKey: '150 mm', isLiteralLabel: true },
  { value: '200',  labelKey: '200 mm', isLiteralLabel: true },
  { value: '300',  labelKey: '300 mm', isLiteralLabel: true },
  { value: '400',  labelKey: '400 mm', isLiteralLabel: true },
  { value: '600',  labelKey: '600 mm', isLiteralLabel: true },
  { value: '900',  labelKey: '900 mm', isLiteralLabel: true },
  { value: '1000', labelKey: '1000 mm', isLiteralLabel: true },
  { value: '1200', labelKey: '1200 mm', isLiteralLabel: true },
] as const;

const THICKNESS_MM_OPTIONS = [
  { value: '8',  labelKey: '8 mm',  isLiteralLabel: true },
  { value: '10', labelKey: '10 mm', isLiteralLabel: true },
  { value: '12', labelKey: '12 mm', isLiteralLabel: true },
  { value: '15', labelKey: '15 mm', isLiteralLabel: true },
  { value: '20', labelKey: '20 mm', isLiteralLabel: true },
  { value: '25', labelKey: '25 mm', isLiteralLabel: true },
  { value: '30', labelKey: '30 mm', isLiteralLabel: true },
  { value: '40', labelKey: '40 mm', isLiteralLabel: true },
  { value: '50', labelKey: '50 mm', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_FLOOR_FINISH_TAB: RibbonTab = {
  id: 'floor-finish-editor',
  labelKey: 'ribbon.tabs.floorFinishProperties',
  isContextual: true,
  contextualTrigger: FLOOR_FINISH_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'floor-finish-material',
      labelKey: 'ribbon.panels.floorFinishMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorFinish.materialId',
                labelKey: 'ribbon.commands.floorFinishEditor.material',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.stringParams.materialId,
                comboboxWidthPx: 180,
                options: MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'floor-finish-geometry',
      labelKey: 'ribbon.panels.floorFinishGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorFinish.thicknessMm',
                labelKey: 'ribbon.commands.floorFinishEditor.thickness',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.params.thicknessMm,
                comboboxWidthPx: 100,
                options: THICKNESS_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'floor-finish-appearance',
      labelKey: 'ribbon.panels.floorFinishAppearance',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorFinish.tileLengthMm',
                labelKey: 'ribbon.commands.floorFinishEditor.tileLengthMm',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.params.tileLengthMm,
                comboboxWidthPx: 100,
                options: TILE_DIM_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'floorFinish.tileWidthMm',
                labelKey: 'ribbon.commands.floorFinishEditor.tileWidthMm',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.params.tileWidthMm,
                comboboxWidthPx: 100,
                options: TILE_DIM_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
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
                id: 'floorFinish.tileRotate90',
                labelKey: 'ribbon.commands.floorFinishEditor.tileRotate90',
                icon: 'rotate',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.toggles.tileRotate90,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'floor-finish-actions',
      labelKey: 'ribbon.panels.floorFinishActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'floorFinish.close',
                labelKey: 'ribbon.commands.floorFinishEditor.close',
                icon: 'select',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.actions.close,
                action: FLOOR_FINISH_RIBBON_KEYS.actions.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'floorFinish.delete',
                labelKey: 'ribbon.commands.floorFinishEditor.delete',
                icon: 'trash',
                commandKey: FLOOR_FINISH_RIBBON_KEYS.actions.delete,
                action: FLOOR_FINISH_RIBBON_KEYS.actions.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
