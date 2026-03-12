/**
 * FloorFloorplanInline — Inline Floorplan per Floor (IFC-Compliant)
 *
 * Wraps the centralized EntityFilesManager for floor-level floorplan
 * management. Used inside the expandable rows of FloorsTabContent.
 *
 * Follows IFC 4.3 standard: floor plans belong to IfcBuildingStorey (floor),
 * NOT to IfcBuilding. Same pattern as Revit Level views, ArchiCAD Story plans,
 * and Procore Drawing Areas per floor.
 *
 * @module components/building-management/tabs/FloorFloorplanInline
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-179 — Floorplan types (building / floor / unit)
 */

'use client';

import { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCompanyById } from '@/services/companies.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorFloorplanInline');

// ============================================================================
// TYPES
// ============================================================================

interface FloorFloorplanInlineProps {
  /** Floor document ID from Firestore */
  floorId: string;
  /** Floor display name (for entityLabel) */
  floorName: string;
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

export function FloorFloorplanInline({
  floorId,
  floorName,
  projectId,
}: FloorFloorplanInlineProps) {
  const { user } = useAuth();

  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // Fetch company name for display (same pattern as BuildingFloorplanTab)
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
      entityType="floor"
      entityId={floorId}
      entityLabel={floorName}
      projectId={projectId}
      domain="construction"
      category="floorplans"
      purpose="floor-floorplan"
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}

export default FloorFloorplanInline;
