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
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { useIconSizes } from '@/hooks/useIconSizes';
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { adaptFloorFloorplanToFileRecord } from './read-only-media-types';
import type { FileRecord } from '@/types/file-record';

// ── Shared prop types ──

export interface TabContentWrapperProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  spacing: ReturnType<typeof useSpacingTokens>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string, options?: Record<string, unknown>) => string;
  children: React.ReactNode;
}

// ── TabContentWrapper — loading/error states ──

export function TabContentWrapper({
  loading, error, onRetry, spacing, iconSizes, t, children,
}: TabContentWrapperProps) {
  const colors = useSemanticColors();

  if (loading) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className={cn('text-center', colors.text.muted)}>
          <Spinner size="large" className="mx-auto mb-3" />
          <figcaption className="text-sm">{t('common:loading.message')}</figcaption>
        </figure>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className="text-center">
          <AlertCircle className={cn(iconSizes.xl, 'mx-auto mb-3 text-destructive')} aria-hidden="true" />
          <figcaption className={cn('text-sm mb-4', colors.text.muted)}>{t('common:error')}</figcaption>
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className={iconSizes.sm} aria-hidden="true" />
            {t('common:retry')}
          </Button>
        </figure>
      </div>
    );
  }

  return <>{children}</>;
}

// ── FloorFloorplanTabContent — per-floor hook isolation (ADR-236) ──

interface FloorFloorplanTabContentProps {
  floorId: string;
  buildingId: string | null;
  floorNumber: number;
  companyId: string | null;
  spacing: ReturnType<typeof useSpacingTokens>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string, options?: Record<string, unknown>) => string;
  onHoverOverlay?: (propertyId: string | null) => void;
  onClickOverlay?: (propertyId: string) => void;
  highlightedOverlayUnitId?: string | null;
}

export function FloorFloorplanTabContent({
  floorId, buildingId, floorNumber, companyId,
  spacing, iconSizes, t,
  onHoverOverlay, onClickOverlay, highlightedOverlayUnitId,
}: FloorFloorplanTabContentProps) {
  const { floorFloorplan, loading, error, refetch } = useFloorFloorplans({
    floorId, buildingId, floorNumber, companyId,
  });

  const { overlays } = useFloorOverlays(floorId);

  const files = React.useMemo<FileRecord[]>(() => {
    if (!floorFloorplan) return [];
    return [adaptFloorFloorplanToFileRecord(floorFloorplan, companyId || '')];
  }, [floorFloorplan, companyId]);

  return (
    <TabContentWrapper
      loading={loading}
      error={error ? new Error(error) : null}
      onRetry={refetch}
      spacing={spacing}
      iconSizes={iconSizes}
      t={t}
    >
      <FloorplanGallery
        files={files}
        overlays={overlays}
        highlightedOverlayUnitId={highlightedOverlayUnitId}
        onHoverOverlay={onHoverOverlay}
        onClickOverlay={onClickOverlay}
        emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχει κάτοψη ορόφου' })}
        className="h-full"
      />
    </TabContentWrapper>
  );
}

// ── UnitFloorplanTabContent — per-level filtering (ADR-236 Phase 3) ──

interface UnitFloorplanTabContentProps {
  allUnitFloorplans: FileRecord[];
  levelFloorId: string;
  isFirstLevel: boolean;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  spacing: ReturnType<typeof useSpacingTokens>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function UnitFloorplanTabContent({
  allUnitFloorplans, levelFloorId, isFirstLevel,
  loading, error, onRetry, spacing, iconSizes, t,
}: UnitFloorplanTabContentProps) {
  const filteredFiles = React.useMemo(() => {
    return allUnitFloorplans.filter((file) => {
      if (file.levelFloorId === levelFloorId) return true;
      if (isFirstLevel && !file.levelFloorId) return true;
      return false;
    });
  }, [allUnitFloorplans, levelFloorId, isFirstLevel]);

  return (
    <TabContentWrapper
      loading={loading} error={error} onRetry={onRetry}
      spacing={spacing} iconSizes={iconSizes} t={t}
    >
      <FloorplanGallery
        files={filteredFiles}
        emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχουν κατόψεις' })}
        className="h-full"
      />
    </TabContentWrapper>
  );
}
