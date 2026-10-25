/**
 * Οικογένειες μέτρησης της πλατφόρμας — **γεωμετρικά και μηχανικά** μεγέθη (ADR-923 §5.2).
 * Δεδομένα, χωρίς λογική. Οι συντελεστές είναι **ακριβείς ορισμοί** (π.χ. 1 in = 0,0254 m
 * ακριβώς, 1 lb = 0,45359237 kg ακριβώς — Διεθνής Συμφωνία Υάρδας και Λίβρας 1959).
 * @module subapps/catalog/measurement/platform-families/geometric-mechanical
 */

import type { PlatformMeasurementFamily } from '../../types/measurement-family';
import { platformFamilyLabel } from './platform-family-label';

export const GEOMETRIC_MECHANICAL_FAMILIES: readonly PlatformMeasurementFamily[] = [
  {
    code: 'length',
    source: 'platform',
    label: platformFamilyLabel('length'),
    standardUnitCode: 'm',
    comparable: true,
    // ΧΩΡΙΣ quantitySpec: το `model-length` (ADR-852) σημαίνει «μήκος στο μοντέλο σχεδίου»,
    // όχι διάσταση προϊόντος — η σύνδεση θα ήταν ψευδής ταύτιση δύο εννοιών.
    units: [
      { code: 'mm', symbol: 'mm', factor: 0.001, unece: 'MMT' },
      { code: 'cm', symbol: 'cm', factor: 0.01, unece: 'CMT' },
      { code: 'm', symbol: 'm', factor: 1, unece: 'MTR' },
      { code: 'km', symbol: 'km', factor: 1000, unece: 'KMT' },
      { code: 'in', symbol: 'in', factor: 0.0254, unece: 'INH' },
      { code: 'ft', symbol: 'ft', factor: 0.3048, unece: 'FOT' },
    ],
  },
  {
    code: 'area',
    source: 'platform',
    label: platformFamilyLabel('area'),
    standardUnitCode: 'm2',
    comparable: true,
    units: [
      { code: 'mm2', symbol: 'mm²', factor: 0.000001, unece: 'MMK' },
      { code: 'cm2', symbol: 'cm²', factor: 0.0001, unece: 'CMK' },
      { code: 'm2', symbol: 'm²', factor: 1, unece: 'MTK' },
      { code: 'ft2', symbol: 'ft²', factor: 0.09290304, unece: 'FTK' },
    ],
  },
  {
    code: 'volume',
    source: 'platform',
    label: platformFamilyLabel('volume'),
    standardUnitCode: 'm3',
    comparable: true,
    quantitySpec: 'volume',
    units: [
      { code: 'ml', symbol: 'ml', factor: 0.000001, unece: 'MLT' },
      { code: 'l', symbol: 'L', factor: 0.001, unece: 'LTR' },
      { code: 'm3', symbol: 'm³', factor: 1, unece: 'MTQ' },
      { code: 'gal_us', symbol: 'gal (US)', factor: 0.003785411784 },
    ],
  },
  {
    code: 'mass',
    source: 'platform',
    label: platformFamilyLabel('mass'),
    standardUnitCode: 'kg',
    comparable: true,
    quantitySpec: 'mass',
    units: [
      { code: 'g', symbol: 'g', factor: 0.001, unece: 'GRM' },
      { code: 'kg', symbol: 'kg', factor: 1, unece: 'KGM' },
      { code: 't', symbol: 't', factor: 1000, unece: 'TNE' },
      { code: 'lb', symbol: 'lb', factor: 0.45359237, unece: 'LBR' },
    ],
  },
  {
    code: 'speed',
    source: 'platform',
    label: platformFamilyLabel('speed'),
    standardUnitCode: 'm_s',
    comparable: true,
    units: [
      { code: 'm_s', symbol: 'm/s', factor: 1, unece: 'MTS' },
      { code: 'km_h', symbol: 'km/h', factor: 1 / 3.6, unece: 'KMH' },
      { code: 'ft_min', symbol: 'ft/min', factor: 0.00508 },
    ],
  },
  {
    code: 'rotational_speed',
    source: 'platform',
    label: platformFamilyLabel('rotational_speed'),
    standardUnitCode: 'rps',
    comparable: true,
    units: [
      { code: 'rps', symbol: '1/s', factor: 1 },
      { code: 'rpm', symbol: 'rpm', factor: 1 / 60 },
    ],
  },
];
