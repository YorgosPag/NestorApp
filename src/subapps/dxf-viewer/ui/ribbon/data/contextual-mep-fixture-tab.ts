/**
 * ADR-406 — Contextual ribbon tab για MEP fixture editor (φωτιστικό).
 *
 * Trigger: `mep-fixture-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-fixture'`).
 *
 * Panels:
 *   Shape       → shape combobox (rectangular / circular)
 *   Geometry    → width + body height + mounting elevation (always visible)
 *   Rect params → length + rotation (visible iff shape === 'rectangular')
 *   Actions     → close + delete
 *
 * Live behavior: bridge (`useRibbonMepFixtureBridge`) dispatches updates σε κάθε
 * combobox change μέσω `UpdateMepFixtureParamsCommand` (undoable + geometry/
 * validation recompute atomically). `useMepFixturePersistence` picks up την
 * αλλαγή μέσω debounced auto-save.
 *
 * Σημείωση: το `params.material` (lamp-type / fixture catalog) είναι deferred
 * hook (Phase 6+) χωρίς κατάλογο ακόμη — δεν εκτίθεται εδώ ώστε να μην υπάρχει
 * κενό dropdown (mirror του column material μόλις προστεθεί κατάλογος).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-fixture-command-keys';
import { literalNumberOptions } from './ribbon-numeric-options';

export const MEP_FIXTURE_CONTEXTUAL_TRIGGER = 'mep-fixture-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const MEP_FIXTURE_SHAPE_OPTIONS = [
  { value: 'rectangular', labelKey: 'ribbon.commands.mepFixtureEditor.shape.rectangular', isLiteralLabel: false },
  { value: 'circular',    labelKey: 'ribbon.commands.mepFixtureEditor.shape.circular',    isLiteralLabel: false },
] as const;

// Footprint width / diameter presets (mm) — 600×600 recessed panel default.
const WIDTH_MM_OPTIONS = literalNumberOptions([100, 150, 200, 300, 400, 600, 1200]);

const LENGTH_MM_OPTIONS = literalNumberOptions([100, 150, 200, 300, 400, 600, 1200]);

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 15, 30, 45, 60, 90, 135, 180]);

// Body thickness presets (mm) — thin recessed/surface fixture.
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([40, 60, 80, 100, 150, 200]);

// Ceiling-relative mounting elevation presets (mm) — typical ceiling heights.
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([2400, 2700, 3000, 3300, 3600, 4000]);

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_FIXTURE_TAB: RibbonTab = {
  id: 'mep-fixture-editor',
  labelKey: 'ribbon.tabs.mepFixtureProperties',
  isContextual: true,
  contextualTrigger: MEP_FIXTURE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-fixture-shape',
      labelKey: 'ribbon.panels.mepFixtureShape',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixture.shape',
                labelKey: 'ribbon.commands.mepFixtureEditor.shape.section.title',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.stringParams.shape,
                comboboxWidthPx: 130,
                options: MEP_FIXTURE_SHAPE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-fixture-geometry',
      labelKey: 'ribbon.panels.mepFixtureGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixture.width',
                labelKey: 'ribbon.commands.mepFixtureEditor.width',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixture.bodyHeight',
                labelKey: 'ribbon.commands.mepFixtureEditor.bodyHeight',
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
                id: 'mepFixture.mountingElevation',
                labelKey: 'ribbon.commands.mepFixtureEditor.mountingElevation',
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
      // Visible iff `params.shape === 'rectangular'` via bridge.getPanelVisibility
      // (circular fixture ignores length & rotation — diameter = width).
      id: 'mep-fixture-rect-params',
      labelKey: 'ribbon.panels.mepFixtureRectParams',
      visibilityKey: MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixture.length',
                labelKey: 'ribbon.commands.mepFixtureEditor.length',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.length,
                comboboxWidthPx: 90,
                options: LENGTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepFixture.rotation',
                labelKey: 'ribbon.commands.mepFixtureEditor.rotation',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-408 Φ7 — circuit awareness on the device tab (Revit "Electrical
      // Circuits" panel). Self-hides (visibilityKey hasCircuit) when the fixture
      // belongs to no circuit. Read-only circuit name + jump to manage it.
      id: 'mep-fixture-circuit',
      labelKey: 'ribbon.panels.mepFixtureCircuit',
      visibilityKey: MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-fixture-circuit-info',
              command: {
                id: 'mepFixture.circuitInfo',
                labelKey: 'ribbon.commands.mepFixtureEditor.circuit.label',
                commandKey: 'mep-fixture-circuit-info',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepFixture.editCircuit',
                labelKey: 'ribbon.commands.mepFixtureEditor.editCircuit',
                tooltipKey: 'ribbon.commands.mepFixtureEditor.editCircuitTooltip',
                icon: 'bim-electrical-panel',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.editCircuit,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.editCircuit,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-fixture-actions',
      labelKey: 'ribbon.panels.mepFixtureActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepFixture.close',
                labelKey: 'ribbon.commands.mepFixtureEditor.close',
                icon: 'select',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepFixture.delete',
                labelKey: 'ribbon.commands.mepFixtureEditor.delete',
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
