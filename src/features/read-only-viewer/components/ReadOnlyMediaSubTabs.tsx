/**
 * 📄 READ-ONLY MEDIA SUB-TABS — Shared tab content components
 *
 * TabContentWrapper, FloorFloorplanTabContent, UnitFloorplanTabContent.
 * Extracted from ReadOnlyMediaViewer (Google SRP).
 *
 * @enterprise ADR-031, ADR-236
 */

'use client';

import '@/lib/design-system';
import React from 'react';
import { MediaViewerPanelState } from '@/components/shared/media/viewer/MediaViewerShell';
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import { useBackgroundScale } from '@/hooks/useBackgroundScale';
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { adaptFloorFloorplanToFileRecord } from './read-only-media-types';
import type { FileRecord } from '@/types/file-record';

// ── Shared prop types ──

export interface TabContentWrapperProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  children: React.ReactNode;
}

// ── TabContentWrapper — loading/error states ──

export function TabContentWrapper({
  loading, error, onRetry, t, children,
}: TabContentWrapperProps) {
  // Οι καταστάσεις της σκηνής ζουν στο κοινό κέλυφος· εδώ μένει μόνο η μετάφραση των ετικετών του χώρου.
  return (
    <MediaViewerPanelState
      loading={loading}
      error={error}
      onRetry={onRetry}
      labels={{ loading: t('common:loading.message'), error: t('common:error'), retry: t('common:retry') }}
    >
      {children}
    </MediaViewerPanelState>
  );
}

// ── FloorFloorplanTabContent — per-floor hook isolation (ADR-236) ──

interface FloorFloorplanTabContentProps {
  floorId: string;
  buildingId: string | null;
  floorNumber: number;
  companyId: string | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  onHoverOverlay?: (propertyId: string | null) => void;
  onClickOverlay?: (propertyId: string) => void;
  highlightedOverlayUnitId?: string | null;
  propertyLabels?: ReadonlyMap<string, import('@/components/shared/files/media/overlay-polygon-renderer').OverlayLabel>;
}

export function FloorFloorplanTabContent({
  floorId, buildingId, floorNumber, companyId,
  t,
  onHoverOverlay, onClickOverlay, highlightedOverlayUnitId,
  propertyLabels,
}: FloorFloorplanTabContentProps) {
  const { floorFloorplan, loading, error, refetch } = useFloorFloorplans({
    floorId, buildingId, floorNumber, companyId,
  });

  const { overlays } = useFloorOverlays(floorId);
  const { unitsPerMeter, backgroundId } = useBackgroundScale(floorId);

  const files = React.useMemo<FileRecord[]>(() => {
    if (!floorFloorplan) return [];
    return [adaptFloorFloorplanToFileRecord(floorFloorplan, companyId || '')];
  }, [floorFloorplan, companyId]);

  return (
    <TabContentWrapper
      loading={loading}
      error={error ? new Error(error) : null}
      onRetry={refetch}
      t={t}
    >
      <FloorplanGallery
        files={files}
        floorplanId={files[0]?.id ?? null}
        overlays={overlays}
        highlightedOverlayUnitId={highlightedOverlayUnitId}
        onHoverOverlay={onHoverOverlay}
        onClickOverlay={onClickOverlay}
        propertyLabels={propertyLabels}
        unitsPerMeter={unitsPerMeter}
        backgroundId={backgroundId}
        emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties' })}
        className="h-full"
      />
    </TabContentWrapper>
  );
}

// ── UnitFloorplanTabContent — per-level filtering (ADR-236 Phase 3) ──

interface PropertyFloorplanTabContentProps {
  allUnitFloorplans: FileRecord[];
  levelFloorId: string;
  isFirstLevel: boolean;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function UnitFloorplanTabContent({
  allUnitFloorplans, levelFloorId, isFirstLevel,
  loading, error, onRetry, t,
}: PropertyFloorplanTabContentProps) {
  const filteredFiles = React.useMemo(() => {
    return allUnitFloorplans.filter((file) => {
      if (file.levelFloorId === levelFloorId) return true;
      if (isFirstLevel && !file.levelFloorId) return true;
      return false;
    });
  }, [allUnitFloorplans, levelFloorId, isFirstLevel]);

  const { unitsPerMeter, backgroundId } = useBackgroundScale(levelFloorId || null);

  return (
    <TabContentWrapper
      loading={loading} error={error} onRetry={onRetry}
      t={t}
    >
      <FloorplanGallery
        files={filteredFiles}
        unitsPerMeter={unitsPerMeter}
        backgroundId={backgroundId}
        emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties' })}
        className="h-full"
      />
    </TabContentWrapper>
  );
}
