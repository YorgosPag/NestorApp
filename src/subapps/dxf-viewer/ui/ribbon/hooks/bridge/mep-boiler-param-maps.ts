/**
 * ADR-408 Εύρος Β — Lookup maps: commandKey → `MepBoilerParams` field.
 *
 * Αυτά τα maps είναι pure data (μηδέν React, μηδέν side-effects) και αποτελούν
 * SSoT για την αντιστοίχιση ribbon command-keys → entity params fields.
 * Εξάγονται ξεχωριστά ώστε το `useRibbonMepBoilerBridge` να παραμένει ≤500 γραμμές.
 *
 * @see bridge/mep-boiler-command-keys.ts  (τα ίδια τα command-key strings)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepBoilerParams } from '../../../../bim/types/mep-boiler-types';
import { MEP_BOILER_RIBBON_KEYS } from './mep-boiler-command-keys';

/** commandKey → boolean toggle `MepBoilerParams` field (combi flag + recirculation). */
export const TOGGLE_KEY_TO_FIELD: Readonly<Record<string, keyof MepBoilerParams>> = {
  [MEP_BOILER_RIBBON_KEYS.toggles.producesDhw]: 'producesDhw',
  [MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation]: 'dhwRecirculation',
  [MEP_BOILER_RIBBON_KEYS.toggles.condensing]: 'condensing',
  [MEP_BOILER_RIBBON_KEYS.toggles.condensateNeutraliser]: 'condensateNeutraliser',
  [MEP_BOILER_RIBBON_KEYS.toggles.showServiceClearance]: 'showServiceClearance',
  [MEP_BOILER_RIBBON_KEYS.toggles.safetyReliefValve]: 'safetyReliefValve',
  [MEP_BOILER_RIBBON_KEYS.toggles.expansionVessel]: 'expansionVessel',
  [MEP_BOILER_RIBBON_KEYS.toggles.pressureGauge]: 'pressureGauge',
};

/** commandKey → numeric `MepBoilerParams` field. */
export const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepBoilerParams>> = {
  [MEP_BOILER_RIBBON_KEYS.params.width]: 'width',
  [MEP_BOILER_RIBBON_KEYS.params.length]: 'length',
  [MEP_BOILER_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_BOILER_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
  [MEP_BOILER_RIBBON_KEYS.params.connectorDiameter]: 'connectorDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.thermalOutput]: 'thermalOutputW',
  [MEP_BOILER_RIBBON_KEYS.params.minThermalOutput]: 'minThermalOutputW',
  [MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter]: 'dhwConnectorDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.flueDiameter]: 'flueDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.fuelDiameter]: 'fuelConnectorDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.condensateDiameter]: 'condensateConnectorDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.serviceClearance]: 'serviceClearanceMm',
  [MEP_BOILER_RIBBON_KEYS.params.expansionVesselVolume]: 'expansionVesselVolumeL',
  [MEP_BOILER_RIBBON_KEYS.params.efficiency]: 'seasonalEfficiencyPercent',
};
