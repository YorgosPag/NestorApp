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
// ADR-746 — ο ΕΝΑΣ αναγνώστης των defPoints (ποτέ δεν πετάει).
import { dimDefPoints } from '../../../systems/dimensions/dimension-def-points';

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

  /**
   * ADR-746 (Boy Scout, N.0.2) — το κοινό preamble των `execute`/`undo`: ανάκτηση της διάστασης
   * από τη σκηνή + έλεγχος τύπου + ανάκτηση της συσχέτισης. Ήταν byte-ταυτόσημο δίδυμο 7 γραμμών
   * (εντοπίστηκε από CHECK 3.28/jscpd). Ένα `null` σημαίνει «δεν υπάρχει τίποτα να κάνω».
   */
  private resolveTarget(): { dim: DimensionEntity; assoc: DimensionAssociation } | null {
    const dim = this.sceneManager.getEntity(this.dimId) as DimensionEntity | undefined;
    if (!dim || dim.type !== 'dimension') return null;
    const assoc = dim.associations?.[this.associationIndex];
    return assoc ? { dim, assoc } : null;
  }

  execute(): void {
    const target = this.resolveTarget();
    if (!target) return;
    const { dim, assoc } = target;

    this.previousGeometryId = assoc.geometryId;
    this.previousDefPoint = dimDefPoints(dim)[assoc.defPointIndex] ?? null; // ADR-746

    const geoEntity = this.sceneManager.getEntity(this.newGeometryId);
    const updatedAssoc: DimensionAssociation = { ...assoc, geometryId: this.newGeometryId };
    const newPt = geoEntity
      ? recomputeAssociatedDefPoint(updatedAssoc, geoEntity, {
          // ADR-362 Phase J3 — supply the 2nd-host lookup + position hint so
          // intersection / nearest anchors re-solve on reassociate too.
          resolveEntity: (id) => this.sceneManager.getEntity(id),
          currentDefPoint: this.previousDefPoint,
        })
      : null;

    const newDefPoints = [...dimDefPoints(dim)] as Point2D[]; // ADR-746
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

    const target = this.resolveTarget();
    if (!target) return;
    const { dim, assoc } = target;

    const restoredAssoc: DimensionAssociation = {
      ...assoc,
      geometryId: this.previousGeometryId,
    };

    const newAssociations = [...(dim.associations ?? [])] as DimensionAssociation[];
    newAssociations[this.associationIndex] = restoredAssoc;

    const newDefPoints = [...dimDefPoints(dim)] as Point2D[]; // ADR-746
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
      name: this.name,
      type: this.type,
      timestamp: this.timestamp,
      version: 1,
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
