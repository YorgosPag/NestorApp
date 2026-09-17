/**
 * FloorFloorplanInline — Inline Floorplan per Floor (IFC-Compliant)
 *
 * Floor plans belong to IfcBuildingStorey (floor), NOT to IfcBuilding — same
 * pattern as Revit Level views, ArchiCAD Story plans, and Procore Drawing Areas.
 *
 * Thin binding over the generic {@link SpaceFloorplanInline} (it used to be a
 * line-for-line twin of it — CHECK 3.28).
 *
 * @module components/building-management/tabs/FloorFloorplanInline
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-179 — Floorplan types (building / floor / unit)
 */

'use client';

import { SpaceFloorplanInline } from '@/components/building-management/shared/SpaceFloorplanInline';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';

interface FloorFloorplanInlineProps {
  /** Floor document ID from Firestore */
  floorId: string;
  /** Floor display name (for entityLabel) */
  floorName: string;
  /** Parent building's projectId (for storage path) */
  projectId?: string;
  /** Parent building's companyId — ensures super_admin stores files under the correct tenant */
  buildingCompanyId?: string;
}

export function FloorFloorplanInline({
  floorId,
  floorName,
  projectId,
  buildingCompanyId,
}: FloorFloorplanInlineProps) {
  return (
    <SpaceFloorplanInline
      entityType="floor"
      entityId={floorId}
      entityLabel={floorName}
      projectId={projectId}
      building={{ companyId: buildingCompanyId }}
      purpose={FLOORPLAN_PURPOSES.FLOOR}
    />
  );
}

export default FloorFloorplanInline;
