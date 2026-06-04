/**
 * ADR-408 Φ12 — Contextual ribbon tab για τον plumbing manifold (συλλέκτη).
 *
 * Trigger: `mep-manifold-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-manifold'`). Mirror του «Ιδιότητες Φωτιστικού» (ADR-406).
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation
 *   Outlets  → outlet count + inlet diameter + outlet diameter
 *   Δίκτυο   → (fold-in, self-hides αν δεν πηγάζει δίκτυο) — picker / όνομα /
 *              χρώμα / προσθήκη-αφαίρεση σωλήνων. Reuse των domain-agnostic
 *              `mep-circuit-*` widgets + `MEP_PIPE_NETWORK_RIBBON_ACTIONS` (το
 *              ίδιο πρότυπο με το panel «Κύκλωμα» μέσα στο «Ιδιότητες Φωτιστικού»).
 *   Actions  → close + delete
 *
 * Live behavior: ο bridge (`useRibbonMepManifoldBridge`) dispatch-άρει updates σε
 * κάθε combobox change μέσω `UpdateMepManifoldParamsCommand` (undoable). Η αλλαγή
 * `outletCount` ξανακάνει seed τους connectors (`buildMepManifoldConnectors`)
 * ώστε outlets ↔ connectors να μένουν σε συγχρονισμό.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_MANIFOLD_RIBBON_KEYS,
  MEP_MANIFOLD_RIBBON_KEYS_ACTIONS,
  MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-manifold-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

export const MEP_MANIFOLD_CONTEXTUAL_TRIGGER = 'mep-manifold-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Bar width (mm) — the run along which outlets line up. 400 = manifold default.
const WIDTH_MM_OPTIONS = [
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

// Depth (mm).
const LENGTH_MM_OPTIONS = [
  { value: '60',  labelKey: '60',  isLiteralLabel: true },
  { value: '80',  labelKey: '80',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '120', labelKey: '120', isLiteralLabel: true },
] as const;

// Body vertical height (mm).
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '40',  labelKey: '40',  isLiteralLabel: true },
  { value: '60',  labelKey: '60',  isLiteralLabel: true },
  { value: '80',  labelKey: '80',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — vertical centre, near floor level.
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
] as const;

// Outlet count (1..12 — MIN/MAX_MANIFOLD_OUTLET_COUNT).
const OUTLET_COUNT_OPTIONS = [
  { value: '2',  labelKey: '2',  isLiteralLabel: true },
  { value: '3',  labelKey: '3',  isLiteralLabel: true },
  { value: '4',  labelKey: '4',  isLiteralLabel: true },
  { value: '5',  labelKey: '5',  isLiteralLabel: true },
  { value: '6',  labelKey: '6',  isLiteralLabel: true },
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
] as const;

// Inlet diameter (mm) — typical supply headers.
const INLET_DIAMETER_MM_OPTIONS = [
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '32', labelKey: '32', isLiteralLabel: true },
  { value: '40', labelKey: '40', isLiteralLabel: true },
] as const;

// Outlet diameter (mm) — typical PEX branches.
const OUTLET_DIAMETER_MM_OPTIONS = [
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '16', labelKey: '16', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
] as const;

// System classification (ADR-408 Φ-heating) — the hydraulic type the manifold
// distributes. Translated labels (NO isLiteralLabel → passes through t()). The 5
// values mirror `PlumbingSystemClassification`; the manifold owns it and a network
// created from this manifold inherits it.
const CLASSIFICATION_OPTIONS = [
  { value: 'domestic-cold-water', labelKey: 'ribbon.commands.mepClassification.domestic-cold-water' },
  { value: 'domestic-hot-water', labelKey: 'ribbon.commands.mepClassification.domestic-hot-water' },
  { value: 'sanitary-drainage', labelKey: 'ribbon.commands.mepClassification.sanitary-drainage' },
  { value: 'hydronic-supply', labelKey: 'ribbon.commands.mepClassification.hydronic-supply' },
  { value: 'hydronic-return', labelKey: 'ribbon.commands.mepClassification.hydronic-return' },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_MANIFOLD_TAB: RibbonTab = {
  id: 'mep-manifold-editor',
  labelKey: 'ribbon.tabs.mepManifoldProperties',
  isContextual: true,
  contextualTrigger: MEP_MANIFOLD_CONTEXTUAL_TRIGGER,
  panels: [
    {
      // ADR-408 Φ-heating — manifold-owned hydraulic classification (ύδρευση/
      // θέρμανση). Always visible (an intrinsic manifold property). The combobox
      // routes through the manifold bridge's string-enum branch, which re-seeds the
      // connectors with the new classification.
      id: 'mep-manifold-system',
      labelKey: 'ribbon.panels.mepManifoldSystem',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.classification',
                labelKey: 'ribbon.commands.mepClassification.label',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.classification,
                comboboxWidthPx: 150,
                options: CLASSIFICATION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-manifold-geometry',
      labelKey: 'ribbon.panels.mepManifoldGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.width',
                labelKey: 'ribbon.commands.mepManifoldEditor.width',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.length',
                labelKey: 'ribbon.commands.mepManifoldEditor.length',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.bodyHeight',
                labelKey: 'ribbon.commands.mepManifoldEditor.bodyHeight',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.mountingElevation',
                labelKey: 'ribbon.commands.mepManifoldEditor.mountingElevation',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-manifold-outlets',
      labelKey: 'ribbon.panels.mepManifoldOutlets',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.outletCount',
                labelKey: 'ribbon.commands.mepManifoldEditor.outletCount',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.outletCount,
                comboboxWidthPx: 70,
                options: OUTLET_COUNT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.inletDiameter',
                labelKey: 'ribbon.commands.mepManifoldEditor.inletDiameter',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter,
                comboboxWidthPx: 80,
                options: INLET_DIAMETER_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepManifold.outletDiameter',
                labelKey: 'ribbon.commands.mepManifoldEditor.outletDiameter',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter,
                comboboxWidthPx: 80,
                options: OUTLET_DIAMETER_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-408 Φ13 fold-in — manage the plumbing network this manifold sources
      // (Revit "System Properties" from the equipment). Self-hides
      // (visibilityKey hasNetwork) when the manifold sources no network. Reuses
      // the domain-agnostic `mep-circuit-*` widgets + pipe-network actions — the
      // same pattern as the «Κύκλωμα» panel inside «Ιδιότητες Φωτιστικού».
      id: 'mep-manifold-network',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      visibilityKey: MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork,
      rows: [
        {
          // Row 1 — network selector (shared system-agnostic picker widget).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepManifold.network.picker',
                labelKey: 'ribbon.commands.mepCircuit.networkPicker',
                commandKey: 'mepManifold.network.picker',
              },
            },
          ],
        },
        {
          // Row 2 — name (left) + add-members action (right).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-name',
              command: {
                id: 'mepManifold.network.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepManifold.network.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepManifold.network.addMembers',
                labelKey: 'ribbon.commands.mepPipeNetwork.addMembers',
                tooltipKey: 'ribbon.commands.mepPipeNetwork.addMembersTooltip',
                icon: 'bim-pipe',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.addMembers,
              },
            },
          ],
        },
        {
          // Row 3 — colour (left) + remove-members action (right).
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'mepManifold.network.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepManifold.network.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepManifold.network.removeMembers',
                labelKey: 'ribbon.commands.mepPipeNetwork.removeMembers',
                tooltipKey: 'ribbon.commands.mepPipeNetwork.removeMembersTooltip',
                icon: 'trash',
                commandKey: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
                action: MEP_PIPE_NETWORK_RIBBON_ACTIONS.removeMembers,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-manifold-actions',
      labelKey: 'ribbon.panels.mepManifoldActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepManifold.close',
                labelKey: 'ribbon.commands.mepManifoldEditor.close',
                icon: 'select',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close,
                action: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepManifold.delete',
                labelKey: 'ribbon.commands.mepManifoldEditor.delete',
                icon: 'trash',
                commandKey: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
