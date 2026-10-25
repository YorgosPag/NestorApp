/**
 * Οικογένειες μέτρησης της πλατφόρμας — **ρευστά, ηλεκτρικά, ακουστικά, φωτομετρικά**
 * μεγέθη (ADR-923 §5.2). Δεδομένα, χωρίς λογική.
 *
 * Παροχή όγκου: πρότυπο το SI (m³/s), ενώ οι κατάλογοι HVAC γράφουν m³/h (αέρας) και
 * l/s ή l/h (νερό) — η αποθήκευση στο πρότυπο κάνει τα «680 m³/h» και «189 l/s» συγκρίσιμα.
 * Πίεση: 1 mH₂O = 9806,65 Pa (συμβατική πυκνότητα νερού × κανονική επιτάχυνση βαρύτητας) ·
 * 1 psi = 6894,757293168 Pa.
 *
 * Στάθμη ήχου: **λογαριθμική** (dB) ⇒ μία μονάδα, `singleUnit` — οι στάθμες δεν μετατρέπονται
 * αφινικά. Ηχητική πίεση και ηχητική ισχύς είναι **διαφορετικά** μεγέθη με την ίδια μονάδα·
 * μένουν χωριστές οικογένειες ώστε κανόνας σύγκρισης να μην τις ανακατέψει.
 * @module subapps/catalog/measurement/platform-families/fluid-electrical-acoustic
 */

import type { PlatformMeasurementFamily } from '../../types/measurement-family';
import { platformFamilyLabel } from './platform-family-label';

export const FLUID_ELECTRICAL_ACOUSTIC_FAMILIES: readonly PlatformMeasurementFamily[] = [
  {
    code: 'volume_flow',
    source: 'platform',
    label: platformFamilyLabel('volume_flow'),
    standardUnitCode: 'm3_s',
    comparable: true,
    units: [
      { code: 'm3_s', symbol: 'm³/s', factor: 1 },
      { code: 'm3_h', symbol: 'm³/h', factor: 1 / 3600, unece: 'MQH' },
      { code: 'l_s', symbol: 'l/s', factor: 0.001 },
      { code: 'l_min', symbol: 'l/min', factor: 0.001 / 60 },
      { code: 'l_h', symbol: 'l/h', factor: 0.001 / 3600 },
      { code: 'cfm', symbol: 'CFM', factor: 0.00047194745 },
    ],
  },
  {
    code: 'pressure',
    source: 'platform',
    label: platformFamilyLabel('pressure'),
    standardUnitCode: 'Pa',
    comparable: true,
    quantitySpec: 'pressure',
    units: [
      { code: 'Pa', symbol: 'Pa', factor: 1, unece: 'PAL' },
      { code: 'kPa', symbol: 'kPa', factor: 1000, unece: 'KPA' },
      { code: 'MPa', symbol: 'MPa', factor: 1_000_000 },
      { code: 'mbar', symbol: 'mbar', factor: 100 },
      { code: 'bar', symbol: 'bar', factor: 100_000, unece: 'BAR' },
      { code: 'psi', symbol: 'psi', factor: 6894.757293168 },
      { code: 'mH2O', symbol: 'mH₂O', factor: 9806.65 },
      { code: 'mmH2O', symbol: 'mmH₂O', factor: 9.80665 },
    ],
  },
  {
    code: 'voltage',
    source: 'platform',
    label: platformFamilyLabel('voltage'),
    standardUnitCode: 'V',
    comparable: true,
    units: [
      { code: 'mV', symbol: 'mV', factor: 0.001 },
      { code: 'V', symbol: 'V', factor: 1, unece: 'VLT' },
      { code: 'kV', symbol: 'kV', factor: 1000 },
    ],
  },
  {
    code: 'current',
    source: 'platform',
    label: platformFamilyLabel('current'),
    standardUnitCode: 'A',
    comparable: true,
    units: [
      { code: 'mA', symbol: 'mA', factor: 0.001 },
      { code: 'A', symbol: 'A', factor: 1, unece: 'AMP' },
    ],
  },
  {
    code: 'frequency',
    source: 'platform',
    label: platformFamilyLabel('frequency'),
    standardUnitCode: 'Hz',
    comparable: true,
    units: [
      { code: 'Hz', symbol: 'Hz', factor: 1, unece: 'HTZ' },
      { code: 'kHz', symbol: 'kHz', factor: 1000, unece: 'KHZ' },
    ],
  },
  {
    code: 'sound_pressure_level',
    source: 'platform',
    label: platformFamilyLabel('sound_pressure_level'),
    standardUnitCode: 'dBA',
    comparable: true,
    singleUnit: true,
    units: [{ code: 'dBA', symbol: 'dB(A)', factor: 1 }],
  },
  {
    code: 'sound_power_level',
    source: 'platform',
    label: platformFamilyLabel('sound_power_level'),
    standardUnitCode: 'dBA',
    comparable: true,
    singleUnit: true,
    units: [{ code: 'dBA', symbol: 'dB(A)', factor: 1 }],
  },
  {
    code: 'luminous_flux',
    source: 'platform',
    label: platformFamilyLabel('luminous_flux'),
    standardUnitCode: 'lm',
    comparable: true,
    units: [{ code: 'lm', symbol: 'lm', factor: 1, unece: 'LUM' }],
  },
];
