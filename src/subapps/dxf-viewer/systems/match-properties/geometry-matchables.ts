/**
 * ADR-581 — Geometry & material matchable descriptors (κανάλι `params`).
 *
 * Τα geometry descriptors παράγονται 1:1 από το ΥΠΑΡΧΟΝ SSoT
 * `COMMON_PROPERTIES_BY_KIND` (bim-common-properties.ts) — μηδέν επανα-δήλωση
 * μονάδων/ορίων/labelKey. Το material descriptor είναι ρητό (params.material).
 *
 * Δομικά (grades/rebar) descriptors ζουν χωριστά στο `param-matchables-by-type.ts`
 * (test-locked commandKey→paramKey SSoT — ADR-581 §Risk).
 */

import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type {
  MatchableValue,
  MatchablePropertyDescriptor,
} from './match-types';
import {
  COMMON_PROPERTIES_BY_KIND,
  type BimEditableProperty,
} from '../../bim/types/bim-common-properties';
import { GEOMETRY_KEY_ROLE, ROLE_MATERIAL_PRIMARY } from './semantic-roles';

/** Διαβάζει `entity.params[paramKey]` ως scalar. */
function readParam(entity: SceneEntity, paramKey: string): MatchableValue | undefined {
  const params = entity.params;
  if (!params || typeof params !== 'object') return undefined;
  const v = (params as Record<string, unknown>)[paramKey];
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'
    ? v
    : undefined;
}

/** Μετατρέπει ένα `BimEditableProperty` σε geometry matchable descriptor. */
function toGeometryDescriptor(prop: BimEditableProperty): MatchablePropertyDescriptor {
  const role = GEOMETRY_KEY_ROLE[prop.key];
  return {
    key: `params.${prop.key}`,
    role,
    category: 'geometry',
    unit: prop.unit,
    valueType: 'number',
    channel: 'params',
    readOnly: false,
    labelKey: prop.labelKey,
    min: prop.min,
    max: prop.max,
    read: (entity: SceneEntity) => readParam(entity, prop.key),
    buildFragment: (value: MatchableValue) => ({
      channel: 'params',
      patch: { [prop.key]: value },
    }),
  };
}

/**
 * Material descriptor (params.material) — RC/steel/masonry/wood. Ενιαίο enum ώστε
 * να μεταφέρεται μεταξύ ΟΛΩΝ των δομικών μελών (κοινό SSoT option set).
 */
const MATERIAL_DESCRIPTOR: MatchablePropertyDescriptor = {
  key: 'params.material',
  role: ROLE_MATERIAL_PRIMARY,
  category: 'material',
  unit: 'none',
  valueType: 'enum',
  channel: 'params',
  readOnly: false,
  labelKey: 'ribbon.commands.columnEditor.material.section.title',
  enumValues: ['rc', 'steel', 'masonry', 'wood'],
  read: (entity: SceneEntity) => readParam(entity, 'material'),
  buildFragment: (value: MatchableValue) => ({
    channel: 'params',
    patch: { material: value },
  }),
};

/** BIM kinds που έχουν πεδίο `params.material`. */
const MATERIAL_KINDS: ReadonlySet<EntityType> = new Set<EntityType>([
  'wall', 'column', 'beam', 'slab', 'foundation',
]);

/**
 * Geometry (+material) descriptors για έναν τύπο, από τα υπάρχοντα SSoT.
 * Επιστρέφει `[]` για non-BIM/raw-DXF τύπους (δεν έχουν params geometry).
 */
export function getGeometryMatchables(type: EntityType): readonly MatchablePropertyDescriptor[] {
  const props = COMMON_PROPERTIES_BY_KIND[type];
  const geometry = props ? props.map(toGeometryDescriptor) : [];
  return MATERIAL_KINDS.has(type) ? [...geometry, MATERIAL_DESCRIPTOR] : geometry;
}
