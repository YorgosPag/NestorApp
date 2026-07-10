/**
 * ADR-513 §rectangle — «Δαχτυλίδι Εντολών» διάταξη του ΟΡΘΟΓΩΝΙΟΥ: Πλάτος / Ύψος / Γωνία.
 *
 * Parity με γραμμή/τοίχο/δοκό: in-canvas radial ring, κλικ wedge → popup → commit, heads-up
 * direct typing. Διαφορά: 3 numeric πεδία που κλειδώνουν στο `RectLockStore` (ΟΧΙ polar
 * length+angle) — Απόφαση A (locked νικά), Απόφαση B (πλήρης γωνία).
 *
 * **FULL SSoT — μηδέν νέος builder:** Πλάτος/Ύψος → `sceneLengthRingField`, Γωνία →
 * `degreeRingField` (ΟΙ ΙΔΙΟΙ generic builders με μήκος/γωνία της γραμμής), με injected
 * `RingLockTarget` πάνω στο `RectLockStore`. Το geometry ζει στο `rect-lock.ts` (applyRectLock).
 */

import { lengthDisplayToSceneLock } from './radial-ring-logic';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { RectLockStore } from './RectLockStore';
import {
  type RingConfig,
  type RingFieldDef,
  degreeRingField,
  sceneLengthRingField,
} from './ring-config';

/** Πλάτος/Ύψος: length-like πεδίο πάνω στο RectLockStore· clearOnPlace = unlockAll (ένα rect τη φορά). */
function sideField(
  key: 'width' | 'height',
  labelKey: string,
  read: () => number | null,
  lock: (valueScene: number) => void,
): RingFieldDef {
  return sceneLengthRingField(key, labelKey, {
    isLocked: () => read() !== null,
    read,
    lock: (value, ctx) => lock(lengthDisplayToSceneLock(value, ctx.displayUnit, ctx.sceneUnits)),
    clearOnPlace: () => RectLockStore.unlockAll(),
  });
}

function angleField(labelKey: string): RingFieldDef {
  return degreeRingField('angle', labelKey, {
    isLocked: () => RectLockStore.getLocked().angle !== null,
    read: () => RectLockStore.getLocked().angle,
    lock: (value) => RectLockStore.lockAngle(normalizeAngleDeg(value)),
    clearOnPlace: () => RectLockStore.unlockAll(),
  });
}

/** Διάταξη δαχτυλιδιού ορθογωνίου (3 πεδία → 3 ίσες φέτες 120°): Πλάτος πάνω, Ύψος & Γωνία. */
export const RECTANGLE_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.ring.rectLabel',
  headsUpFieldKey: 'width',
  fields: [
    sideField('width', 'tools.ring.rectWidth', () => RectLockStore.getLocked().width, (v) => RectLockStore.lockWidth(v)),
    sideField('height', 'tools.ring.rectHeight', () => RectLockStore.getLocked().height, (v) => RectLockStore.lockHeight(v)),
    angleField('tools.ring.rectAngle'),
  ],
  subscribe: RectLockStore.subscribe,
};
