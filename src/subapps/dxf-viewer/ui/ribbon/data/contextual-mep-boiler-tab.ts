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
import {
  BOILER_RELIEF_PRESSURES_BAR,
  BOILER_EXPANSION_VESSEL_VOLUMES_L,
  BOILER_SYSTEM_PRESSURES_BAR,
} from '../../../bim/types/mep-boiler-types';
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

// Condensate drain (αποχέτευση συμπυκνωμάτων) diameter (mm) — typical condensate trap line DN20/25/32.
const CONDENSATE_DIAMETER_MM_OPTIONS = [
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '32', labelKey: '32', isLiteralLabel: true },
] as const;

// Service-clearance distance (mm) — Revit Mechanical Equipment «Clearances». Uniform
// keep-clear envelope offset outward from the footprint for maintenance access.
const SERVICE_CLEARANCE_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
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

// Measured NOx emissions (mg/kWh) — Revit «NOx Emission». Editable; spans the two EU Ecodesign
// ceilings (gas ≤56, oil ≤120) so the picker covers both a compliant gas figure and a typical
// oil one. Integer mg → plain numeric combobox (no rounding hazard). Drives the read-only NOx
// compliance readout (resolveNoxClass).
const NOX_MG_KWH_OPTIONS = [
  { value: '30',  labelKey: '30',  isLiteralLabel: true },
  { value: '40',  labelKey: '40',  isLiteralLabel: true },
  { value: '56',  labelKey: '56',  isLiteralLabel: true },
  { value: '80',  labelKey: '80',  isLiteralLabel: true },
  { value: '120', labelKey: '120', isLiteralLabel: true },
] as const;

// Measured sound power level L_WA (dB(A)) — Revit Mechanical Equipment «Sound». Editable; spans the
// guidance bands (≤45 quiet, ≤55 standard, >55 loud) so the picker covers a quiet wall-hung gas unit
// up to a floor-standing oil one. Integer dB → plain numeric combobox (no rounding hazard). Drives the
// read-only placement-suitability readout (resolveAcousticBand). ANY fuel type (≠ NOx, combustion-only).
const SOUND_POWER_DBA_OPTIONS = [
  { value: '40', labelKey: '40', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '55', labelKey: '55', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
] as const;

// Safety relief valve set pressure (bar) — Revit «Safety Relief Valve» set pressure. Derived
// from the SSoT standard valve ratings (BOILER_RELIEF_PRESSURES_BAR) so the picker and the
// param defaults never drift. String values (fractional ratings → string combobox, not numeric).
const RELIEF_PRESSURE_BAR_OPTIONS = BOILER_RELIEF_PRESSURES_BAR.map((p) => ({
  value: String(p),
  labelKey: String(p),
  isLiteralLabel: true,
}));

// Expansion-vessel volume (L) — Revit Mechanical Equipment accessory. Derived from the SSoT
// standard vessel ratings (BOILER_EXPANSION_VESSEL_VOLUMES_L) so picker + param defaults never
// drift. Integer values → plain numeric combobox (no rounding hazard, unlike the relief pressure).
const EXPANSION_VESSEL_VOLUME_L_OPTIONS = BOILER_EXPANSION_VESSEL_VOLUMES_L.map((v) => ({
  value: String(v),
  labelKey: String(v),
  isLiteralLabel: true,
}));

// Pressure-gauge system (cold fill) pressure (bar) — Revit accessory (IFC IfcSensor PRESSURE).
// Derived from the SSoT standard fill pressures (BOILER_SYSTEM_PRESSURES_BAR) so picker + param
// defaults never drift. String values (fractional → string combobox, not numeric — same as relief
// pressure; DISTINCT property = the system fill pressure, not the valve set pressure).
const SYSTEM_PRESSURE_BAR_OPTIONS = BOILER_SYSTEM_PRESSURES_BAR.map((p) => ({
  value: String(p),
  labelKey: String(p),
  isLiteralLabel: true,
}));

// Nominal catalogue thermal output (W) — typical residential/commercial boiler range.
const THERMAL_OUTPUT_W_OPTIONS = [
  { value: '6000',  labelKey: '6000',  isLiteralLabel: true },
  { value: '12000', labelKey: '12000', isLiteralLabel: true },
  { value: '18000', labelKey: '18000', isLiteralLabel: true },
  { value: '24000', labelKey: '24000', isLiteralLabel: true },
  { value: '35000', labelKey: '35000', isLiteralLabel: true },
] as const;

// Minimum modulating output (W) — Revit «Turndown Ratio». Integer W → plain numeric combobox
// (no rounding hazard). The nominal/maximum is `thermalOutput`; min < max → a turndown ratio.
const MIN_THERMAL_OUTPUT_W_OPTIONS = [
  { value: '3000',  labelKey: '3000',  isLiteralLabel: true },
  { value: '6000',  labelKey: '6000',  isLiteralLabel: true },
  { value: '9000',  labelKey: '9000',  isLiteralLabel: true },
  { value: '12000', labelKey: '12000', isLiteralLabel: true },
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
              // ADR-408 — standalone HEATING FUEL picker (Revit editable instance param).
              // Options are supplied dynamically by the bridge (BOILER_FUEL_TYPES + clear
              // sentinel → getComboboxState), mirroring the model-picker pattern (declare
              // [] here). Setting it on a parametric boiler opens the combustion panels.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.fuelType',
                labelKey: 'ribbon.commands.mepBoilerEditor.fuelType',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.fuelType,
                comboboxWidthPx: 150,
                options: [],
              },
            },
            {
              // ADR-408 — standalone MOUNTING picker (Revit «Mounting» type-property:
              // wall-hung / floor-standing). Options are supplied dynamically by the bridge
              // (MEP_BOILER_MOUNTING_TYPES → getComboboxState; declare [] here). Floor-standing
              // boilers ignore the wall-mounting elevation (the oil-floor catalog presets).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.mountingType',
                labelKey: 'ribbon.commands.mepBoilerEditor.mountingType',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.mountingType,
                comboboxWidthPx: 150,
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
            {
              // ADR-408 Εύρος Β (condensate drain) — «Συμπύκνωση» Revit Yes/No toggle. ON →
              // condensing=true → a condensate drain connector is seeded (REUSING
              // sanitary-drainage) + the «Συμπύκνωση» panel (diameter) appears. Lives in the
              // combustion «Καπναγωγός» panel: condensate is the liquid product of flue-gas
              // condensation. Mirror του producesDhw toggle.
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.condensing',
                labelKey: 'ribbon.commands.mepBoilerEditor.condensing',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.condensing,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β (condensate drain) — «Συμπύκνωση» panel: εμφανίζεται μόνο για λέβητα
    // συμπύκνωσης (visibilityKey `condensing` → bridge.getPanelVisibility → condensing).
    // Condensate drain (αποχέτευση συμπυκνωμάτων) connector diameter (typical trap DN20/25/32).
    {
      id: 'mep-boiler-condensate',
      labelKey: 'ribbon.panels.mepBoilerCondensate',
      visibilityKey: MEP_BOILER_RIBBON_VISIBILITY_KEYS.condensing,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.condensateDiameter',
                labelKey: 'ribbon.commands.mepBoilerEditor.condensateDiameter',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.condensateDiameter,
                comboboxWidthPx: 90,
                options: CONDENSATE_DIAMETER_MM_OPTIONS,
              },
            },
            {
              // ADR-408 Εύρος Β (condensate neutraliser) — «Εξουδετερωτής» Revit Yes/No toggle.
              // ON → an in-line cartridge box is drawn on the condensate drain (de-acidifies
              // the condensate before the sewer). Condensing-only panel.
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.condensateNeutraliser',
                labelKey: 'ribbon.commands.mepBoilerEditor.condensateNeutraliser',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.condensateNeutraliser,
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
    // ADR-408 Εύρος Β — «Καθαρός χώρος» panel (Revit Mechanical Equipment «Clearances»).
    // Always visible (clearance applies to every boiler): a Yes/No toggle to show the dashed
    // keep-clear envelope + the uniform clearance distance. Visualisation only — no connector.
    {
      id: 'mep-boiler-clearance',
      labelKey: 'ribbon.panels.mepBoilerClearance',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.showServiceClearance',
                labelKey: 'ribbon.commands.mepBoilerEditor.showServiceClearance',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.showServiceClearance,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.serviceClearance',
                labelKey: 'ribbon.commands.mepBoilerEditor.serviceClearance',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.serviceClearance,
                comboboxWidthPx: 90,
                options: SERVICE_CLEARANCE_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    // ADR-408 Εύρος Β — «Ασφάλεια» panel (Revit «Safety Relief Valve»). Always visible (every
    // boiler must carry a code-mandatory relief valve): a Yes/No toggle to draw the relief-valve
    // body glyph + the set-pressure picker. Visualisation only — no connector (the perimeter is full).
    {
      id: 'mep-boiler-safety',
      labelKey: 'ribbon.panels.mepBoilerSafety',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.safetyReliefValve',
                labelKey: 'ribbon.commands.mepBoilerEditor.safetyReliefValve',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.safetyReliefValve,
              },
            },
            {
              // ADR-408 — relief-valve SET PRESSURE picker. Options are supplied dynamically by
              // the bridge (BOILER_RELIEF_PRESSURES_BAR → getComboboxState); a static enum routed
              // by `isMepBoilerReliefPressureKey`. Declared here for the static fallback too.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.reliefValvePressure',
                labelKey: 'ribbon.commands.mepBoilerEditor.reliefValvePressure',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.reliefValvePressure,
                comboboxWidthPx: 90,
                options: RELIEF_PRESSURE_BAR_OPTIONS,
              },
            },
            {
              // ADR-408 Εύρος Β — EXPANSION VESSEL (Revit accessory, IFC IfcTank EXPANSION) Yes/No
              // toggle. ON → the plan symbol draws a diaphragm-vessel body glyph (sealed-system
              // partner of the relief valve). Visualisation only — no connector.
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.expansionVessel',
                labelKey: 'ribbon.commands.mepBoilerEditor.expansionVessel',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.expansionVessel,
              },
            },
            {
              // ADR-408 — expansion-vessel VOLUME picker (integer litres → plain numeric combobox).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.expansionVesselVolume',
                labelKey: 'ribbon.commands.mepBoilerEditor.expansionVesselVolume',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.expansionVesselVolume,
                comboboxWidthPx: 90,
                options: EXPANSION_VESSEL_VOLUME_L_OPTIONS,
              },
            },
            {
              // ADR-408 Εύρος Β — PRESSURE GAUGE (Revit accessory, IFC IfcSensor PRESSURE) Yes/No
              // toggle. ON → the plan symbol draws a dial-gauge body glyph (third sealed-system
              // instrument: relief valve + expansion vessel + gauge). Visualisation only — no connector.
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.pressureGauge',
                labelKey: 'ribbon.commands.mepBoilerEditor.pressureGauge',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.pressureGauge,
              },
            },
            {
              // ADR-408 — system (cold fill) PRESSURE picker. Options are supplied dynamically by
              // the bridge (BOILER_SYSTEM_PRESSURES_BAR → getComboboxState); a static enum routed
              // by `isMepBoilerSystemPressureKey` (fractional → string combobox, not numeric).
              // DISTINCT from the relief-valve set-pressure picker above (system fill vs valve lift).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.systemPressure',
                labelKey: 'ribbon.commands.mepBoilerEditor.systemPressure',
                commandKey: MEP_BOILER_RIBBON_KEYS.stringParams.systemPressure,
                comboboxWidthPx: 90,
                options: SYSTEM_PRESSURE_BAR_OPTIONS,
              },
            },
            {
              // ADR-408 Εύρος Β — FILLING LOOP (βρόχος πλήρωσης, Revit/IFC IfcValve CHECK) Yes/No
              // toggle. ON → the plan symbol draws a filling-loop body glyph (double-check valve +
              // flexible loop + isolation ticks) — the sealed-system charging device that completes
              // the family (valve + vessel + gauge + filling loop). Visualisation only — no connector,
              // no extra pressure (the fill target is the gauge's system pressure above).
              type: 'toggle',
              size: 'small',
              command: {
                id: 'mepBoiler.fillingLoop',
                labelKey: 'ribbon.commands.mepBoilerEditor.fillingLoop',
                commandKey: MEP_BOILER_RIBBON_KEYS.toggles.fillingLoop,
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
              // ADR-408 — minimum modulating output (Revit «Turndown Ratio»). Editable W; the
              // nominal/maximum is `thermalOutput` above, and min < max yields the turndown
              // ratio shown on the plan tag. Plain numeric combobox (integer W).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.minThermalOutput',
                labelKey: 'ribbon.commands.mepBoilerEditor.minThermalOutput',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.minThermalOutput,
                comboboxWidthPx: 90,
                options: MIN_THERMAL_OUTPUT_W_OPTIONS,
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
            {
              // ADR-408 — measured NOx emissions (Revit «NOx Emission»). Editable mg/kWh;
              // drives the NOx compliance readout below. Combustion fuels only (the readout
              // returns «—» for electric/heat-pump), plain numeric combobox.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.nox',
                labelKey: 'ribbon.commands.mepBoilerEditor.nox',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.nox,
                comboboxWidthPx: 90,
                options: NOX_MG_KWH_OPTIONS,
              },
            },
            {
              // ADR-408 — EU Ecodesign NOx compliance readout (read-only; bridge returns
              // `disabled` state). Derived from noxMgKwh + fuelType (resolveNoxClass).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.noxClass',
                labelKey: 'ribbon.commands.mepBoilerEditor.noxClass',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.noxClass,
                comboboxWidthPx: 100,
                options: [],
              },
            },
            {
              // ADR-408 — measured sound power level L_WA (Revit «Sound»). Editable dB(A);
              // drives the placement-suitability readout below. ANY fuel type (a pump/fan/burner
              // all emit noise, ≠ NOx combustion-only), plain numeric combobox (integer dB).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.soundPower',
                labelKey: 'ribbon.commands.mepBoilerEditor.soundPower',
                commandKey: MEP_BOILER_RIBBON_KEYS.params.soundPower,
                comboboxWidthPx: 110,
                options: SOUND_POWER_DBA_OPTIONS,
              },
            },
            {
              // ADR-408 — placement-suitability band readout (read-only; bridge returns
              // `disabled` state). Derived from soundPowerDbA (resolveAcousticBand). A guidance
              // heuristic (quiet/standard/loud), NOT a legal limit — see boiler-acoustics.ts.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepBoiler.acousticBand',
                labelKey: 'ribbon.commands.mepBoilerEditor.acousticBand',
                commandKey: MEP_BOILER_RIBBON_KEYS.readouts.acousticBand,
                comboboxWidthPx: 110,
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
