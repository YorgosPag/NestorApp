/**
 * ADR-417 Φ1-part-2 — Contextual ribbon tab για τον editor στέγης (Roof).
 *
 * Trigger: `roof-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'roof'`, OR activeTool === 'roof').
 *
 * Panels (Φ1-part-2):
 *   Τύπος Στέγης   → roofType picker (built-in family types)
 *   Μορφή & Κλίση  → shape preset (flat/mono/gable) + slope + μονάδα toggle (°/%)
 *   Γεωμετρία      → στάθμη γείσου (basePivotZ)
 *   Ενέργειες      → close + delete
 *
 * Live behavior: bridge (`useRibbonRoofBridge`) dispatches `UpdateRoofParamsCommand`
 * σε κάθε change (undoable· geometry/validation recompute atomically). Auto-save
 * 500ms debounce via `useRoofPersistence`. Η μηχανή (`applyRoofShapePreset` /
 * `roofSlopeToRatio`/`roofSlopeFromRatio`) ζει στο `bim/geometry/roof-geometry.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see ui/ribbon/data/contextual-slab-tab.ts — το πρότυπο
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  ROOF_RIBBON_KEYS,
  ROOF_RIBBON_KEYS_ACTIONS,
  ROOF_RIBBON_TOGGLE_KEYS,
  ROOF_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/roof-command-keys';

export const ROOF_CONTEXTUAL_TRIGGER = 'roof-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const ROOF_SHAPE_OPTIONS = [
  { value: 'flat',       labelKey: 'ribbon.commands.roofEditor.shape.flat',      isLiteralLabel: false },
  { value: 'mono-pitch', labelKey: 'ribbon.commands.roofEditor.shape.monoPitch', isLiteralLabel: false },
  { value: 'gable',      labelKey: 'ribbon.commands.roofEditor.shape.gable',     isLiteralLabel: false },
] as const;

// mm — στάθμη γείσου (eaves datum / pivot line) presets.
const BASE_PIVOT_Z_MM_OPTIONS = [
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '2800', labelKey: '2800', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '6000', labelKey: '6000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_ROOF_TAB: RibbonTab = {
  id: 'roof-editor',
  labelKey: 'ribbon.tabs.roofProperties',
  isContextual: true,
  contextualTrigger: ROOF_CONTEXTUAL_TRIGGER,
  badgeKey: ROOF_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      // ADR-417 §10 #3 — Roof Family Type: pick/assign the composite type + open
      // the «Edit Roof Type» dialog (layers + live 3D preview) + per-instance
      // override editor. Selector assigns/detaches the roof's `typeId`; properties
      // widget edits the material override + renames user types. Self-hides via the
      // widgets for untyped roofs. Mirrors the wall «Τύπος» panel.
      id: 'roof-family-type',
      labelKey: 'ribbon.panels.roofType',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'roof-family-type',
              command: {
                id: 'roof.familyType',
                labelKey: 'ribbon.commands.roofFamilyType.type',
                commandKey: 'roof.familyType.select',
              },
            },
            {
              type: 'widget',
              size: 'small',
              widgetId: 'roof-type-properties',
              command: {
                id: 'roof.typeProperties',
                labelKey: 'ribbon.commands.roofFamilyType.properties',
                commandKey: 'roof.familyType.properties',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'roof-shape-slope',
      labelKey: 'ribbon.panels.roofShapeSlope',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'roof.shape',
                labelKey: 'ribbon.commands.roofEditor.shape.section.title',
                commandKey: ROOF_RIBBON_KEYS.stringParams.shape,
                comboboxWidthPx: 130,
                options: ROOF_SHAPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'roof.slope',
                labelKey: 'ribbon.commands.roofEditor.slope',
                commandKey: ROOF_RIBBON_KEYS.params.slope,
                comboboxWidthPx: 90,
              },
            },
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'roof.slopeUnitPercent',
                labelKey: 'ribbon.commands.roofEditor.slopeUnitPercent',
                commandKey: ROOF_RIBBON_TOGGLE_KEYS.slopeUnitPercent,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'roof-geometry',
      labelKey: 'ribbon.panels.roofGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'roof.basePivotZ',
                labelKey: 'ribbon.commands.roofEditor.basePivotZ',
                commandKey: ROOF_RIBBON_KEYS.params.basePivotZ,
                comboboxWidthPx: 90,
                options: BASE_PIVOT_Z_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'roof-actions',
      labelKey: 'ribbon.panels.roofActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'roof.close',
                labelKey: 'ribbon.commands.roofEditor.close',
                icon: 'select',
                commandKey: ROOF_RIBBON_KEYS_ACTIONS.close,
                action: ROOF_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'roof.delete',
                labelKey: 'ribbon.commands.roofEditor.delete',
                icon: 'trash',
                commandKey: ROOF_RIBBON_KEYS_ACTIONS.delete,
                action: ROOF_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
