/**
 * SpaceFloorplanInline — Generic Inline Floorplan for Building Spaces
 *
 * Wraps the centralized EntityFilesManager for floorplan management
 * in floors, storage units, parking spots, and units. Used inside expandable
 * rows of BuildingSpaceTable, BuildingSpaceCardGrid and the Floors tab
 * (via FloorFloorplanInline).
 *
 * @module components/building-management/shared/SpaceFloorplanInline
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-179 — Floorplan types (building / floor / unit)
 * @see ADR-187 — Floor-level floorplans with expandable rows
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useEntityFilesTabSession } from '@/components/shared/files/useEntityFilesTabSession';
import { useAuth } from '@/auth/contexts/AuthContext';
import { tryResolveCompanyId } from '@/services/company-id-resolver';
import type { EntityType } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

interface SpaceFloorplanInlineProps {
  /** Entity type: "floor" | "storage_unit" | "parking_spot" | "unit" */
  entityType: EntityType;
  /** Entity document ID from Firestore */
  entityId: string;
  /** Entity display name (for entityLabel) */
  entityLabel: string;
  /** Parent building's projectId (for storage path) */
  projectId?: string;
  /** Parent building data (for companyId resolution — ADR-200) */
  building?: { companyId?: string } | null;
  /** FileRecord purpose for filtering (e.g. FLOORPLAN_PURPOSES.FLOOR) */
  purpose?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Accepted file types for floorplans (DXF, PDF, images) */
const FLOORPLAN_ACCEPT =
  '.dxf,.pdf,application/pdf,application/dxf,image/vnd.dxf,.jpg,.jpeg,.png,image/jpeg,image/png';

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceFloorplanInline({
  entityType,
  entityId,
  entityLabel,
  projectId,
  building,
  purpose,
}: SpaceFloorplanInlineProps) {
  const { user } = useAuth();

  // 🏢 ENTERPRISE: Centralized companyId resolution (ADR-200)
  // Priority: building.companyId → user.companyId (critical for super_admin across tenants)
  const resolvedCompanyId = tryResolveCompanyId({ building, user })?.companyId;
  const { companyId, currentUserId, companyName } = useEntityFilesTabSession({
    companyId: resolvedCompanyId,
    withCompanyName: true,
  });

  if (!companyId || !currentUserId) {
    return null;
  }

  return (
    <EntityFilesManager
      custody={{ companyId }}
      currentUserId={currentUserId}
      entityType={entityType}
      entityId={entityId}
      entityLabel={entityLabel}
      projectId={projectId}
      domain="construction"
      category="floorplans"
      purpose={purpose}
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyName}
    />
  );
}

export default SpaceFloorplanInline;
