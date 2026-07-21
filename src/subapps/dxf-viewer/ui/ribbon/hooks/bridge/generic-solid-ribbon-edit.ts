/**
 * ADR-684 Φ4-B — pure interpretation of the generic-solid contextual ribbon commands.
 *
 * ΕΝΑ SSoT για «τι σημαίνει αυτό το commandKey» + «ποιες `GenericSolidParams` προκύπτουν από αυτή
 * την τιμή», κοινό και για τα **δύο** modes του `useRibbonGenericSolidBridge`:
 *   - **selected-entity** (Φ4-B): γράφει μέσω `UpdateGenericSolidParamsCommand` → χρειάζεται πλήρεις
 *     `nextParams`.
 *   - **tool-defaults** (Φ3): γράφει στο `genericSolidToolBridgeStore` (setShape/setParamOverrides).
 *
 * Καθαρές συναρτήσεις: μηδέν React / store / command. Το κλείσιμο του key → field είναι εδώ (μία
 * φορά), ώστε τα δύο modes να μην αντιγράφουν το switch (N.18).
 *
 * @see ./generic-solid-command-keys — τα commandKey strings
 * @see ../useRibbonGenericSolidBridge — ο dual-mode consumer
 */

import {
  GENERIC_SOLID_RIBBON_KEYS,
  GENERIC_SOLID_DIM_KEY_TO_FIELD,
} from './generic-solid-command-keys';
import {
  defaultGenericSolidShapeOfKind,
  updateGenericSolidShapeDimension,
} from '../../../../bim/entities/generic-solid/generic-solid-shape-defaults';
import type {
  GenericSolidParams,
  GenericSolidShape,
  GenericSolidShapeKind,
  GenericSolidStructuralRole,
} from '../../../../bim/entities/generic-solid/generic-solid-types';

/** Σε τι στοχεύει ένα generic-solid commandKey. */
export type GenericSolidEditTarget =
  | { readonly t: 'shapeKind' }
  | { readonly t: 'structuralRole' }
  | { readonly t: 'rotation' }
  | { readonly t: 'mounting' }
  | { readonly t: 'dim'; readonly field: string };

/** Κατηγοριοποιεί ένα commandKey, ή `null` αν δεν ανήκει στο generic-solid surface. */
export function classifyGenericSolidKey(commandKey: string): GenericSolidEditTarget | null {
  if (commandKey === GENERIC_SOLID_RIBBON_KEYS.stringParams.shapeKind) return { t: 'shapeKind' };
  if (commandKey === GENERIC_SOLID_RIBBON_KEYS.stringParams.structuralRole) return { t: 'structuralRole' };
  if (commandKey === GENERIC_SOLID_RIBBON_KEYS.params.rotation) return { t: 'rotation' };
  if (commandKey === GENERIC_SOLID_RIBBON_KEYS.params.mountingElevation) return { t: 'mounting' };
  const field = GENERIC_SOLID_DIM_KEY_TO_FIELD[commandKey];
  return field === undefined ? null : { t: 'dim', field };
}

/** Numeric read μιας διάστασης του σχήματος (null όταν το πεδίο είναι ξένο στο τρέχον σχήμα). */
export function readShapeDimension(shape: GenericSolidShape, field: string): number | null {
  const raw = (shape as unknown as Record<string, unknown>)[field];
  return typeof raw === 'number' ? raw : null;
}

/**
 * Η τρέχουσα τιμή (ως string) που εμφανίζει το ribbon control για το `target`, διαβασμένη από ένα
 * τριάδα shape/rotation/mounting — κοινή και για τα δύο modes (η πηγή διαφέρει, η ανάγνωση όχι).
 * `null` όταν το πεδίο δεν αφορά το τρέχον σχήμα (το control κρύβεται).
 */
export function readGenericSolidValue(
  target: GenericSolidEditTarget,
  shape: GenericSolidShape,
  rotationDeg: number,
  mountingElevationMm: number,
  structuralRole: GenericSolidStructuralRole,
): string | null {
  switch (target.t) {
    case 'shapeKind':
      return shape.kind;
    case 'structuralRole':
      return structuralRole;
    case 'rotation':
      return String(rotationDeg);
    case 'mounting':
      return String(mountingElevationMm);
    case 'dim': {
      const raw = readShapeDimension(shape, target.field);
      return raw === null ? null : String(raw);
    }
  }
}

/**
 * Οι πλήρεις `GenericSolidParams` που προκύπτουν από την επεξεργασία `target = value` πάνω σε
 * υπάρχουσες params (selected-entity mode). Επιστρέφει τις **ίδιες** params (referentially) όταν η
 * τιμή είναι μη-έγκυρη ή no-op — ο caller κάνει short-circuit το command. Αλλαγή `shapeKind` φορτώνει
 * τις προεπιλεγμένες διαστάσεις του νέου σχήματος (family-type swap, όπως Revit).
 */
export function applyGenericSolidRibbonEdit(
  params: GenericSolidParams,
  target: GenericSolidEditTarget,
  value: string,
): GenericSolidParams {
  switch (target.t) {
    case 'shapeKind':
      return { ...params, shape: defaultGenericSolidShapeOfKind(value as GenericSolidShapeKind) };
    case 'structuralRole':
      return value === 'structural' || value === 'decorative'
        ? { ...params, structuralRole: value }
        : params;
    case 'rotation': {
      const n = Number(value);
      return Number.isFinite(n) ? { ...params, rotationDeg: n } : params;
    }
    case 'mounting': {
      const n = Number(value);
      return Number.isFinite(n) ? { ...params, mountingElevationMm: n } : params;
    }
    case 'dim': {
      const n = Number(value);
      if (!Number.isFinite(n)) return params;
      const shape = updateGenericSolidShapeDimension(params.shape, target.field, n);
      return shape === params.shape ? params : { ...params, shape };
    }
  }
}
