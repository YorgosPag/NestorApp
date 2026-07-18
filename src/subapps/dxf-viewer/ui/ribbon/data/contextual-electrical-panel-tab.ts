/**
 * ADR-408 Φ3/Φ6 — Contextual ribbon tab για τον ηλεκτρικό πίνακα (electrical panel /
 * πίνακας διανομής — Revit "Electrical Equipment", IfcElectricDistributionBoard).
 *
 * Trigger: `electrical-panel-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `electrical-panel`).
 *
 * Revit-true: η επιλογή ενός πίνακα δείχνει τις ΔΙΚΕΣ ΤΟΥ ιδιότητες (γεωμετρία) +
 * έναν "Edit Circuits" χώρο για τα κυκλώματα που τροφοδοτεί — ΟΧΙ τις ιδιότητες ενός
 * μεμονωμένου κυκλώματος (ένας πίνακας τροφοδοτεί ΠΟΛΛΑ). Πανομοιότυπο pattern με τον
 * συλλέκτη/λέβητα: «equipment tab με folded, self-hiding management panel».
 *
 * SSoT:
 *   - Γεωμετρία → `useRibbonElectricalPanelBridge` + το ΥΠΑΡΧΟΝ
 *     `UpdateElectricalPanelParamsCommand` (ίδιο command με τα grips).
 *   - «Κυκλώματα» (fold-in, self-hiding) → ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ αυτούσια τα circuit
 *     widgets (`mep-circuit-*`) + τα ηλεκτρικά circuit actions
 *     (`MEP_CIRCUIT_RIBBON_ACTIONS`), όπως το `contextual-mep-circuit-tab.ts`. Τα
 *     widgets συγχρονίζονται με τον επιλεγμένο πίνακα μέσω `useMepCircuitEditorSync`.
 *
 * @see ./contextual-mep-circuit-tab.ts — η πηγή των circuit widgets/actions
 * @see ./mep-manifold-contextual-tab-factory.ts — το αντίστοιχο fold-in pattern (νερό)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  ELECTRICAL_PANEL_RIBBON_KEYS,
  ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS,
  ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/electrical-panel-command-keys';
import { MEP_CIRCUIT_RIBBON_ACTIONS } from '../hooks/bridge/mep-circuit-command-keys';
import { literalNumberOptions } from './ribbon-numeric-options';

export const ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER = 'electrical-panel-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Panel face width (mm) — single → multi-gang consumer unit / distribution board.
const WIDTH_MM_OPTIONS = literalNumberOptions([300, 400, 500, 600, 800]);

// Panel depth into the wall (mm).
const LENGTH_MM_OPTIONS = literalNumberOptions([100, 150, 200, 250]);

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

// Panel box vertical height (mm).
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([400, 500, 600, 700, 900]);

// Wall-mount vertical-centre elevation above FFL (mm) — IEC/Revit reachability
// (breakers ≤ ~2 m).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([1200, 1400, 1500, 1700, 1800]);

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_ELECTRICAL_PANEL_TAB: RibbonTab = {
  id: 'electrical-panel-editor',
  labelKey: 'ribbon.tabs.electricalPanelProperties',
  isContextual: true,
  contextualTrigger: ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'electrical-panel-geometry',
      labelKey: 'ribbon.panels.electricalPanelGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'electricalPanel.width',
                labelKey: 'ribbon.commands.electricalPanelEditor.width',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'electricalPanel.length',
                labelKey: 'ribbon.commands.electricalPanelEditor.length',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'electricalPanel.rotation',
                labelKey: 'ribbon.commands.electricalPanelEditor.rotation',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
                numericInput: { quantityKind: 'angle' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'electricalPanel.bodyHeight',
                labelKey: 'ribbon.commands.electricalPanelEditor.bodyHeight',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'electricalPanel.mountingElevation',
                labelKey: 'ribbon.commands.electricalPanelEditor.mountingElevation',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation,
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
      // Revit "Edit Circuits" — manage the circuits this panel sources. Self-hides
      // (visibilityKey) when the panel feeds no circuit. Reuses the SAME circuit
      // widgets + actions as the circuit tab (driven by useMepCircuitEditorSync +
      // useRibbonMepCircuitBridge), so the two never drift (SSoT).
      id: 'electrical-panel-circuits',
      labelKey: 'ribbon.panels.electricalPanelCircuits',
      visibilityKey: ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'electricalPanel.circuit.picker',
                labelKey: 'ribbon.commands.mepCircuit.circuitPicker',
                commandKey: 'electricalPanel.circuit.picker',
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-name',
              command: {
                id: 'electricalPanel.circuit.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'electricalPanel.circuit.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'electricalPanel.circuit.addMembers',
                labelKey: 'ribbon.commands.mepCircuit.addMembers',
                tooltipKey: 'ribbon.commands.mepCircuit.addMembersTooltip',
                icon: 'bim-mep-fixture',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.addMembers,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.addMembers,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'electricalPanel.circuit.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'electricalPanel.circuit.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'electricalPanel.circuit.removeMembers',
                labelKey: 'ribbon.commands.mepCircuit.removeMembers',
                tooltipKey: 'ribbon.commands.mepCircuit.removeMembersTooltip',
                icon: 'trash',
                commandKey: MEP_CIRCUIT_RIBBON_ACTIONS.removeMembers,
                action: MEP_CIRCUIT_RIBBON_ACTIONS.removeMembers,
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-wire-style',
              command: {
                id: 'electricalPanel.circuit.wireStyle',
                labelKey: 'ribbon.commands.mepWireStyle.label',
                commandKey: 'electricalPanel.circuit.wireStyle',
              },
            },
          ],
        },
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-conductors',
              command: {
                id: 'electricalPanel.circuit.conductors',
                labelKey: 'ribbon.commands.mepConductors.label',
                commandKey: 'electricalPanel.circuit.conductors',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'electrical-panel-actions',
      labelKey: 'ribbon.panels.electricalPanelActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'electricalPanel.close',
                labelKey: 'ribbon.commands.electricalPanelEditor.close',
                icon: 'select',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.close,
                action: ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'electricalPanel.delete',
                labelKey: 'ribbon.commands.electricalPanelEditor.delete',
                icon: 'trash',
                commandKey: ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.delete,
                action: ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
