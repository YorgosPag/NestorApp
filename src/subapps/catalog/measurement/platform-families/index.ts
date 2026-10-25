/**
 * Η **βιβλιοθήκη οικογενειών μέτρησης της πλατφόρμας** — μία λίστα, ενωμένη από τα αρχεία
 * δεδομένων ανά πεδίο. Η ορθότητά της (μοναδικοί κωδικοί, πρότυπο με factor 1, πεπερασμένοι
 * συντελεστές, μετατροπή πήγαινε-έλα) **εκτελείται** στο `__tests__/platform-families.test.ts`.
 * @module subapps/catalog/measurement/platform-families
 */

import type { PlatformMeasurementFamily } from '../../types/measurement-family';
import { FLUID_ELECTRICAL_ACOUSTIC_FAMILIES } from './fluid-electrical-acoustic';
import { GEOMETRIC_MECHANICAL_FAMILIES } from './geometric-mechanical';
import { THERMAL_ENERGY_FAMILIES } from './thermal-energy';

export const PLATFORM_MEASUREMENT_FAMILIES: readonly PlatformMeasurementFamily[] = [
  ...GEOMETRIC_MECHANICAL_FAMILIES,
  ...THERMAL_ENERGY_FAMILIES,
  ...FLUID_ELECTRICAL_ACOUSTIC_FAMILIES,
];

/** Δεσμευμένοι κωδικοί — ο χώρος δεν μπορεί να ορίσει οικογένεια με ίδιο κωδικό. */
export const PLATFORM_MEASUREMENT_FAMILY_CODES: ReadonlySet<string> = new Set(
  PLATFORM_MEASUREMENT_FAMILIES.map((family) => family.code),
);
