/**
 * ADR-363 Phase 5 — Contextual ribbon tab για beam editor.
 *
 * Trigger: `beam-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'beam'`, OR activeTool === 'beam').
 *
 * Panels (Phase 5 — minimal):
 *   Kind     → kind combobox (3 τύποι) + supportType (3 options)
 *   Geometry → width + depth + elevation (mm)
 *   Actions  → close + delete
 *
 * Live behavior: bridge (`useRibbonBeamBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useBeamPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  BEAM_RIBBON_KEYS,
  BEAM_RIBBON_KEYS_ACTIONS,
  BEAM_RIBBON_BADGE_KEYS,
} from '../hooks/bridge/beam-command-keys';

export const BEAM_CONTEXTUAL_TRIGGER = 'beam-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const BEAM_KIND_OPTIONS = [
  { value: 'straight',   labelKey: 'ribbon.commands.beamEditor.kind.straight',   isLiteralLabel: false },
  { value: 'curved',     labelKey: 'ribbon.commands.beamEditor.kind.curved',     isLiteralLabel: false },
  { value: 'cantilever', labelKey: 'ribbon.commands.beamEditor.kind.cantilever', isLiteralLabel: false },
] as const;

const BEAM_SUPPORT_TYPE_OPTIONS = [
  { value: 'simple',     labelKey: 'ribbon.commands.beamEditor.supportType.simple',     isLiteralLabel: false },
  { value: 'fixed',      labelKey: 'ribbon.commands.beamEditor.supportType.fixed',      isLiteralLabel: false },
  { value: 'cantilever', labelKey: 'ribbon.commands.beamEditor.supportType.cantilever', isLiteralLabel: false },
] as const;

const WIDTH_MM_OPTIONS = [
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
] as const;

const DEPTH_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

// ADR-363 Phase 5.5c — material picker (ENABLED). 3 options matching
// `BeamMaterialKey` union από `beam-hatch-patterns.ts` (rc/steel/glulam).
// Bridge wiring routes patch through `UpdateBeamParamsCommand` (mirror του
// column-material path Phase 4.5d) ⇒ undoable, atomic recompute, isDragging=false.
const BEAM_MATERIAL_OPTIONS = [
  { value: 'rc',     labelKey: 'ribbon.commands.beamEditor.material.rc',     isLiteralLabel: false },
  { value: 'steel',  labelKey: 'ribbon.commands.beamEditor.material.steel',  isLiteralLabel: false },
  { value: 'glulam', labelKey: 'ribbon.commands.beamEditor.material.glulam', isLiteralLabel: false },
] as const;

const ELEVATION_MM_OPTIONS = [
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
  { value: '2700', labelKey: '2700', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '3600', labelKey: '3600', isLiteralLabel: true },
  { value: '4000', labelKey: '4000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_BEAM_TAB: RibbonTab = {
  id: 'beam-editor',
  labelKey: 'ribbon.tabs.beamProperties',
  isContextual: true,
  contextualTrigger: BEAM_CONTEXTUAL_TRIGGER,
  badgeKey: BEAM_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'beam-kind',
      labelKey: 'ribbon.panels.beamKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.kind',
                labelKey: 'ribbon.commands.beamEditor.kind.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: BEAM_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.supportType',
                labelKey: 'ribbon.commands.beamEditor.supportType.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.supportType,
                comboboxWidthPx: 130,
                options: BEAM_SUPPORT_TYPE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'beam-geometry',
      labelKey: 'ribbon.panels.beamGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.width',
                labelKey: 'ribbon.commands.beamEditor.width',
                commandKey: BEAM_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.depth',
                labelKey: 'ribbon.commands.beamEditor.depth',
                commandKey: BEAM_RIBBON_KEYS.params.depth,
                comboboxWidthPx: 80,
                options: DEPTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.elevation',
                labelKey: 'ribbon.commands.beamEditor.elevation',
                commandKey: BEAM_RIBBON_KEYS.params.elevation,
                comboboxWidthPx: 80,
                options: ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 5.5c — material picker ENABLED. Inserted between
      // `beam-geometry` και `beam-actions` (visual grouping: kind → geometry →
      // material → actions, mirror του column-editor layout).
      id: 'beam-material',
      labelKey: 'ribbon.panels.beamMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.material',
                labelKey: 'ribbon.commands.beamEditor.material.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 180,
                options: BEAM_MATERIAL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'beam-actions',
      labelKey: 'ribbon.panels.beamActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'beam.close',
                labelKey: 'ribbon.commands.beamEditor.close',
                icon: 'select',
                commandKey: BEAM_RIBBON_KEYS_ACTIONS.close,
                action: BEAM_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'beam.delete',
                labelKey: 'ribbon.commands.beamEditor.delete',
                icon: 'trash',
                commandKey: BEAM_RIBBON_KEYS_ACTIONS.delete,
                action: BEAM_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
