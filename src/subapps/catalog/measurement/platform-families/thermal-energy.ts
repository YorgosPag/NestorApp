/**
 * Οικογένειες μέτρησης της πλατφόρμας — **θερμικά και ενεργειακά** μεγέθη (ADR-923 §5.2).
 * Δεδομένα, χωρίς λογική.
 *
 * 🔑 **Θερμοκρασία ≠ διαφορά θερμοκρασίας.** 20 °C → K = 293,15 (με μετατόπιση), αλλά ένα
 * ΔT 5 °C = 5 K (χωρίς). Οι κατάλογοι HVAC δίνουν **και τα δύο** (θερμοκρασία νερού 7/12 °C,
 * ΔT 5 K) — μια οικογένεια για τα δύο θα μετέτρεπε σιωπηλά το ΔT σε 278 K.
 *
 * Συντελεστές: BTU = International Table (1 BTU_IT = 1055,05585262 J) · kcal = IT (4186,8 J) ·
 * ψυκτικός τόνος = 12.000 BTU_IT/h · ίππος = μετρικός (PS, 735,49875 W).
 * @module subapps/catalog/measurement/platform-families/thermal-energy
 */

import type { PlatformMeasurementFamily } from '../../types/measurement-family';
import { platformFamilyLabel } from './platform-family-label';

const BTU_IT_JOULES = 1055.05585262;

export const THERMAL_ENERGY_FAMILIES: readonly PlatformMeasurementFamily[] = [
  {
    code: 'power',
    source: 'platform',
    label: platformFamilyLabel('power'),
    standardUnitCode: 'W',
    comparable: true,
    quantitySpec: 'power',
    units: [
      { code: 'W', symbol: 'W', factor: 1, unece: 'WTT' },
      { code: 'kW', symbol: 'kW', factor: 1000, unece: 'KWT' },
      { code: 'MW', symbol: 'MW', factor: 1_000_000, unece: 'MAW' },
      { code: 'BTU_h', symbol: 'BTU/h', factor: BTU_IT_JOULES / 3600 },
      { code: 'kcal_h', symbol: 'kcal/h', factor: 4186.8 / 3600 },
      { code: 'TR', symbol: 'TR', factor: (12000 * BTU_IT_JOULES) / 3600 },
      { code: 'PS', symbol: 'PS', factor: 735.49875 },
    ],
  },
  {
    code: 'energy',
    source: 'platform',
    label: platformFamilyLabel('energy'),
    standardUnitCode: 'J',
    comparable: true,
    units: [
      { code: 'J', symbol: 'J', factor: 1, unece: 'JOU' },
      { code: 'kJ', symbol: 'kJ', factor: 1000, unece: 'KJO' },
      { code: 'MJ', symbol: 'MJ', factor: 1_000_000 },
      { code: 'Wh', symbol: 'Wh', factor: 3600, unece: 'WHR' },
      { code: 'kWh', symbol: 'kWh', factor: 3_600_000, unece: 'KWH' },
      { code: 'MWh', symbol: 'MWh', factor: 3_600_000_000 },
      { code: 'kcal', symbol: 'kcal', factor: 4186.8 },
      { code: 'BTU', symbol: 'BTU', factor: BTU_IT_JOULES },
    ],
  },
  {
    code: 'temperature',
    source: 'platform',
    label: platformFamilyLabel('temperature'),
    standardUnitCode: 'K',
    comparable: true,
    quantitySpec: 'temperature',
    units: [
      { code: 'K', symbol: 'K', factor: 1, unece: 'KEL' },
      { code: 'C', symbol: '°C', factor: 1, offset: 273.15, unece: 'CEL' },
      { code: 'F', symbol: '°F', factor: 5 / 9, offset: (459.67 * 5) / 9, unece: 'FAH' },
    ],
  },
  {
    code: 'temperature_difference',
    source: 'platform',
    label: platformFamilyLabel('temperature_difference'),
    standardUnitCode: 'K',
    comparable: true,
    units: [
      { code: 'K', symbol: 'K', factor: 1 },
      { code: 'C', symbol: '°C', factor: 1 },
      { code: 'F', symbol: '°F', factor: 5 / 9 },
    ],
  },
  {
    code: 'thermal_conductivity',
    source: 'platform',
    label: platformFamilyLabel('thermal_conductivity'),
    standardUnitCode: 'W_mK',
    comparable: true,
    units: [{ code: 'W_mK', symbol: 'W/(m·K)', factor: 1, unece: 'D53' }],
  },
  {
    code: 'thermal_transmittance',
    source: 'platform',
    label: platformFamilyLabel('thermal_transmittance'),
    standardUnitCode: 'W_m2K',
    comparable: true,
    units: [{ code: 'W_m2K', symbol: 'W/(m²·K)', factor: 1 }],
  },
];
