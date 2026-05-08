/**
 * =============================================================================
 * 🏢 ENTERPRISE: Read-Only Media Viewer
 * =============================================================================
 *
 * Ultra-simple media viewer for external users (customers/visitors).
 * Shows floorplans, photos, and videos from Unit Management.
 *
 * Split: read-only-media-types (types), ReadOnlyMediaSubTabs (sub-components).
 * @module features/read-only-viewer/components/ReadOnlyMediaViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Map, Layers, Camera, Video, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { MediaGallery } from '@/components/shared/files/media/MediaGallery';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import { ENTITY_TYPES } from '@/config/domain-constants';

// 🏢 ENTERPRISE: Extracted types + adapter (Google SRP)
import {
  type ReadOnlyMediaViewerProps,
  type MediaTab,
  MEDIA_TAB_PARAM,
  DEFAULT_MEDIA_TAB,
  parseMediaTabParam,
  adaptFloorFloorplanToFileRecord,
} from './read-only-media-types';

// 🏢 ENTERPRISE: Extracted sub-tab components (Google SRP)
import {
  TabContentWrapper,
  FloorFloorplanTabContent,
  UnitFloorplanTabContent,
} from './ReadOnlyMediaSubTabs';

import '@/lib/design-system';

// Re-export for backward compatibility (ListLayout imports these)
export { MEDIA_TAB_PARAM, parseMediaTabParam, DEFAULT_MEDIA_TAB };
export type { MediaTab };

const logger = createModuleLogger('ReadOnlyMediaViewer');

// =============================================================================
// COMPONENT
// =============================================================================

export function ReadOnlyMediaViewer({
  propertyId,
  propertyName: _propertyName,
  floorId,
  floorName: _floorName,
  buildingId,
  floorNumber,
  companyId: propCompanyId,
  levels,
  onHoverOverlay,
  onClickOverlay,
  highlightedOverlayUnitId,
  propertyLabels,
  className,
}: ReadOnlyMediaViewerProps) {
  const { t } = useTranslation(['properties', 'properties-viewer', 'properties-enums', 'properties-detail', 'common', 'common-validation', 'common-status', 'common-shared', 'common-sales', 'common-photos', 'common-navigation', 'common-empty-states', 'common-actions', 'common-account', 'files', 'files-media']);
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { user } = useAuth();

  const effectiveCompanyId = propCompanyId || user?.companyId;

  if (propertyId && effectiveCompanyId) {
    logger.debug('Params resolved', { data: { propertyId, floorId, buildingId, floorNumber, propCompanyId, effectiveCompanyId } });
  }

  // ==========================================================================
  // URL-Based Tab State (Deep Linking)
  // ==========================================================================

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hasMultipleLevels = levels && levels.length > 1;
  const isMultiLevel = levels && levels.length > 1;
  const rawMediaTabParam = searchParams.get(MEDIA_TAB_PARAM);
  const parsedTab = parseMediaTabParam(rawMediaTabParam);
  const activeTab = (!rawMediaTabParam && hasMultipleLevels && levels.length > 0)
    ? `unit-floorplan-${levels[0].floorId}`
    : parsedTab;

  const setActiveTab = useCallback((newTab: MediaTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === DEFAULT_MEDIA_TAB && !hasMultipleLevels) {
      params.delete(MEDIA_TAB_PARAM);
    } else {
      params.set(MEDIA_TAB_PARAM, newTab);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, hasMultipleLevels]);

  // ==========================================================================
  // Data Fetching (ADR-031)
  // ==========================================================================

  const floorplansData = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', companyId: effectiveCompanyId,
    category: 'floorplans', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  logger.info('[ReadOnlyMediaViewer] Floor props:', { data: { floorId, buildingId, floorNumber, companyId: effectiveCompanyId, isMultiLevel, levelCount: levels?.length } });
  const { floorFloorplan, loading: floorFloorplanLoading, error: floorFloorplanError, refetch: refetchFloorFloorplan } = useFloorFloorplans({
    floorId: floorId || null, buildingId: buildingId || null,
    floorNumber: floorNumber ?? null, companyId: effectiveCompanyId || null,
  });

  const { overlays: singleFloorOverlays } = useFloorOverlays(floorId || null);

  // 🏢 Adapter: FloorFloorplanData → FileRecord[] (shared function from types)
  const floorFloorplansData = React.useMemo(() => {
    const files: FileRecord[] = floorFloorplan
      ? [adaptFloorFloorplanToFileRecord(floorFloorplan, effectiveCompanyId || '')]
      : [];

    return {
      files,
      loading: floorFloorplanLoading,
      error: floorFloorplanError ? new Error(floorFloorplanError) : null,
      refetch: refetchFloorFloorplan,
    };
  }, [floorFloorplan, floorFloorplanLoading, floorFloorplanError, refetchFloorFloorplan, effectiveCompanyId]);

  const photosData = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', companyId: effectiveCompanyId,
    category: 'photos', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  const videosData = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', companyId: effectiveCompanyId,
    category: 'videos', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  // ==========================================================================
  // Empty State
  // ==========================================================================

  if (!propertyId) {
    return (
      <Card className={cn('flex-1 flex flex-col min-h-0', className)}>
        <CardContent className={cn('flex-1 flex items-center justify-center', spacing.padding.md)}>
          <figure className={cn('text-center', colors.text.muted)}>
            <FileQuestion className={cn(iconSizes['2xl'], 'mx-auto mb-3 opacity-50')} aria-hidden="true" />
            <figcaption className="text-sm">
              {t('viewer.selectPropertyToViewMedia', { ns: 'properties' })}
            </figcaption>
          </figure>
        </CardContent>
      </Card>
    );
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <Card className={cn('flex-1 flex flex-col min-h-0 overflow-hidden', className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MediaTab)} className="flex-1 flex flex-col min-h-0">
        {/* Tab Triggers */}
        <TabsList className={cn('shrink-0 w-full justify-start rounded-none border-b bg-transparent h-auto', spacing.padding.sm)}>
          {/* Unit floorplan tabs */}
          {isMultiLevel ? (
            levels.map((level) => (
              <TabsTrigger key={`unit-fp-${level.floorId}`} value={`unit-floorplan-${level.floorId}`} className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
                <Map className={iconSizes.sm} aria-hidden="true" />
                <span className="text-xs">{t('properties:viewer.media.floorplanLevel', { name: level.name })}</span>
              </TabsTrigger>
            ))
          ) : (
            <TabsTrigger value="floorplans" className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
              <Map className={iconSizes.sm} aria-hidden="true" />
              <span className="text-xs">{t('viewer.media.floorplanUnit', { ns: 'properties' })}</span>
              {!floorplansData.loading && floorplansData.files.length > 0 && (
                <span className={cn('ml-1 text-xs', colors.text.muted)}>({floorplansData.files.length})</span>
              )}
            </TabsTrigger>
          )}
          {/* Floor floorplan tabs */}
          {isMultiLevel ? (
            levels.map((level) => (
              <TabsTrigger key={`floor-fp-${level.floorId}`} value={`floorplan-floor-${level.floorId}`} className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
                <Layers className={iconSizes.sm} aria-hidden="true" />
                <span className="text-xs">{t('properties:viewer.media.floorplanFloorLevel', { name: level.name })}</span>
              </TabsTrigger>
            ))
          ) : (
            <TabsTrigger value="floorplan-floor" className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
              <Layers className={iconSizes.sm} aria-hidden="true" />
              <span className="text-xs">{t('viewer.media.floorplanFloor', { ns: 'properties' })}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="photos" className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
            <Camera className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.photos', { ns: 'properties' })}</span>
            {!photosData.loading && photosData.files.length > 0 && (
              <span className={cn('ml-1 text-xs', colors.text.muted)}>({photosData.files.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
            <Video className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.videos', { ns: 'properties' })}</span>
            {!videosData.loading && videosData.files.length > 0 && (
              <span className={cn('ml-1 text-xs', colors.text.muted)}>({videosData.files.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <section className="flex-1 min-h-0 overflow-hidden">
          {/* Unit floorplan content */}
          {isMultiLevel ? (
            levels.map((level, index) => (
              <TabsContent key={`unit-fp-content-${level.floorId}`} value={`unit-floorplan-${level.floorId}`} className="h-full m-0 data-[state=inactive]:hidden">
                <UnitFloorplanTabContent
                  allUnitFloorplans={floorplansData.files}
                  levelFloorId={level.floorId}
                  isFirstLevel={index === 0}
                  loading={floorplansData.loading}
                  error={floorplansData.error}
                  onRetry={floorplansData.refetch}
                  spacing={spacing} iconSizes={iconSizes} t={t}
                />
              </TabsContent>
            ))
          ) : (
            <TabsContent value="floorplans" className="h-full m-0 data-[state=inactive]:hidden">
              <TabContentWrapper loading={floorplansData.loading} error={floorplansData.error} onRetry={floorplansData.refetch} spacing={spacing} iconSizes={iconSizes} t={t}>
                <FloorplanGallery
                  files={floorplansData.files}
                  emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties' })}
                  className="h-full"
                />
              </TabContentWrapper>
            </TabsContent>
          )}

          {/* Floor floorplan content */}
          {isMultiLevel ? (
            levels.map((level) => (
              <TabsContent key={level.floorId} value={`floorplan-floor-${level.floorId}`} className="h-full m-0 data-[state=inactive]:hidden">
                <FloorFloorplanTabContent
                  floorId={level.floorId} buildingId={buildingId || null}
                  floorNumber={level.floorNumber} companyId={effectiveCompanyId || null}
                  spacing={spacing} iconSizes={iconSizes} t={t}
                  onHoverOverlay={onHoverOverlay} onClickOverlay={onClickOverlay}
                  highlightedOverlayUnitId={highlightedOverlayUnitId}
                  propertyLabels={propertyLabels}
                />
              </TabsContent>
            ))
          ) : (
            <TabsContent value="floorplan-floor" className="h-full m-0 data-[state=inactive]:hidden">
              <TabContentWrapper loading={floorFloorplansData.loading} error={floorFloorplansData.error} onRetry={floorFloorplansData.refetch} spacing={spacing} iconSizes={iconSizes} t={t}>
                <FloorplanGallery
                  files={floorFloorplansData.files}
                  overlays={singleFloorOverlays}
                  highlightedOverlayUnitId={highlightedOverlayUnitId}
                  onHoverOverlay={onHoverOverlay} onClickOverlay={onClickOverlay}
                  propertyLabels={propertyLabels}
                  emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties' })}
                  className="h-full"
                />
              </TabContentWrapper>
            </TabsContent>
          )}

          {/* Photos */}
          <TabsContent value="photos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <TabContentWrapper loading={photosData.loading} error={photosData.error} onRetry={photosData.refetch} spacing={spacing} iconSizes={iconSizes} t={t}>
              <MediaGallery
                files={photosData.files} showToolbar={false} enableSelection={false} cardSize="md"
                emptyMessage={t('viewer.media.noPhotos', { ns: 'properties' })}
                className={spacing.padding.sm}
              />
            </TabContentWrapper>
          </TabsContent>

          {/* Videos */}
          <TabsContent value="videos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <TabContentWrapper loading={videosData.loading} error={videosData.error} onRetry={videosData.refetch} spacing={spacing} iconSizes={iconSizes} t={t}>
              <MediaGallery
                files={videosData.files} showToolbar={false} enableSelection={false} cardSize="md"
                emptyMessage={t('viewer.media.noVideos', { ns: 'properties' })}
                className={spacing.padding.sm}
              />
            </TabContentWrapper>
          </TabsContent>
        </section>
      </Tabs>
    </Card>
  );
}

export default ReadOnlyMediaViewer;
