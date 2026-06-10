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

export const ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER = 'electrical-panel-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Panel face width (mm) — single → multi-gang consumer unit / distribution board.
const WIDTH_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

// Panel depth into the wall (mm).
const LENGTH_MM_OPTIONS = [
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

const ROTATION_DEG_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
  { value: '135', labelKey: '135', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '225', labelKey: '225', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
  { value: '315', labelKey: '315', isLiteralLabel: true },
] as const;

// Panel box vertical height (mm).
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '700', labelKey: '700', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Wall-mount vertical-centre elevation above FFL (mm) — IEC/Revit reachability
// (breakers ≤ ~2 m).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1400', labelKey: '1400', isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
  { value: '1700', labelKey: '1700', isLiteralLabel: true },
  { value: '1800', labelKey: '1800', isLiteralLabel: true },
] as const;

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
