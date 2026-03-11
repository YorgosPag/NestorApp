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
import { Map, Layers, Camera, Video, FileQuestion, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';

// 🏢 ENTERPRISE: Centralized Data Hook (ADR-031)
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
// 🏢 ENTERPRISE: Floor Floorplan Hook (ADR-060) - Uses FloorFloorplanService
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
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
  /** Optional className */
  className?: string;
}

/**
 * 🏢 ENTERPRISE: Media Tab Type
 * Exported for parent components (e.g., ListLayout) to read from URL.
 * URL Query Param: ?mediaTab=floorplans|floorplan-floor|photos|videos
 */
export type MediaTab = 'floorplans' | 'floorplan-floor' | 'photos' | 'videos';

/** 🏢 ENTERPRISE: URL Query Param key - centralized constant */
export const MEDIA_TAB_PARAM = 'mediaTab' as const;

/** 🏢 ENTERPRISE: Default tab when no URL param */
export const DEFAULT_MEDIA_TAB: MediaTab = 'floorplans';

/** 🏢 ENTERPRISE: Valid media tabs for URL validation */
const VALID_MEDIA_TABS: readonly MediaTab[] = ['floorplans', 'floorplan-floor', 'photos', 'videos'] as const;

/**
 * 🏢 ENTERPRISE: Type-safe URL param parser
 * Returns validated MediaTab or default
 */
export function parseMediaTabParam(value: string | null): MediaTab {
  if (value && VALID_MEDIA_TABS.includes(value as MediaTab)) {
    return value as MediaTab;
  }
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
  className,
}: ReadOnlyMediaViewerProps) {
  const { t } = useTranslation(['properties', 'common', 'files']);
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { user } = useAuth();

  // 🏢 FIX: Use unit's companyId (from Firestore) if available, fallback to auth context.
  // Critical for super_admin who may have a different companyId or none in claims.
  const effectiveCompanyId = propCompanyId || user?.companyId;

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
  const activeTab = parseMediaTabParam(searchParams.get(MEDIA_TAB_PARAM));

  // Update URL when tab changes (preserves other params)
  const setActiveTab = useCallback((newTab: MediaTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === DEFAULT_MEDIA_TAB) {
      // Remove param for default value (cleaner URLs)
      params.delete(MEDIA_TAB_PARAM);
    } else {
      params.set(MEDIA_TAB_PARAM, newTab);
    }
    // Use replace to avoid polluting browser history
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

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
  // This hook loads from dxf-scenes/{fileId}/scene.json via FloorFloorplanService
  logger.info('[ReadOnlyMediaViewer] Floor props:', { data: { floorId, buildingId, floorNumber, companyId: effectiveCompanyId } });
  const { floorFloorplan, loading: floorFloorplanLoading, error: floorFloorplanError, refetch: refetchFloorFloorplan } = useFloorFloorplans({
    floorId: floorId || null,
    buildingId: buildingId || null,
    floorNumber: floorNumber ?? null,
    companyId: effectiveCompanyId || null, // 🏢 FIX: Use unit's companyId for super_admin support
  });

  // 🏢 ENTERPRISE: Adapter - Convert FloorFloorplanData to FileRecord[] for FloorplanGallery
  const floorFloorplansData = React.useMemo(() => {
    const files: FileRecord[] = [];

    // 🔍 DEBUG: Log what data we're receiving
    logger.info('[ReadOnlyMediaViewer] floorFloorplan data:', { data: {
      hasFloorFloorplan: !!floorFloorplan,
      hasScene: !!floorFloorplan?.scene,
      sceneEntitiesCount: floorFloorplan?.scene?.entities?.length || 0,
      sceneLayersType: floorFloorplan?.scene?.layers ? (Array.isArray(floorFloorplan.scene.layers) ? 'array' : 'object') : 'none',
      sceneBounds: floorFloorplan?.scene?.bounds,
      fileType: floorFloorplan?.fileType,
      fileName: floorFloorplan?.fileName,
    } });

    if (floorFloorplan) {
      // Create a synthetic FileRecord from FloorFloorplanData
      // 🏢 ENTERPRISE: Using correct FileRecord field names (ADR-031)
      const fileRecord: FileRecord = {
        id: floorFloorplan.fileRecordId || `floor_floorplan_${floorFloorplan.buildingId}_${floorFloorplan.floorId}`,
        originalFilename: floorFloorplan.fileName || 'floor_floorplan',
        displayName: floorFloorplan.fileName || 'Κάτοψη Ορόφου',
        ext: floorFloorplan.fileType === 'pdf' ? 'pdf' : 'dxf',
        contentType: floorFloorplan.fileType === 'pdf' ? 'application/pdf' : 'application/dxf',
        sizeBytes: 0, // Unknown for legacy data
        storagePath: '',
        downloadUrl: floorFloorplan.pdfImageUrl || '',
        status: 'ready',
        lifecycleState: 'active',
        companyId: effectiveCompanyId || '',
        entityType: 'floor',
        entityId: floorFloorplan.floorId,
        domain: 'construction',
        category: 'floorplans',
        createdBy: 'system',
        createdAt: floorFloorplan.timestamp ? new Date(floorFloorplan.timestamp).toISOString() : new Date().toISOString(),
        // 🏢 ENTERPRISE: Include scene data for DXF rendering (V1 pattern for backward compat)
        // Note: SceneModel and DxfSceneData are structurally compatible for rendering purposes
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
    switch (activeTab) {
      case 'floorplans':
        return floorplansData;
      case 'floorplan-floor':
        return floorFloorplansData;
      case 'photos':
        return photosData;
      case 'videos':
        return videosData;
    }
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
          <TabsTrigger
            value="floorplans"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Map className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.floorplanProperty', { ns: 'properties', defaultValue: 'Κάτοψη Ακινήτου' })}</span>
            {!floorplansData.loading && floorplansData.files.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({floorplansData.files.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="floorplan-floor"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Layers className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.floorplanFloor', { ns: 'properties', defaultValue: 'Κάτοψη Ορόφου' })}</span>
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

          {/* Floor Floorplan Tab - Uses centralized FloorplanGallery */}
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
                emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχει κάτοψη ορόφου' })}
                className="h-full"
                // 🏢 READ-ONLY: No delete action
              />
            </TabContentWrapper>
          </TabsContent>

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
          <Loader2 className={cn(iconSizes.lg, 'mx-auto mb-3 animate-spin')} aria-hidden="true" />
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

export default ReadOnlyMediaViewer;


