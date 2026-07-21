/**
 * ADR-684 Φ3 — Generic-solid contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-generic-solid-tab.ts`) and the bridge mappings
 * (`useRibbonGenericSolidBridge`). Mirrors `FURNITURE_RIBBON_KEYS`, with two
 * generic-solid extras: a per-shape-kind panel-visibility key set (the shape
 * selector drives which dimension panel shows) and per-dimension numeric keys
 * derived from `GENERIC_SOLID_DIMENSION_FIELDS` (one key per distinct field — a
 * field shared across shapes, e.g. `radiusMm`, shares one key since only one
 * shape's panel is visible at a time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { makeKeySetGuard } from './make-key-set-guard';
import {
  GENERIC_SOLID_DIMENSION_FIELDS,
} from '../../../../bim/entities/generic-solid/generic-solid-shape-defaults';
import {
  GENERIC_SOLID_SHAPE_KINDS,
  type GenericSolidShapeKind,
} from '../../../../bim/entities/generic-solid/generic-solid-types';

const dimKey = (field: string): string => `generic-solid.params.dim.${field}`;
const panelKey = (kind: GenericSolidShapeKind): string => `generic-solid.panel.${kind}`;

/** commandKey → shape field, for every distinct numeric dimension. */
export const GENERIC_SOLID_DIM_KEY_TO_FIELD: Readonly<Record<string, string>> = Object.fromEntries(
  GENERIC_SOLID_DIMENSION_FIELDS.map((field) => [dimKey(field), field]),
);

/** shape kind → its panel-visibility key. */
export const GENERIC_SOLID_PANEL_KEY_BY_KIND: { readonly [K in GenericSolidShapeKind]: string } =
  Object.fromEntries(
    GENERIC_SOLID_SHAPE_KINDS.map((kind) => [kind, panelKey(kind)]),
  ) as { readonly [K in GenericSolidShapeKind]: string };

/** panel-visibility key → shape kind (reverse of the above, for the bridge). */
export const GENERIC_SOLID_PANEL_KEY_TO_KIND: Readonly<Record<string, GenericSolidShapeKind>> =
  Object.fromEntries(
    GENERIC_SOLID_SHAPE_KINDS.map((kind) => [panelKey(kind), kind]),
  );

export const GENERIC_SOLID_RIBBON_KEYS = {
  stringParams: {
    /** Shape selector (which primitive to place: box / sphere / …). */
    shapeKind: 'generic-solid.params.shapeKind',
    /** ADR-684 Φ4-C — δομικό vs διακοσμητικό (ταξινόμηση/BOQ, §4.3). */
    structuralRole: 'generic-solid.params.structuralRole',
  },
  params: {
    /** deg — plan rotation about the insertion point. */
    rotation: 'generic-solid.params.rotation',
    /** mm — mounting elevation above FFL (0 = on the floor). */
    mountingElevation: 'generic-solid.params.mountingElevation',
  },
  /** One numeric key per distinct dimension field. */
  dim: (field: string): string => dimKey(field),
} as const;

// ─── Key sets + guards ─────────────────────────────────────────────────────────

const DIM_KEYS: readonly string[] = Object.keys(GENERIC_SOLID_DIM_KEY_TO_FIELD);

export const GENERIC_SOLID_RIBBON_NUMBER_KEYS: readonly string[] = [
  GENERIC_SOLID_RIBBON_KEYS.params.rotation,
  GENERIC_SOLID_RIBBON_KEYS.params.mountingElevation,
  ...DIM_KEYS,
];

export const GENERIC_SOLID_RIBBON_STRING_KEYS: readonly string[] = [
  GENERIC_SOLID_RIBBON_KEYS.stringParams.shapeKind,
  GENERIC_SOLID_RIBBON_KEYS.stringParams.structuralRole,
];

const GENERIC_SOLID_PANEL_VISIBILITY_KEYS: readonly string[] = Object.keys(
  GENERIC_SOLID_PANEL_KEY_TO_KIND,
);

export const GENERIC_SOLID_RIBBON_KEYS_ACTIONS = {
  close: 'generic-solid.actions.close',
} as const;

export const isGenericSolidActionKey = makeKeySetGuard(
  Object.values(GENERIC_SOLID_RIBBON_KEYS_ACTIONS),
);

export const isGenericSolidRibbonKey = makeKeySetGuard(GENERIC_SOLID_RIBBON_NUMBER_KEYS);

export const isGenericSolidRibbonStringKey = makeKeySetGuard(GENERIC_SOLID_RIBBON_STRING_KEYS);

export const isGenericSolidPanelVisibilityKey = makeKeySetGuard(GENERIC_SOLID_PANEL_VISIBILITY_KEYS);
