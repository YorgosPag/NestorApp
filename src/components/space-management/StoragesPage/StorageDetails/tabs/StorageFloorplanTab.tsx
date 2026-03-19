/**
 * StorageFloorplanTab — Floorplan tab for individual storage detail view
 *
 * Wraps the centralized EntityFilesManager for floorplan management
 * of a specific storage unit. Bidirectional with the expandable inline
 * floorplan in the building's StorageTabContent (same Firestore path).
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/storage/{id}/domains/construction/categories/floorplans/
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageFloorplanTab
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-187 — Floor-level floorplans with expandable rows (extended to spaces)
 */

'use client';

import { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { getCompanyById } from '@/services/companies.service';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { Storage } from '@/types/storage/contracts';

const logger = createModuleLogger('StorageFloorplanTab');

// ============================================================================
// TYPES
// ============================================================================

interface StorageFloorplanTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Accepted file types for floorplans (DXF, PDF, images) */
const FLOORPLAN_ACCEPT =
  '.dxf,.pdf,application/pdf,application/dxf,.jpg,.jpeg,.png,image/jpeg,image/png';

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageFloorplanTab({ storage }: StorageFloorplanTabProps) {
  const { user } = useAuth();

  const companyId = useCompanyId()?.companyId;
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
        entityType="storage"
        entityId={storage.id}
        entityLabel={storage.name}
        projectId={storage.projectId}
        domain="construction"
        category="floorplans"
        purpose={FLOORPLAN_PURPOSES.STORAGE}
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
      />
    </section>
  );
}

export default StorageFloorplanTab;
