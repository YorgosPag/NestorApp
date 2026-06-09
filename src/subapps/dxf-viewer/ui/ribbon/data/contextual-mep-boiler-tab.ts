/**
 * ADR-408 Εύρος Β — Contextual ribbon tab για τον heating boiler (λέβητα).
 *
 * Trigger: `mep-boiler-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity έχει
 * `type === 'mep-boiler'`). Συνδυασμός του «Ιδιότητες Καλοριφέρ» (ADR-408 Εύρος Β)
 * + του «Δίκτυο» fold-in panel του «Ιδιότητες Συλλέκτη» (ADR-408 Φ12) — ο λέβητας
 * είναι ΥΔΡΟΝΙΚΗ ΠΗΓΗ (≠ καλοριφέρ που είναι τερματικό), επομένως μπορεί να
 * τροφοδοτεί δίκτυο σωλήνων.
 *
 * Panels:
 *   Geometry → width + length + body height + mounting elevation
 *   Thermal  → connector diameter + thermal output (W, catalogue)
 *   Δίκτυο   → fold-in (self-hiding): picker / name + addMembers / color + removeMembers
 *   Actions  → close + delete
 *
 * Live behavior: ο bridge (`useRibbonMepBoilerBridge`) dispatch-άρει updates σε
 * κάθε combobox change μέσω `UpdateMepBoilerParamsCommand` (undoable). Το command
 * ΗΔΗ ξανακάνει seed τους connectors από το `width`, οπότε ο bridge δεν χρειάζεται
 * να τους προ-υπολογίσει (≠ manifold).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_BOILER_RIBBON_KEYS,
  MEP_BOILER_RIBBON_KEYS_ACTIONS,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-boiler-command-keys';
import { MEP_PIPE_NETWORK_RIBBON_ACTIONS } from '../hooks/bridge/mep-pipe-network-command-keys';

// NOTE: the model combobox declares `options: []` here — the bridge
// (useRibbonMepBoilerBridge.getComboboxState) returns the dynamic options list
// from BOILER_MODEL_CATALOG at runtime, exactly like the sanitary-fixture assetId
// picker (ADR-411 pattern: bridge supplies options, tab declares empty array).

export const MEP_BOILER_CONTEXTUAL_TRIGGER = 'mep-boiler-selected';

// ─── Combobox options (mm presets) ───────────────────────────────────────────

// Body width (mm) — the largest horizontal dimension of the boiler cabinet.
const WIDTH_MM_OPTIONS = [
  { value: '400',  labelKey: '400',  isLiteralLabel: true },
  { value: '450',  labelKey: '450',  isLiteralLabel: true },
  { value: '600',  labelKey: '600',  isLiteralLabel: true },
  { value: '800',  labelKey: '800',  isLiteralLabel: true },
] as const;

// Depth (mm) — front-to-back depth of the boiler cabinet.
const LENGTH_MM_OPTIONS = [
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '350', labelKey: '350', isLiteralLabel: true },
  { value: '450', labelKey: '450', isLiteralLabel: true },
] as const;

// Body vertical height (mm) — typical wall-hung boiler heights.
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '700', labelKey: '700', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — vertical centre (wall-mounted boiler).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '900',  labelKey: '900',  isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1500', labelKey: '1500', isLiteralLabel: true },
] as const;

// Supply/return connector diameter (mm) — typical hydronic boiler tails.
const CONNECTOR_DIAMETER_MM_OPTIONS = [
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '22', labelKey: '22', isLiteralLabel: true },
  { value: '28', labelKey: '28', isLiteralLabel: true },
] as const;

// COMBI DHW connector diameter (mm) — tap-water tails, smaller than hydronic (DN15 default).
const DHW_CONNECTOR_DIAMETER_MM_OPTIONS = [
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '22', labelKey: '22', isLiteralLabel: true },
] as const;

// Combustion flue (καπναγωγός) diameter (mm) — typical condensing flue sizes DN80/100/130.
const FLUE_DIAMETER_MM_OPTIONS = [
  { value: '80',  labelKey: '80',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '130', labelKey: '130', isLiteralLabel: true },
] as const;

// Combustion fuel supply (τροφοδοσία καυσίμου) diameter (mm) — typical gas/oil line DN15/20/25.
const FUEL_DIAMETER_MM_OPTIONS = [
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
] as const;

// Seasonal appliance efficiency (%) — Revit «Nominal Efficiency». Editable; the heat-pump
// catalogue value (~156%) lands above the list but the bridge still surfaces it as the
// current value (editable combobox). Drives the read-only ErP class readout.
const EFFICIENCY_PERCENT_OPTIONS = [
  { value: '80', labelKey: '80', isLiteralLabel: true },
  { value: '85', labelKey: '85', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
  { value: '94', labelKey: '94', isLiteralLabel: true },
  { value: '98', labelKey: '98', isLiteralLabel: true },
] as const;

// Nominal catalogue thermal output (W) — typical residential/commercial boiler range.
const THERMAL_OUTPUT_W_OPTIONS = [
  { value: '6000',  labelKey: '6000',  isLiteralLabel: true },
  { value: '12000', labelKey: '12000', isLiteralLabel: true },
  { value: '18000', labelKey: '18000', isLiteralLabel: true },
  { value: '24000', labelKey: '24000', isLiteralLabel: true },
  { value: '35000', labelKey: '35000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_BOILER_TAB: RibbonTab = {
  id: 'mep-boiler-editor',
  labelKey: 'ribbon.tabs.mepBoilerProperties',
  isContextual: true,
  contextualTrigger: MEP_BOILER_CONTEXTUAL_TRIGGER,
  panels: [
    // Revit convention: "Type" (model catalog) panel comes FIRST so the user
    // picks a family type before editing individual parameters.
    {
      id: 'mep-boiler-model',
      labelKey: 'ribbon.panels.mepBoilerModel',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.modelId',
                labelKey: 'ribbon.commands.mepBoilerEditor.modelId',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.modelId,
                comboboxWidthPx: 220,
                // Options are supplied dynamically by the bridge at runtime
                // (BOILER_MODEL_CATALOG → getComboboxState). Declaring [] here
                // mirrors the sanitary-fixture assetId picker pattern (ADR-411).
                options: [],
              },
            },
            {
              // ADR-408 Εύρος Β (combi) — «Παραγωγή ΖΝΧ» Revit Yes/No toggle. ON →
              // producesDhw=true → DHW hot outlet + cold inlet connectors seeded (combi
              // takes cold water, makes hot). Mirror του roof `slopeUnitPercent` toggle.
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.producesDhw',
                labelKey: 'ribbon.commands.mepBoilerEditor.producesDhw',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.producesDhw,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β (combi) — «ΖΝΧ» panel: εμφανίζεται μόνο όταν ο λέβητας είναι combi
    // (visibilityKey `combi` → bridge.getPanelVisibility → producesDhw). DHW connector
    // diameter (hot outlet + cold inlet· typical DN15, smaller than the hydronic tails).
    {
      id: 'mep-boiler-dhw',
      labelKey: 'ribbon.panels.mepBoilerDhw',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.combi,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.dhwConnectorDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.dhwConnectorDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter,
                comboboxWidthPx: 90,
                options: DHW_CONNECTOR_DIAMETER_MM_OPTIONS,
              },
            },
            {
              // ADR-408 Εύρος Β (combi + recirculation) — «Ανακυκλοφορία ΖΝΧ» Revit Yes/No
              // toggle. ON → recirc return inlet seeded on the same DHW network (re-heat loop,
              // Revit "Domestic Hot Water + Recirculation"). Combi-only panel (visibilityKey combi).
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.dhwRecirculation',
                labelKey: 'ribbon.commands.mepBoilerEditor.dhwRecirculation',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 (duct domain foundation) — «Καπναγωγός» panel: εμφανίζεται μόνο για λέβητα
    // καύσης (visibilityKey `combustion` → bridge.getPanelVisibility → fuelType gas/oil).
    // Flue (καπναγωγός) connector diameter (typical condensing flue DN80/100/130).
    {
      id: 'mep-boiler-flue',
      labelKey: 'ribbon.panels.mepBoilerFlue',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.combustion,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.flueDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.flueDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.flueDiameter,
                comboboxWidthPx: 90,
                options: FLUE_DIAMETER_MM_OPTIONS,
              },
            },
            {
              // ADR-408 Vent Terminal (καμινάδα) — flue termination type picker. Options
              // are supplied dynamically by the bridge (FLUE_TERMINATION_TYPES →
              // getComboboxState), mirroring the model-picker pattern (declare [] here).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.flueTermination',
                labelKey: 'ribbon.commands.mepBoilerEditor.flueTermination',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.flueTermination,
                comboboxWidthPx: 160,
                options: [],
              },
            },
          ],
        },
      ],
    },
    // ADR-408 (fuel domain foundation) — «Καύσιμο» panel: εμφανίζεται μόνο για λέβητα
    // καύσης (visibilityKey `combustion`, reused — ίδιο gate gas/oil με τον καπναγωγό).
    // Fuel supply (τροφοδοσία καυσίμου) connector diameter (typical gas/oil line DN15/20/25).
    {
      id: 'mep-boiler-fuel',
      labelKey: 'ribbon.panels.mepBoilerFuel',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.combustion,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.fuelDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.fuelDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.fuelDiameter,
                comboboxWidthPx: 90,
                options: FUEL_DIAMETER_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-boiler-geometry',
      labelKey: 'ribbon.panels.mepBoilerGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.width',
                labelKey: 'ribbon.commands.mepBoilerEditor.width',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.length',
                labelKey: 'ribbon.commands.mepBoilerEditor.length',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: LENGTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.bodyHeight',
                labelKey: 'ribbon.commands.mepBoilerEditor.bodyHeight',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.mountingElevation',
                labelKey: 'ribbon.commands.mepBoilerEditor.mountingElevation',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-boiler-thermal',
      labelKey: 'ribbon.panels.mepBoilerThermal',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.connectorDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.connectorDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.connectorDiameter,
                comboboxWidthPx: 80,
                options: CONNECTOR_DIAMETER_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.thermalOutput',
                labelKey: 'ribbon.commands.mepBoilerEditor.thermalOutput',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.thermalOutput,
                comboboxWidthPx: 90,
                options: THERMAL_OUTPUT_W_OPTIONS,
              },
            },
            {
              // ADR-408 — seasonal appliance efficiency (Revit «Nominal Efficiency»).
              // Editable %; drives the ErP class readout below.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.efficiency',
                labelKey: 'ribbon.commands.mepBoilerEditor.efficiency',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.efficiency,
                comboboxWidthPx: 90,
                options: EFFICIENCY_PERCENT_OPTIONS,
              },
            },
            {
              // ADR-408 — EU ErP energy class readout (read-only; bridge returns
              // `disabled` state). Derived from efficiency + fuelType (resolveErpClass).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.erpClass',
                labelKey: 'ribbon.commands.mepBoilerEditor.erpClass',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.erpClass,
                comboboxWidthPx: 80,
                options: [],
              },
            },
          ],
        },
      ],
    },
    // ADR-422 L2 — sizing readout (Revit «Heating Loads → Equipment»). Read-only
    // comboboxes (`options: []` → bridge returns `disabled` state): απαιτούμενη
    // ισχύς (ΣΦ χώρων που εξυπηρετεί × pickup) vs εγκατεστημένη + δείκτης επάρκειας.
    {
      id: 'mep-boiler-sizing',
      labelKey: 'ribbon.panels.mepBoilerSizing',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.requiredOutput',
                labelKey: 'ribbon.commands.mepBoilerEditor.requiredOutput',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.installedOutput',
                labelKey: 'ribbon.commands.mepBoilerEditor.installedOutput',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.installedOutputW,
                comboboxWidthPx: 110,
                options: [],
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.adequacy',
                labelKey: 'ribbon.commands.mepBoilerEditor.adequacy',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus,
                comboboxWidthPx: 140,
                options: [],
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β — fold-in panel: διαχείριση υδρονικού δικτύου που πηγάζει
    // από τον λέβητα (Revit "System Properties" from the equipment). Self-hides
    // όταν δεν υπάρχει δίκτυο. Reuse των domain-agnostic mep-circuit-* widgets +
    // pipe-network actions (ίδια με τον συλλέκτη, ADR-408 Φ13).
    {
      id: 'mep-boiler-network',
      labelKey: 'ribbon.panels.mepPipeNetworkProperties',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-picker',
              command: {
                id: 'mepBoiler.network.picker',
                labelKey: 'ribbon.commands.mepCircuit.networkPicker',
                commandKey: 'mepBoiler.network.picker',
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
                id: 'mepBoiler.network.name',
                labelKey: 'ribbon.commands.mepCircuit.name',
                commandKey: 'mepBoiler.network.name',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.network.addMembers',
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
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'small',
              widgetId: 'mep-circuit-color',
              command: {
                id: 'mepBoiler.network.color',
                labelKey: 'ribbon.commands.mepCircuit.color',
                commandKey: 'mepBoiler.network.color',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.network.removeMembers',
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
      id: 'mep-boiler-actions',
      labelKey: 'ribbon.panels.mepBoilerActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.close',
                labelKey: 'ribbon.commands.mepBoilerEditor.close',
                icon: 'select',
                commandKey: MEP_BOILER_RIBBON_KEYS_ACTIONS.close,
                action: MEP_BOILER_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepBoiler.delete',
                labelKey: 'ribbon.commands.mepBoilerEditor.delete',
                icon: 'trash',
                commandKey: MEP_BOILER_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_BOILER_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
