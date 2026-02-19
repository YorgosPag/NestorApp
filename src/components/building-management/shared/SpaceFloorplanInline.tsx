/**
 * SpaceFloorplanInline — Generic Inline Floorplan for Building Spaces
 *
 * Wraps the centralized EntityFilesManager for floorplan management
 * in storage units, parking spots, and units. Used inside expandable
 * rows of BuildingSpaceTable and BuildingSpaceCardGrid.
 *
 * Same pattern as FloorFloorplanInline but generic — accepts entityType
 * as prop instead of hardcoding "floor".
 *
 * @module components/building-management/shared/SpaceFloorplanInline
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-179 — Floorplan types (building / floor / unit)
 * @see ADR-187 — Floor-level floorplans with expandable rows
 */

'use client';

import { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCompanyById } from '@/services/companies.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { EntityType } from '@/config/domain-constants';

const logger = createModuleLogger('SpaceFloorplanInline');

// ============================================================================
// TYPES
// ============================================================================

interface SpaceFloorplanInlineProps {
  /** Entity type: "storage_unit" | "parking_spot" | "unit" */
  entityType: EntityType;
  /** Entity document ID from Firestore */
  entityId: string;
  /** Entity display name (for entityLabel) */
  entityLabel: string;
  /** Parent building's projectId (for storage path) */
  projectId?: string;
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
}: SpaceFloorplanInlineProps) {
  const { user } = useAuth();

  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // Fetch company name for display (same pattern as FloorFloorplanInline)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!companyId) {
      setCompanyDisplayName(undefined);
      return;
    }

    let cancelled = false;

    const fetchCompanyName = async () => {
      try {
        const company = await getCompanyById(companyId);
        if (cancelled) return;
        if (company && company.type === 'company') {
          setCompanyDisplayName(company.companyName || company.tradeName || companyId);
        } else {
          setCompanyDisplayName(companyId);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to fetch company name', { error });
          setCompanyDisplayName(companyId);
        }
      }
    };

    fetchCompanyName();
    return () => { cancelled = true; };
  }, [companyId]);

  if (!companyId || !currentUserId) {
    return null;
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={entityType}
      entityId={entityId}
      entityLabel={entityLabel}
      projectId={projectId}
      domain="construction"
      category="floorplans"
      purpose="space-floorplan"
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}

export default SpaceFloorplanInline;
