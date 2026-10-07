/**
 * =============================================================================
 * 🏢 ENTERPRISE: Read-Only Media Viewer
 * =============================================================================
 *
 * Ultra-simple media viewer for external users (customers/visitors).
 * Shows floorplans, photos, and videos from Unit Management.
 *
 * Ο **εταιρικός προσαρμογέας** του `MediaViewerShell`: εδώ ζουν οι αναγνώσεις του χώρου (αρχεία, κάτοψη ορόφου,
 * επικαλύψεις, κλίμακα) και η χαρτογράφησή τους σε καρτέλες. Η εμφάνιση ανήκει στο κοινό κέλυφος — το ίδιο που φορά
 * η δημόσια αγγελία.
 *
 * Split: read-only-media-types (types), ReadOnlyMediaSubTabs (sub-components).
 * @module features/read-only-viewer/components/ReadOnlyMediaViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Map, Layers, Camera, Video, FileQuestion, type LucideIcon } from 'lucide-react';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { useFloorFloorplans } from '@/hooks/useFloorFloorplans';
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import { useBackgroundScale } from '@/hooks/useBackgroundScale';
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { MediaGallery } from '@/components/shared/files/media/MediaGallery';
import {
  MediaViewerEmptyState,
  MediaViewerShell,
  type MediaViewerTab,
} from '@/components/shared/media/viewer/MediaViewerShell';
import { useMediaTabParam } from '@/components/shared/media/viewer/useMediaTabParam';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { companyReadCustodyOf } from '@/lib/files/file-custody';

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

type Translate = (key: string, options?: Record<string, unknown>) => string;
type ViewerLevel = NonNullable<ReadOnlyMediaViewerProps['levels']>[number];

/** Ό,τι χρειάζεται μια καρτέλα από μια ανάγνωση αρχείων — το κοινό σχήμα των `useEntityFiles` και της κάτοψης ορόφου. */
interface MediaFilesState {
  files: FileRecord[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Το πλήθος της ετικέτας: σιωπηλό όσο φορτώνει, ώστε να μη φανεί ψευδές «0». */
const countOf = (data: MediaFilesState): number | undefined => (data.loading ? undefined : data.files.length);

// =============================================================================
// TAB BUILDERS — καθαρή χαρτογράφηση δεδομένων → καρτέλες του κελύφους
// =============================================================================

function unitFloorplanTabs(levels: readonly ViewerLevel[] | null, floorplans: MediaFilesState, t: Translate): MediaViewerTab[] {
  if (levels) {
    return levels.map((level, index) => ({
      id: `unit-floorplan-${level.floorId}`,
      label: t('properties:viewer.media.floorplanLevel', { name: level.name }),
      icon: Map,
      panel: (
        <UnitFloorplanTabContent
          allUnitFloorplans={floorplans.files}
          levelFloorId={level.floorId}
          isFirstLevel={index === 0}
          loading={floorplans.loading}
          error={floorplans.error}
          onRetry={floorplans.refetch}
          t={t}
        />
      ),
    }));
  }
  return [{
    id: 'floorplans',
    label: t('viewer.media.floorplanUnit', { ns: 'properties' }),
    icon: Map,
    count: countOf(floorplans),
    panel: (
      <TabContentWrapper loading={floorplans.loading} error={floorplans.error} onRetry={floorplans.refetch} t={t}>
        <FloorplanGallery
          files={floorplans.files}
          emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties' })}
          className="h-full"
        />
      </TabContentWrapper>
    ),
  }];
}

interface GalleryTabSpec {
  id: string;
  icon: LucideIcon;
  label: string;
  emptyMessage: string;
  data: MediaFilesState;
}

function galleryTab({ id, icon, label, emptyMessage, data }: GalleryTabSpec, padding: string, t: Translate): MediaViewerTab {
  return {
    id,
    label,
    icon,
    count: countOf(data),
    scroll: true,
    panel: (
      <TabContentWrapper loading={data.loading} error={data.error} onRetry={data.refetch} t={t}>
        <MediaGallery
          files={data.files} showToolbar={false} enableSelection={false} cardSize="md"
          emptyMessage={emptyMessage}
          className={padding}
        />
      </TabContentWrapper>
    ),
  };
}

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
  const { user } = useAuth();

  const effectiveCompanyId = propCompanyId || user?.companyId;

  if (propertyId && effectiveCompanyId) {
    logger.debug('Params resolved', { data: { propertyId, floorId, buildingId, floorNumber, propCompanyId, effectiveCompanyId } });
  }

  // ==========================================================================
  // URL-Based Tab State (Deep Linking)
  // ==========================================================================

  const mediaTabParam = useMediaTabParam();
  const multiLevels = levels && levels.length > 1 ? levels : null;
  const activeTab = (!mediaTabParam.raw && multiLevels)
    ? `unit-floorplan-${multiLevels[0].floorId}`
    : parseMediaTabParam(mediaTabParam.raw);

  const { write: writeMediaTab } = mediaTabParam;
  const setActiveTab = useCallback((newTab: MediaTab) => {
    writeMediaTab(newTab, newTab === DEFAULT_MEDIA_TAB && !multiLevels);
  }, [writeMediaTab, multiLevels]);

  // ==========================================================================
  // Data Fetching (ADR-031)
  // ==========================================================================

  const floorplansData = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', custody: companyReadCustodyOf(effectiveCompanyId),
    category: 'floorplans', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  logger.info('[ReadOnlyMediaViewer] Floor props:', { data: { floorId, buildingId, floorNumber, companyId: effectiveCompanyId, isMultiLevel: !!multiLevels, levelCount: levels?.length } });
  const { floorFloorplan, loading: floorFloorplanLoading, error: floorFloorplanError, refetch: refetchFloorFloorplan } = useFloorFloorplans({
    floorId: floorId || null, buildingId: buildingId || null,
    floorNumber: floorNumber ?? null, companyId: effectiveCompanyId || null,
  });

  const { overlays: singleFloorOverlays } = useFloorOverlays(floorId || null);
  const { unitsPerMeter: singleFloorUnitsPerMeter, backgroundId: singleFloorBackgroundId } = useBackgroundScale(floorId || null);

  // 🏢 Adapter: FloorFloorplanData → FileRecord[] (shared function from types)
  const floorFloorplansData = React.useMemo<MediaFilesState>(() => {
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
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', custody: companyReadCustodyOf(effectiveCompanyId),
    category: 'photos', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  const videosData = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY, entityId: propertyId || '', custody: companyReadCustodyOf(effectiveCompanyId),
    category: 'videos', autoFetch: !!propertyId && !!effectiveCompanyId,
    realtime: true,
  });

  // ==========================================================================
  // Empty State
  // ==========================================================================

  if (!propertyId) {
    return (
      <MediaViewerEmptyState
        icon={FileQuestion}
        message={t('viewer.selectPropertyToViewMedia', { ns: 'properties' })}
        className={className}
      />
    );
  }

  // ==========================================================================
  // Tabs — unit floorplans · floor floorplans · photos · videos
  // ==========================================================================

  const floorFloorplanTabs: MediaViewerTab[] = multiLevels
    ? multiLevels.map((level) => ({
        id: `floorplan-floor-${level.floorId}`,
        label: t('properties:viewer.media.floorplanFloorLevel', { name: level.name }),
        icon: Layers,
        panel: (
          <FloorFloorplanTabContent
            floorId={level.floorId} buildingId={buildingId || null}
            floorNumber={level.floorNumber} companyId={effectiveCompanyId || null}
            t={t}
            onHoverOverlay={onHoverOverlay} onClickOverlay={onClickOverlay}
            highlightedOverlayUnitId={highlightedOverlayUnitId}
            propertyLabels={propertyLabels}
          />
        ),
      }))
    : [{
        id: 'floorplan-floor',
        label: t('viewer.media.floorplanFloor', { ns: 'properties' }),
        icon: Layers,
        panel: (
          <TabContentWrapper loading={floorFloorplansData.loading} error={floorFloorplansData.error} onRetry={floorFloorplansData.refetch} t={t}>
            <FloorplanGallery
              files={floorFloorplansData.files}
              floorplanId={floorFloorplansData.files[0]?.id ?? null}
              overlays={singleFloorOverlays}
              highlightedOverlayUnitId={highlightedOverlayUnitId}
              onHoverOverlay={onHoverOverlay} onClickOverlay={onClickOverlay}
              propertyLabels={propertyLabels}
              unitsPerMeter={singleFloorUnitsPerMeter}
              backgroundId={singleFloorBackgroundId}
              emptyMessage={t('viewer.media.noFloorFloorplans', { ns: 'properties' })}
              className="h-full"
            />
          </TabContentWrapper>
        ),
      }];

  const tabs: MediaViewerTab[] = [
    ...unitFloorplanTabs(multiLevels, floorplansData, t),
    ...floorFloorplanTabs,
    galleryTab({
      id: 'photos', icon: Camera, data: photosData,
      label: t('viewer.media.photos', { ns: 'properties' }),
      emptyMessage: t('viewer.media.noPhotos', { ns: 'properties' }),
    }, spacing.padding.sm, t),
    galleryTab({
      id: 'videos', icon: Video, data: videosData,
      label: t('viewer.media.videos', { ns: 'properties' }),
      emptyMessage: t('viewer.media.noVideos', { ns: 'properties' }),
    }, spacing.padding.sm, t),
  ];

  return <MediaViewerShell tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className={className} />;
}

export default ReadOnlyMediaViewer;
