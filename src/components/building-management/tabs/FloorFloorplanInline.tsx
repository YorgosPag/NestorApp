/**
 * FloorFloorplanInline — Inline Floorplan per Floor (IFC-Compliant)
 *
 * Two-section layout:
 * 1. FloorplanGallery — renders DXF/PDF/image via useFloorFloorplans
 *    (same pipeline as Διαθέσιμα Ακίνητα — loads scene data from Storage)
 * 2. EntityFilesManager — upload zone + file list for management
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

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCompanyById } from '@/services/companies.service';
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { Spinner } from '@/components/ui/spinner';
import type { FileRecord } from '@/types/file-record';
import type { DxfSceneData } from '@/types/file-record';
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
  /** Parent building's companyId — ensures super_admin stores files under the correct tenant */
  buildingCompanyId?: string;
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
  buildingCompanyId,
}: FloorFloorplanInlineProps) {
  const { user } = useAuth();

  // Use building's companyId first (critical for super_admin who manages multiple tenants)
  const companyId = buildingCompanyId || user?.companyId;
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

  // =========================================================================
  // FLOORPLAN VIEWER — same pipeline as Διαθέσιμα Ακίνητα (ReadOnlyMediaViewer)
  // Uses FloorFloorplanService → downloads scene JSON → renders via FloorplanGallery
  // =========================================================================

  const {
    floorFloorplan,
    loading: floorplanLoading,
    error: floorplanError,
    refetch: refetchFloorplan,
  } = useFloorFloorplans({
    floorId,
    buildingId: null,
    floorNumber: null,
    companyId: companyId || null,
  });

  // Adapter: FloorFloorplanData → FileRecord[] (same pattern as ReadOnlyMediaViewer)
  const viewerFiles = useMemo<FileRecord[]>(() => {
    if (!floorFloorplan) return [];

    return [{
      id: floorFloorplan.fileRecordId || `floor_fp_${floorFloorplan.floorId}`,
      originalFilename: floorFloorplan.fileName || 'floor_floorplan',
      displayName: floorFloorplan.fileName || `Κάτοψη - ${floorName}`,
      ext: floorFloorplan.fileType === 'pdf' ? 'pdf'
         : floorFloorplan.fileType === 'image' ? (floorFloorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')
         : 'dxf',
      contentType: floorFloorplan.fileType === 'pdf' ? 'application/pdf'
                 : floorFloorplan.fileType === 'image' ? `image/${floorFloorplan.fileName?.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpeg' : (floorFloorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')}`
                 : 'application/dxf',
      sizeBytes: 0,
      storagePath: '',
      downloadUrl: floorFloorplan.pdfImageUrl || '',
      status: 'ready' as const,
      lifecycleState: 'active' as const,
      companyId: companyId || '',
      entityType: 'floor' as const,
      entityId: floorFloorplan.floorId,
      domain: 'construction' as const,
      category: 'floorplans' as const,
      createdBy: SYSTEM_IDENTITY.ID,
      createdAt: floorFloorplan.timestamp
        ? new Date(floorFloorplan.timestamp).toISOString()
        : new Date().toISOString(),
      processedData: floorFloorplan.scene ? {
        fileType: 'dxf' as const,
        scene: floorFloorplan.scene as unknown as DxfSceneData,
        processedAt: Date.now(),
        sceneStats: {
          entityCount: floorFloorplan.scene.entities?.length || 0,
          layerCount: Object.keys(floorFloorplan.scene.layers || {}).length,
          parseTimeMs: 0,
        },
      } : undefined,
    }];
  }, [floorFloorplan, companyId, floorName]);

  if (!companyId || !currentUserId) {
    return null;
  }

  return (
    <section className="space-y-4">
      {/* Section 1: Floorplan Viewer (same pipeline as Properties page) */}
      <div className="min-h-[300px]">
        {floorplanLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Spinner size="large" />
          </div>
        ) : (
          <FloorplanGallery
            files={viewerFiles}
            onRefresh={refetchFloorplan}
            emptyMessage="Δεν υπάρχει κάτοψη ορόφου"
            className="h-[400px]"
          />
        )}
      </div>

      {/* Section 2: File Management (upload, list, delete) */}
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType="floor"
        entityId={floorId}
        entityLabel={floorName}
        projectId={projectId}
        domain="construction"
        category="floorplans"
        entryPointCategoryFilter="floorplans"
        displayStyle="standard"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
      />
    </section>
  );
}

export default FloorFloorplanInline;
