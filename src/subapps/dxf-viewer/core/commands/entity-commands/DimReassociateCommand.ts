/**
 * ADR-362 Phase J2 — DimReassociateCommand.
 *
 * Manually re-links a specific dimension association to a new geometry entity.
 * AutoCAD equivalent: DIMREASSOCIATE command.
 *
 * Use case: after geometry is deleted then recreated (e.g., re-draw a wall),
 * the dim's association.geometryId is stale. This command updates it to the
 * new entity ID and recomputes the corresponding defPoint.
 *
 * Supports full undo: stores the previous geometryId + defPoint position so
 * undo restores both.
 *
 * @see systems/dimensions/dim-association-service.ts — recomputeAssociatedDefPoint
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { DimensionEntity, DimensionAssociation } from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { recomputeAssociatedDefPoint } from '../../../systems/dimensions/dim-association-service';

export class DimReassociateCommand implements ICommand {
  readonly id: string;
  readonly name = 'DimReassociate';
  readonly type = 'dim-reassociate';
  readonly timestamp: number;

  private previousGeometryId: string | null = null;
  private previousDefPoint: Point2D | null = null;

  constructor(
    private readonly dimId: string,
    private readonly associationIndex: number,
    private readonly newGeometryId: string,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const dim = this.sceneManager.getEntity(this.dimId) as DimensionEntity | undefined;
    if (!dim || dim.type !== 'dimension') return;

    const assoc = dim.associations?.[this.associationIndex];
    if (!assoc) return;

    this.previousGeometryId = assoc.geometryId;
    this.previousDefPoint = dim.defPoints[assoc.defPointIndex] ?? null;

    const geoEntity = this.sceneManager.getEntity(this.newGeometryId);
    const updatedAssoc: DimensionAssociation = { ...assoc, geometryId: this.newGeometryId };
    const newPt = geoEntity ? recomputeAssociatedDefPoint(updatedAssoc, geoEntity) : null;

    const newDefPoints = [...dim.defPoints] as Point2D[];
    if (newPt) newDefPoints[assoc.defPointIndex] = newPt;

    const newAssociations = [...(dim.associations ?? [])] as DimensionAssociation[];
    newAssociations[this.associationIndex] = updatedAssoc;

    this.sceneManager.updateEntity(this.dimId, {
      associations: newAssociations as readonly DimensionAssociation[],
      defPoints: newDefPoints as readonly Point2D[],
    } as Partial<SceneEntity>);
  }

  undo(): void {
    if (this.previousGeometryId === null) return;

    const dim = this.sceneManager.getEntity(this.dimId) as DimensionEntity | undefined;
    if (!dim || dim.type !== 'dimension') return;

    const assoc = dim.associations?.[this.associationIndex];
    if (!assoc) return;

    const restoredAssoc: DimensionAssociation = {
      ...assoc,
      geometryId: this.previousGeometryId,
    };

    const newAssociations = [...(dim.associations ?? [])] as DimensionAssociation[];
    newAssociations[this.associationIndex] = restoredAssoc;

    const newDefPoints = [...dim.defPoints] as Point2D[];
    if (this.previousDefPoint) {
      newDefPoints[assoc.defPointIndex] = this.previousDefPoint;
    }

    this.sceneManager.updateEntity(this.dimId, {
      associations: newAssociations as readonly DimensionAssociation[],
      defPoints: newDefPoints as readonly Point2D[],
    } as Partial<SceneEntity>);
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Reassociate dimension to geometry ${this.newGeometryId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.dimId];
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      data: {
        dimId: this.dimId,
        associationIndex: this.associationIndex,
        newGeometryId: this.newGeometryId,
        previousGeometryId: this.previousGeometryId,
        previousDefPoint: this.previousDefPoint,
      },
    };
  }
}
