/**
 * =============================================================================
 * 🏢 ENTERPRISE: Read-Only Media Viewer
 * =============================================================================
 *
 * Ultra-simple media viewer for external users (customers/visitors).
 * Shows floorplans, photos, and videos from Unit Management.
 *
 * Uses centralized components:
 * - FloorplanGallery for DXF/PDF/Image floorplans (ADR-033)
 * - MediaGallery for photos/videos with lightbox (ADR-031)
 * - useEntityFiles hook for data fetching (ADR-031)
 *
 * Features:
 * - Mini trigger tabs (Κάτοψη, Φωτογραφίες, Βίντεο)
 * - Read-only mode (no upload, no delete, no trash)
 * - Gallery grid with thumbnails
 * - Click for lightbox/fullscreen view
 * - Error state UI with retry
 *
 * @module features/read-only-viewer/components/ReadOnlyMediaViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Map, Layers, Camera, Video, FileQuestion, AlertCircle, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';

// 🏢 ENTERPRISE: Centralized Data Hook (ADR-031)
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
// 🏢 ENTERPRISE: Floor Floorplan Hook (ADR-060) - Uses FloorFloorplanService
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
// 🏢 ENTERPRISE: Floor Overlays Hook (ADR-237 / SPEC-237B) - Read-only overlay bridge
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import type { FileRecord } from '@/types/file-record';

// 🏢 ENTERPRISE: Centralized Gallery Components (NO DUPLICATES)
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { MediaGallery } from '@/components/shared/files/media/MediaGallery';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ReadOnlyMediaViewer');

// =============================================================================
// TYPES
// =============================================================================

interface ReadOnlyMediaViewerProps {
  /** Selected unit ID */
  unitId: string | null;
  /** Unit name for display */
  unitName?: string;
  /** Floor ID for the unit (to show floor floorplan) - enterprise ID */
  floorId?: string | null;
  /** Floor name for display */
  floorName?: string;
  /** Building ID - used to find floor when floorId is null */
  buildingId?: string | null;
  /** Floor number - used with buildingId to find floor */
  floorNumber?: number | null;
  /** 🏢 FIX: Company ID from unit data — needed for FileRecord queries (super_admin support) */
  companyId?: string | null;
  /** Multi-level unit levels (ADR-236) — one tab per floor */
  levels?: Array<{ floorId: string; floorNumber: number; name: string }>;
  /** Callback: mouse hovers overlay → passes linked unitId (SPEC-237C) */
  onHoverOverlay?: (unitId: string | null) => void;
  /** Callback: user clicks overlay → passes linked unitId (SPEC-237C) */
  onClickOverlay?: (unitId: string) => void;
  /** ID of unit highlighted externally (from list hover) — bidirectional sync (SPEC-237C) */
  highlightedOverlayUnitId?: string | null;
  /** Optional className */
  className?: string;
}

/**
 * 🏢 ENTERPRISE: Media Tab Type
 * Exported for parent components (e.g., ListLayout) to read from URL.
 * URL Query Param: ?mediaTab=floorplans|floorplan-floor|floorplan-floor-{id}|photos|videos
 */
export type MediaTab = string;

/** 🏢 ENTERPRISE: URL Query Param key - centralized constant */
export const MEDIA_TAB_PARAM = 'mediaTab' as const;

/** 🏢 ENTERPRISE: Default tab when no URL param */
export const DEFAULT_MEDIA_TAB: MediaTab = 'floorplans';

/** 🏢 ENTERPRISE: Base valid media tabs for URL validation */
const BASE_VALID_TABS = ['floorplans', 'floorplan-floor', 'photos', 'videos'] as const;

/**
 * 🏢 ENTERPRISE: Type-safe URL param parser
 * Accepts base tabs + dynamic floorplan-floor-{floorId} tabs (ADR-236 multi-level)
 */
export function parseMediaTabParam(value: string | null): MediaTab {
  if (!value) return DEFAULT_MEDIA_TAB;
  if ((BASE_VALID_TABS as readonly string[]).includes(value)) return value;
  // ADR-236: Allow dynamic floor tabs like "floorplan-floor-abc123"
  if (value.startsWith('floorplan-floor-')) return value;
  return DEFAULT_MEDIA_TAB;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReadOnlyMediaViewer({
  unitId,
  unitName,
  floorId,
  floorName,
  buildingId,
  floorNumber,
  companyId: propCompanyId,
  levels,
  onHoverOverlay,
  onClickOverlay,
  highlightedOverlayUnitId,
  className,
}: ReadOnlyMediaViewerProps) {
  const { t } = useTranslation(['properties', 'common', 'files']);
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { user } = useAuth();

  // 🏢 FIX: Use unit's companyId (from Firestore) if available, fallback to auth context.
  // Critical for super_admin who may have a different companyId or none in claims.
  const effectiveCompanyId = propCompanyId || user?.companyId;

  // 🔍 DEBUG: Log params only when data is available (avoid spam on initial null renders)
  if (unitId && effectiveCompanyId) {
    logger.debug('Params resolved', { data: { unitId, floorId, buildingId, floorNumber, propCompanyId, effectiveCompanyId } });
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: URL-Based State (Deep Linking Support)
  // ==========================================================================
  // Tab state is stored in URL for:
  // - Persist across refresh
  // - Shareable deep links
  // - Browser back/forward navigation
  // - SSR compatibility
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read active tab from URL (with validation)
  // ADR-236: For multi-level units, default to first level tab on INITIAL load only
  const hasMultipleLevels = levels && levels.length > 1;
  const rawMediaTabParam = searchParams.get(MEDIA_TAB_PARAM);
  const parsedTab = parseMediaTabParam(rawMediaTabParam);
  // Redirect to first level tab ONLY when NO param is in URL (initial load).
  // If user explicitly clicked "floorplans" tab, rawMediaTabParam will be "floorplans" — respect it.
  const activeTab = (!rawMediaTabParam && hasMultipleLevels && levels.length > 0)
    ? `floorplan-floor-${levels[0].floorId}`
    : parsedTab;

  // Update URL when tab changes (preserves other params)
  const setActiveTab = useCallback((newTab: MediaTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === DEFAULT_MEDIA_TAB && !hasMultipleLevels) {
      // Remove param for default value (cleaner URLs) — single-level only.
      // For multi-level, always keep param so "floorplans" click isn't confused with initial load.
      params.delete(MEDIA_TAB_PARAM);
    } else {
      params.set(MEDIA_TAB_PARAM, newTab);
    }
    // Use replace to avoid polluting browser history
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, hasMultipleLevels]);

  // ==========================================================================
  // 🏢 ENTERPRISE: Data Fetching with Centralized Hook (ADR-031)
  // ==========================================================================
  // Each category has its own hook instance for proper separation of concerns
  // and independent loading/error states per tab.

  // 🏢 Unit floorplans (Κάτοψη Μονάδας)
  const floorplansData = useEntityFiles({
    entityType: 'unit',
    entityId: unitId || '',
    companyId: effectiveCompanyId,
    category: 'floorplans',
    autoFetch: !!unitId && !!effectiveCompanyId,
  });

  // 🏢 Floor floorplans (Κάτοψη Ορόφου) - Uses FloorFloorplanService (ADR-060)
  // For single-floor units, uses props directly. Multi-floor uses FloorFloorplanTabContent.
  const isMultiLevel = levels && levels.length > 1;
  logger.info('[ReadOnlyMediaViewer] Floor props:', { data: { floorId, buildingId, floorNumber, companyId: effectiveCompanyId, isMultiLevel, levelCount: levels?.length } });
  const { floorFloorplan, loading: floorFloorplanLoading, error: floorFloorplanError, refetch: refetchFloorFloorplan } = useFloorFloorplans({
    floorId: floorId || null,
    buildingId: buildingId || null,
    floorNumber: floorNumber ?? null,
    companyId: effectiveCompanyId || null,
  });

  // 🏢 SPEC-237B: Load overlays for single-level floor (read-only bridge)
  const { overlays: singleFloorOverlays } = useFloorOverlays(floorId || null);

  // 🏢 ENTERPRISE: Adapter - Convert FloorFloorplanData to FileRecord[] for FloorplanGallery
  const floorFloorplansData = React.useMemo(() => {
    const files: FileRecord[] = [];

    if (floorFloorplan) {
      const fileRecord: FileRecord = {
        id: floorFloorplan.fileRecordId || `floor_floorplan_${floorFloorplan.buildingId}_${floorFloorplan.floorId}`,
        originalFilename: floorFloorplan.fileName || 'floor_floorplan',
        displayName: floorFloorplan.fileName || 'Κάτοψη Ορόφου',
        ext: floorFloorplan.fileType === 'pdf' ? 'pdf'
           : floorFloorplan.fileType === 'image' ? (floorFloorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')
           : 'dxf',
        contentType: floorFloorplan.fileType === 'pdf' ? 'application/pdf'
                   : floorFloorplan.fileType === 'image' ? `image/${floorFloorplan.fileName?.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpeg' : (floorFloorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')}`
                   : 'application/dxf',
        sizeBytes: 0,
        storagePath: '',
        downloadUrl: floorFloorplan.pdfImageUrl || '',
        status: 'ready',
        lifecycleState: 'active',
        companyId: effectiveCompanyId || '',
        entityType: 'floor',
        entityId: floorFloorplan.floorId,
        domain: 'construction',
        category: 'floorplans',
        createdBy: SYSTEM_IDENTITY.ID,
        createdAt: floorFloorplan.timestamp ? new Date(floorFloorplan.timestamp).toISOString() : new Date().toISOString(),
        processedData: floorFloorplan.scene ? {
          fileType: 'dxf' as const,
          scene: floorFloorplan.scene as unknown as import('@/types/file-record').DxfSceneData,
          processedAt: Date.now(),
          sceneStats: {
            entityCount: floorFloorplan.scene.entities?.length || 0,
            layerCount: Object.keys(floorFloorplan.scene.layers || {}).length,
            parseTimeMs: 0,
          },
        } : undefined,
      };
      files.push(fileRecord);
    }

    return {
      files,
      loading: floorFloorplanLoading,
      error: floorFloorplanError ? new Error(floorFloorplanError) : null,
      refetch: refetchFloorFloorplan,
    };
  }, [floorFloorplan, floorFloorplanLoading, floorFloorplanError, refetchFloorFloorplan, effectiveCompanyId]);

  const photosData = useEntityFiles({
    entityType: 'unit',
    entityId: unitId || '',
    companyId: effectiveCompanyId,
    category: 'photos',
    autoFetch: !!unitId && !!effectiveCompanyId,
  });

  const videosData = useEntityFiles({
    entityType: 'unit',
    entityId: unitId || '',
    companyId: effectiveCompanyId,
    category: 'videos',
    autoFetch: !!unitId && !!effectiveCompanyId,
  });

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  // Overall loading state for tab badge counts
  const isAnyLoading = floorplansData.loading || photosData.loading || videosData.loading;

  // Current tab's data based on activeTab
  const getCurrentTabData = () => {
    if (activeTab === 'floorplans') return floorplansData;
    if (activeTab === 'floorplan-floor') return floorFloorplansData;
    // ADR-236: Multi-level floor tabs are handled by FloorFloorplanTabContent (own hooks)
    if (activeTab.startsWith('floorplan-floor-')) return null;
    if (activeTab === 'photos') return photosData;
    if (activeTab === 'videos') return videosData;
    return null;
  };

  const currentTabData = getCurrentTabData();

  // ==========================================================================
  // EMPTY STATE - No unit selected
  // ==========================================================================

  if (!unitId) {
    return (
      <Card className={cn('flex-1 flex flex-col min-h-0', className)}>
        <CardContent className={cn('flex-1 flex items-center justify-center', spacing.padding.md)}>
          <figure className="text-center text-muted-foreground">
            <FileQuestion className={cn(iconSizes['2xl'], 'mx-auto mb-3 opacity-50')} aria-hidden="true" />
            <figcaption className="text-sm">
              {t('viewer.selectPropertyToViewMedia', { ns: 'properties', defaultValue: 'Επιλέξτε ακίνητο για προβολή' })}
            </figcaption>
          </figure>
        </CardContent>
      </Card>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Card className={cn('flex-1 flex flex-col min-h-0 overflow-hidden', className)}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MediaTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Mini Trigger Tabs */}
        <TabsList
          className={cn(
            'shrink-0 w-full justify-start rounded-none border-b bg-transparent h-auto',
            spacing.padding.sm
          )}
        >
          {/* ADR-236: Level floorplans FIRST — one tab per floor (multi-level) or single floor tab */}
          {isMultiLevel ? (
            levels.map((level) => (
              <TabsTrigger
                key={level.floorId}
                value={`floorplan-floor-${level.floorId}`}
                className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
              >
                <Layers className={iconSizes.sm} aria-hidden="true" />
                <span className="text-xs">
                  {`${t('viewer.media.floorplans', { ns: 'properties', defaultValue: 'Κάτοψη' })} ${level.name}`}
                </span>
              </TabsTrigger>
            ))
          ) : (
            <TabsTrigger
              value="floorplan-floor"
              className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
            >
              <Layers className={iconSizes.sm} aria-hidden="true" />
              <span className="text-xs">{t('viewer.media.floorplanFloor', { ns: 'properties', defaultValue: 'Κάτοψη Ορόφου' })}</span>
            </TabsTrigger>
          )}
          {/* Unit floorplan — label depends on multi-level status */}
          <TabsTrigger
            value="floorplans"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Map className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">
              {isMultiLevel
                ? t('viewer.media.floorplanUnit', { ns: 'properties', defaultValue: 'Κάτοψη Μονάδας' })
                : t('viewer.media.floorplanFloor', { ns: 'properties', defaultValue: 'Κάτοψη Ορόφου' })
              }
            </span>
            {!floorplansData.loading && floorplansData.files.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({floorplansData.files.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Camera className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.photos', { ns: 'properties', defaultValue: 'Φωτογραφίες' })}</span>
            {!photosData.loading && photosData.files.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({photosData.files.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="videos"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Video className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.videos', { ns: 'properties', defaultValue: 'Βίντεο' })}</span>
            {!videosData.loading && videosData.files.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({videosData.files.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <section className="flex-1 min-h-0 overflow-hidden">
          {/* Floorplans Tab (Unit) - Uses centralized FloorplanGallery */}
          <TabsContent value="floorplans" className="h-full m-0 data-[state=inactive]:hidden">
            <TabContentWrapper
              loading={floorplansData.loading}
              error={floorplansData.error}
              onRetry={floorplansData.refetch}
              spacing={spacing}
              iconSizes={iconSizes}
              t={t}
            >
              <FloorplanGallery
                files={floorplansData.files}
                emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχουν κατόψεις' })}
                className="h-full"
                // 🏢 READ-ONLY: No delete action
              />
            </TabContentWrapper>
          </TabsContent>

          {/* Floor Floorplan Tab(s) - ADR-236: multi-level → one content per floor */}
          {isMultiLevel ? (
            levels.map((level) => (
              <TabsContent key={level.floorId} value={`floorplan-floor-${level.floorId}`} className="h-full m-0 data-[state=inactive]:hidden">
                <FloorFloorplanTabContent
                  floorId={level.floorId}
                  buildingId={buildingId || null}
                  floorNumber={level.floorNumber}
                  companyId={effectiveCompanyId || null}
                  spacing={spacing}
                  iconSizes={iconSizes}
                  t={t}
                  onHoverOverlay={onHoverOverlay}
                  onClickOverlay={onClickOverlay}
                  highlightedOverlayUnitId={highlightedOverlayUnitId}
                />
              </TabsContent>
            ))
          ) : (
            <TabsContent value="floorplan-floor" className="h-full m-0 data-[state=inactive]:hidden">
              <TabContentWrapper
                loading={floorFloorplansData.loading}
                error={floorFloorplansData.error}
                onRetry={floorFloorplansData.refetch}
                spacing={spacing}
                iconSizes={iconSizes}
                t={t}
              >
                <FloorplanGallery
                  files={floorFloorplansData.files}
                  overlays={singleFloorOverlays}
                  highlightedOverlayUnitId={highlightedOverlayUnitId}
                  onHoverOverlay={onHoverOverlay}
                  onClickOverlay={onClickOverlay}
                  emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχει κάτοψη ορόφου' })}
                  className="h-full"
                />
              </TabContentWrapper>
            </TabsContent>
          )}

          {/* Photos Tab - Uses centralized MediaGallery */}
          <TabsContent value="photos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <TabContentWrapper
              loading={photosData.loading}
              error={photosData.error}
              onRetry={photosData.refetch}
              spacing={spacing}
              iconSizes={iconSizes}
              t={t}
            >
              <MediaGallery
                files={photosData.files}
                showToolbar={false}
                enableSelection={false}
                cardSize="md"
                emptyMessage={t('viewer.media.noPhotos', { ns: 'properties', defaultValue: 'Δεν υπάρχουν φωτογραφίες' })}
                className={spacing.padding.sm}
                // 🏢 READ-ONLY: No delete/download callbacks
              />
            </TabContentWrapper>
          </TabsContent>

          {/* Videos Tab - Uses centralized MediaGallery */}
          <TabsContent value="videos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <TabContentWrapper
              loading={videosData.loading}
              error={videosData.error}
              onRetry={videosData.refetch}
              spacing={spacing}
              iconSizes={iconSizes}
              t={t}
            >
              <MediaGallery
                files={videosData.files}
                showToolbar={false}
                enableSelection={false}
                cardSize="md"
                emptyMessage={t('viewer.media.noVideos', { ns: 'properties', defaultValue: 'Δεν υπάρχουν βίντεο' })}
                className={spacing.padding.sm}
                // 🏢 READ-ONLY: No delete/download callbacks
              />
            </TabContentWrapper>
          </TabsContent>
        </section>
      </Tabs>
    </Card>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Tab Content Wrapper with Loading/Error States
// =============================================================================

interface TabContentWrapperProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  spacing: ReturnType<typeof useSpacingTokens>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string, options?: Record<string, unknown>) => string;
  children: React.ReactNode;
}

/**
 * Wrapper component that handles loading and error states for tab content.
 * Enterprise pattern: Separate presentation logic from data fetching states.
 */
function TabContentWrapper({
  loading,
  error,
  onRetry,
  spacing,
  iconSizes,
  t,
  children,
}: TabContentWrapperProps) {
  // Loading State
  if (loading) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className="text-center text-muted-foreground">
          <Spinner size="large" className="mx-auto mb-3" />
          <figcaption className="text-sm">
            {t('common:loading.message')}
          </figcaption>
        </figure>
      </div>
    );
  }

  // Error State with Retry
  if (error) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className="text-center">
          <AlertCircle className={cn(iconSizes.xl, 'mx-auto mb-3 text-destructive')} aria-hidden="true" />
          <figcaption className="text-sm text-muted-foreground mb-4">
            {t('common:error')}
          </figcaption>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className={iconSizes.sm} aria-hidden="true" />
            {t('common:retry')}
          </Button>
        </figure>
      </div>
    );
  }

  // Content
  return <>{children}</>;
}

// =============================================================================
// 🏢 ADR-236: Floor Floorplan Tab Content (per-floor hook isolation)
// =============================================================================
// Each multi-level floor needs its own useFloorFloorplans call.
// Extracted to a component so hooks are called unconditionally per-render.

interface FloorFloorplanTabContentProps {
  floorId: string;
  buildingId: string | null;
  floorNumber: number;
  companyId: string | null;
  spacing: ReturnType<typeof useSpacingTokens>;
  iconSizes: ReturnType<typeof useIconSizes>;
  t: (key: string, options?: Record<string, unknown>) => string;
  /** SPEC-237C: Overlay interaction callbacks */
  onHoverOverlay?: (unitId: string | null) => void;
  onClickOverlay?: (unitId: string) => void;
  highlightedOverlayUnitId?: string | null;
}

function FloorFloorplanTabContent({
  floorId,
  buildingId,
  floorNumber,
  companyId,
  spacing,
  iconSizes,
  t,
  onHoverOverlay,
  onClickOverlay,
  highlightedOverlayUnitId,
}: FloorFloorplanTabContentProps) {
  const { floorFloorplan, loading, error, refetch } = useFloorFloorplans({
    floorId,
    buildingId,
    floorNumber,
    companyId,
  });

  // 🏢 SPEC-237B: Load overlays for this floor (read-only bridge)
  const { overlays } = useFloorOverlays(floorId);

  const files = React.useMemo<FileRecord[]>(() => {
    if (!floorFloorplan) return [];
    return [{
      id: floorFloorplan.fileRecordId || `floor_floorplan_${floorFloorplan.buildingId}_${floorFloorplan.floorId}`,
      originalFilename: floorFloorplan.fileName || 'floor_floorplan',
      displayName: floorFloorplan.fileName || 'Κάτοψη Ορόφου',
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
      createdAt: floorFloorplan.timestamp ? new Date(floorFloorplan.timestamp).toISOString() : new Date().toISOString(),
      processedData: floorFloorplan.scene ? {
        fileType: 'dxf' as const,
        scene: floorFloorplan.scene as unknown as import('@/types/file-record').DxfSceneData,
        processedAt: Date.now(),
        sceneStats: {
          entityCount: floorFloorplan.scene.entities?.length || 0,
          layerCount: Object.keys(floorFloorplan.scene.layers || {}).length,
          parseTimeMs: 0,
        },
      } : undefined,
    }];
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

export default ReadOnlyMediaViewer;
