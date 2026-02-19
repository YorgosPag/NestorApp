/**
 * ParkingFloorplanTab — Floorplan tab for individual parking spot detail view
 *
 * Wraps the centralized EntityFilesManager for floorplan management
 * of a specific parking spot. Bidirectional with the expandable inline
 * floorplan in the building's ParkingTabContent (same Firestore path).
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/parking_spot/{id}/domains/construction/categories/floorplans/
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingFloorplanTab
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-187 — Floor-level floorplans with expandable rows (extended to spaces)
 */

'use client';

import { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCompanyById } from '@/services/companies.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

const logger = createModuleLogger('ParkingFloorplanTab');

// ============================================================================
// TYPES
// ============================================================================

interface ParkingFloorplanTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
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

export function ParkingFloorplanTab({ parking }: ParkingFloorplanTabProps) {
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
    <section className="p-2">
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType="parking_spot"
        entityId={parking.id}
        entityLabel={parking.number}
        projectId={parking.projectId}
        domain="construction"
        category="floorplans"
        purpose="parking-floorplan"
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
      />
    </section>
  );
}

export default ParkingFloorplanTab;
