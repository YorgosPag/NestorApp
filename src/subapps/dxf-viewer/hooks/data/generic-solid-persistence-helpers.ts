/**
 * Generic solid persistence — καθαρός μετατροπέας doc→entity (ADR-684 Φ2).
 *
 * Καθρέφτης του `imported-mesh-persistence-helpers.ts`, **χωρίς** την παρενέργεια δήλωσης asset:
 * το παραμετρικό στερεό χτίζεται procedural από τις παραμέτρους, δεν φορτώνει εξωτερικό `.glb`.
 * Άρα εδώ ο μετατροπέας είναι αμιγώς καθαρός (object literal + επαναπαραγωγή γεωμετρίας).
 *
 * @module hooks/data/generic-solid-persistence-helpers
 * @see ./imported-mesh-persistence-helpers — ο αδελφός (με asset registration)
 */

import type { GenericSolidEntity } from '../../bim/entities/generic-solid/generic-solid-types';
import {
  computeGenericSolidGeometry,
  validateGenericSolidParams,
} from '../../bim/entities/generic-solid/generic-solid-geometry';
import type { GenericSolidDoc } from '../../bim/entities/generic-solid/generic-solid-firestore-service';

/** Χτίζει `GenericSolidEntity` από persisted `GenericSolidDoc`. Καθαρός· καμία παρενέργεια. */
export function genericSolidDocToEntity(doc: GenericSolidDoc): GenericSolidEntity {
  const validation = doc.validation ?? validateGenericSolidParams(doc.params).bimValidation;

  return {
    id: doc.id,
    type: 'generic-solid',
    kind: 'generic',
    name: doc.name ?? '',
    layerId: doc.layerId ?? '0',
    floorId: doc.floorId,
    params: doc.params,
    geometry: doc.geometry ?? computeGenericSolidGeometry(doc.params),
    validation,
    visible: true,
    ifcType: 'IfcBuildingElementProxy',
  } as GenericSolidEntity;
}
