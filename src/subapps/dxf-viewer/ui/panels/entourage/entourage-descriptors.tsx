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
import { Users, Car, Trees, Armchair } from 'lucide-react';
import type { EntouragePackDescriptor } from './entourage-pack-descriptor';
import { listPeoplePlanDefs } from '../../../data/people-plan-catalog';
import { listVehiclePlanDefs } from '../../../data/vehicles-plan-catalog';
import { listPlantsPlanDefs } from '../../../data/plants-plan-catalog';
import { listFurniturePlanDefs } from '../../../data/furniture-plan-catalog';
import {
  PEOPLE_PLAN_PACK_ID,
  VEHICLES_PLAN_PACK_ID,
  PLANTS_PLAN_PACK_ID,
  FURNITURE_PLAN_PACK_ID,
  resolvePeoplePlanUrl,
  resolveVehiclesPlanUrl,
  resolvePlantsPlanUrl,
  resolveFurniturePlanUrl,
} from '../../../data/entourage-plan-sources';
import {
  peoplePlanSelection,
  vehiclesPlanSelection,
  plantsPlanSelection,
  furniturePlanSelection,
} from '../../../bim/entourage/entourage-selection-stores';

/** Descriptor «Άνθρωποι Κάτοψης» (μόνο category, 0 facets). */
export const PEOPLE_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: PEOPLE_PLAN_PACK_ID,
  i18nPrefix: 'peoplePlan',
  facetKeys: [],
  icon: <Users />,
  list: listPeoplePlanDefs,
  resolveUrl: resolvePeoplePlanUrl,
  selection: peoplePlanSelection,
};

/** Descriptor «Οχήματα Κάτοψης» (category + facet `color`). */
export const VEHICLES_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: VEHICLES_PLAN_PACK_ID,
  i18nPrefix: 'vehiclePlan',
  facetKeys: ['color'],
  icon: <Car />,
  list: listVehiclePlanDefs,
  resolveUrl: resolveVehiclesPlanUrl,
  selection: vehiclesPlanSelection,
};

/** Descriptor «Φυτά Κάτοψης» (μόνο category, 0 facets). */
export const PLANTS_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: PLANTS_PLAN_PACK_ID,
  i18nPrefix: 'plantsPlan',
  facetKeys: [],
  icon: <Trees />,
  list: listPlantsPlanDefs,
  resolveUrl: resolvePlantsPlanUrl,
  selection: plantsPlanSelection,
};

/** Descriptor «Έπιπλα Κάτοψης» (category + facets `kind` → `style`· kind ΠΡΩΤΟ). */
export const FURNITURE_PALETTE_DESCRIPTOR: EntouragePackDescriptor = {
  packId: FURNITURE_PLAN_PACK_ID,
  i18nPrefix: 'furniturePlan',
  facetKeys: ['kind', 'style'],
  icon: <Armchair />,
  list: listFurniturePlanDefs,
  resolveUrl: resolveFurniturePlanUrl,
  selection: furniturePlanSelection,
};
