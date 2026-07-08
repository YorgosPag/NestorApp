/**
 * ADR-513 — «Δαχτυλίδι Εντολών» διάταξη του ΤΟΙΧΟΥ: Μήκος / Γωνία / Πάχος / Ύψος.
 *
 * Μήκος & Γωνία = κοινοί builders (`ring-config.ts`, lock στο `DynamicInputLockStore`).
 * Πάχος & Ύψος = wall-specific numeric overrides μέσω του κοινού `createOverrideRingFields`
 * (bridge `setParamOverrides` — η ΙΔΙΑ λογική με τη δοκό, μηδέν αλλαγή συμπεριφοράς).
 */

import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { resolveWallThicknessMm } from '../../hooks/drawing/wall-completion';
import { resolveStoreyHeightMm } from '../levels/storey-creation-defaults';
import { DEFAULT_WALL_HEIGHT_MM } from '../../bim/types/wall-types';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import {
  type RingConfig,
  angleRingField,
  combineSubscribers,
  createOverrideRingFields,
  lengthRingField,
} from './ring-config';

const { numericOverrideField } = createOverrideRingFields(wallToolBridgeStore, wallPreviewStore);

/**
 * Διάταξη δαχτυλιδιού τοίχου (4 πεδία → 4 ίσες φέτες = cardinal). Σειρά = φέτα (`computeRingSlices`):
 * Μήκος πάνω, Γωνία δεξιά, Ύψος κάτω, Πάχος αριστερά (ίδια όψη με πριν τη δυναμικοποίηση).
 */
export const WALL_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.wall.ringLabel',
  fields: [
    lengthRingField('tools.wall.ringLength'),
    angleRingField('tools.wall.ringAngle'),
    numericOverrideField({
      key: 'height',
      labelKey: 'tools.wall.ringHeight',
      resolveSeedMm: (o) => resolveStoreyHeightMm(o.height, DEFAULT_WALL_HEIGHT_MM),
    }),
    numericOverrideField({
      key: 'thickness',
      labelKey: 'tools.wall.ringThickness',
      resolveSeedMm: (o) => resolveWallThicknessMm(o),
    }),
  ],
  subscribe: combineSubscribers(
    DynamicInputLockStore.subscribe,
    wallPreviewStore.subscribe,
    wallToolBridgeStore.subscribe,
  ),
};
