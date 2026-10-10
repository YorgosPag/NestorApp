/**
 * FloorFloorplanInline — Inline Floorplan per Floor (IFC-Compliant)
 *
 * Floor plans belong to IfcBuildingStorey (floor), NOT to IfcBuilding — same
 * pattern as Revit Level views, ArchiCAD Story plans, and Procore Drawing Areas.
 *
 * Thin binding over the generic {@link SpaceFloorplanInline} (it used to be a
 * line-for-line twin of it — CHECK 3.28).
 *
 * Κάτω από τις κατόψεις κάθεται η **δήλωση κάτοψης ορόφου** (ADR-907 §11.10): το τελευταίο βήμα της ίδιας δουλειάς —
 * ανέβασμα εικόνας, σήμανση «δημόσιο», περιγράμματα, υπογραφή. Μόνο ο όροφος την έχει, γι' αυτό ζει εδώ και όχι στο
 * γενικό `SpaceFloorplanInline`.
 *
 * @module components/building-management/tabs/FloorFloorplanInline
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-179 — Floorplan types (building / floor / unit)
 * @see ADR-907 §11.10 — Floor plate declaration in the workspace
 */

'use client';

import { useAuth } from '@/auth/contexts/AuthContext';
import { SpaceFloorplanInline } from '@/components/building-management/shared/SpaceFloorplanInline';
import { FloorPlateDeclaration } from '@/components/listings/FloorPlateDeclaration';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { tryResolveCompanyId } from '@/services/company-id-resolver';

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
  const { user } = useAuth();
  const building = { companyId: buildingCompanyId };
  // 🏢 Ο ΙΔΙΟΣ επιλυτής με τις κατόψεις από πάνω (ADR-200): η δήλωση διαβάζει τα αρχεία του **ίδιου** μισθωτή.
  const companyId = tryResolveCompanyId({ building, user })?.companyId;

  return (
    <>
      <SpaceFloorplanInline
        entityType="floor"
        entityId={floorId}
        entityLabel={floorName}
        projectId={projectId}
        building={building}
        purpose={FLOORPLAN_PURPOSES.FLOOR}
      />
      <FloorPlateDeclaration floorId={floorId} companyId={companyId} />
    </>
  );
}

export default FloorFloorplanInline;
