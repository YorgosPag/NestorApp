/**
 * Placeable BIM entity-type barrel — SSoT re-export of the entity types that both
 * the 3D entities store and the DXF-canvas type module consume in the same order.
 *
 * ADR-584 / N.18: extracted so each consumer pulls the shared set through ONE
 * `import type` line instead of repeating the identical 6-import block — which
 * token-clone-tripped CHECK 3.28 once `GenericSolidEntity` was added to both.
 */
export type { MepFixtureEntity } from './mep-fixture-types';
export type { ElectricalPanelEntity } from './electrical-panel-types';
export type { RailingEntity } from './railing-types';
export type { FurnitureEntity } from './furniture-types';
export type { ImportedMeshEntity } from '../entities/imported-mesh/imported-mesh-types';
export type { GenericSolidEntity } from '../entities/generic-solid/generic-solid-types';
