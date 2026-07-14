'use client';

/**
 * ADR-654 M6 — Οι δύο concrete descriptors (People, Vehicles) που τροφοδοτούν την generic παλέτα.
 *
 * Ένα αρχείο, δύο instances ⇒ μηδέν clone (N.18). Κάθε descriptor δένει τον per-family catalog +
 * source + selection store + i18n prefix + icon.
 *
 * @see ./entourage-pack-descriptor.ts — ο τύπος
 * @see ./EntouragePalette.tsx — ο generic καταναλωτής
 */

import React from 'react';
import { Users, Car } from 'lucide-react';
import type { EntouragePackDescriptor } from './entourage-pack-descriptor';
import { listPeoplePlanDefs } from '../../../data/people-plan-catalog';
import { listVehiclePlanDefs } from '../../../data/vehicles-plan-catalog';
import {
  PEOPLE_PLAN_PACK_ID,
  VEHICLES_PLAN_PACK_ID,
  resolvePeoplePlanUrl,
  resolveVehiclesPlanUrl,
} from '../../../data/entourage-plan-sources';
import {
  peoplePlanSelection,
  vehiclesPlanSelection,
} from '../../../bim/entourage/entourage-selection-stores';

/** Descriptor «Άνθρωποι Κάτοψης» (1 facet: category). */
export const PEOPLE_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: PEOPLE_PLAN_PACK_ID,
  i18nPrefix: 'peoplePlan',
  icon: <Users />,
  list: listPeoplePlanDefs,
  resolveUrl: resolvePeoplePlanUrl,
  selection: peoplePlanSelection,
};

/** Descriptor «Οχήματα Κάτοψης» (2 facets: category + χρώμα). */
export const VEHICLES_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: VEHICLES_PLAN_PACK_ID,
  i18nPrefix: 'vehiclePlan',
  icon: <Car />,
  list: listVehiclePlanDefs,
  resolveUrl: resolveVehiclesPlanUrl,
  selection: vehiclesPlanSelection,
};
