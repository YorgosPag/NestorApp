/**
 * ADR-408 Φ14 — Contextual ribbon tab για το floor drain (σιφώνι/στόμιο δαπέδου).
 *
 * Trigger: `mep-floor-drain-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `params.kind === 'floor-drain'`).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: το σιφώνι ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον υπάρχοντα `useRibbonMepFixtureBridge`
 * (resolves το selected fixture, dispatch μέσω `UpdateMepFixtureParamsCommand`,
 * undoable + geometry recompute, debounced auto-save). Διαφέρει από το «Ιδιότητες
 * Φωτιστικού» μόνο σε labels + presets (floor-level mm) + λιτότερα panels: το σιφώνι
 * είναι τετράγωνο TERMINAL — χωρίς shape combobox, χωρίς circuit panel.
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation (floor-level)
 *   Actions  → close + delete
 *
 * Σημείωση: η διάμετρος του connector (Ø50 sanitary-drainage) ορίζεται στη
 * δημιουργία· το snap λειτουργεί ανεξάρτητα. Επεξεργασία διαμέτρου = deferred
 * (θα χρειαζόταν επέκταση του fixture bridge — εκτός scope Φ14 v1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';
import { literalNumberOptions } from './ribbon-numeric-options';

export const MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER = 'mep-floor-drain-selected';

// ─── Combobox options (floor-level mm presets) ───────────────────────────────

// Square grating side (mm) — 150×150 default catch-basin.
const SIZE_MM_OPTIONS = literalNumberOptions([100, 150, 200, 250, 300]);

// Basin body depth (mm) — recessed below the floor.
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([50, 80, 100, 150]);

// Floor-relative mounting elevation (mm) — 0 = flush with FFL (a small upstand
// raises the grating slightly above the finished floor).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([0, 20, 50]);

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_FLOOR_DRAIN_TAB: RibbonTab = {
  id: 'mep-floor-drain-editor',
  labelKey: 'ribbon.tabs.mepFloorDrainProperties',
  isContextual: true,
  contextualTrigger: MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-floor-drain-geometry',
      labelKey: 'ribbon.panels.mepFloorDrainGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFloorDrain.width',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.width',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: SIZE_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFloorDrain.length',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.length',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: SIZE_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFloorDrain.bodyHeight',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.bodyHeight',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFloorDrain.mountingElevation',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.mountingElevation',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-floor-drain-actions',
      labelKey: 'ribbon.panels.mepFloorDrainActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepFloorDrain.close',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.close',
                icon: 'select',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepFloorDrain.delete',
                labelKey: 'ribbon.commands.mepFloorDrainEditor.delete',
                icon: 'trash',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
