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
 *
 * Features:
 * - Mini trigger tabs (Κάτοψη, Φωτογραφίες, Βίντεο)
 * - Read-only mode (no upload, no delete, no trash)
 * - Gallery grid with thumbnails
 * - Click for lightbox/fullscreen view
 *
 * @module features/read-only-viewer/components/ReadOnlyMediaViewer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { Map, Camera, Video, FileQuestion, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/auth/contexts/AuthContext';

// 🏢 ENTERPRISE: Centralized Gallery Components (NO DUPLICATES)
import { FloorplanGallery } from '@/components/shared/files/media/FloorplanGallery';
import { MediaGallery } from '@/components/shared/files/media/MediaGallery';
import type { FileRecord } from '@/types/file-record';

// =============================================================================
// TYPES
// =============================================================================

interface ReadOnlyMediaViewerProps {
  /** Selected unit ID */
  unitId: string | null;
  /** Unit name for display */
  unitName?: string;
  /** Optional className */
  className?: string;
}

type MediaTab = 'floorplans' | 'photos' | 'videos';

// =============================================================================
// COMPONENT
// =============================================================================

export function ReadOnlyMediaViewer({
  unitId,
  unitName,
  className,
}: ReadOnlyMediaViewerProps) {
  const { t } = useTranslation(['properties', 'common', 'files']);
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<MediaTab>('floorplans');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  useEffect(() => {
    const fetchFiles = async () => {
      if (!unitId || !user?.companyId) {
        setFiles([]);
        return;
      }

      setLoading(true);
      try {
        const filesRef = collection(db, 'fileRecords');
        const q = query(
          filesRef,
          where('companyId', '==', user.companyId),
          where('entityType', '==', 'unit'),
          where('entityId', '==', String(unitId)),
          where('isDeleted', '==', false)
        );

        const snapshot = await getDocs(q);
        const fetchedFiles: FileRecord[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          // Only include floorplans, photos, videos
          if (['floorplans', 'photos', 'videos'].includes(data.category)) {
            fetchedFiles.push({
              id: doc.id,
              companyId: data.companyId,
              entityType: data.entityType,
              entityId: data.entityId,
              category: data.category,
              fileName: data.fileName || data.originalFileName || 'Unnamed',
              originalFileName: data.originalFileName,
              displayName: data.displayName || data.fileName,
              downloadUrl: data.downloadUrl || data.url,
              thumbnailUrl: data.thumbnailUrl,
              contentType: data.contentType || data.mimeType,
              ext: data.ext || data.fileName?.split('.').pop(),
              size: data.size,
              status: data.status || 'ready',
              isDeleted: data.isDeleted || false,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.(),
              createdBy: data.createdBy,
              processedData: data.processedData,
            } as FileRecord);
          }
        });

        setFiles(fetchedFiles);
      } catch (error) {
        console.error('[ReadOnlyMediaViewer] Error fetching files:', error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [unitId, user?.companyId]);

  // ==========================================================================
  // FILTERED FILES
  // ==========================================================================

  const floorplanFiles = useMemo(
    () => files.filter((f) => f.category === 'floorplans'),
    [files]
  );

  const photoFiles = useMemo(
    () => files.filter((f) => f.category === 'photos'),
    [files]
  );

  const videoFiles = useMemo(
    () => files.filter((f) => f.category === 'videos'),
    [files]
  );

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
  // LOADING STATE
  // ==========================================================================

  if (loading) {
    return (
      <Card className={cn('flex-1 flex flex-col min-h-0', className)}>
        <CardContent className={cn('flex-1 flex items-center justify-center', spacing.padding.md)}>
          <figure className="text-center text-muted-foreground">
            <Loader2 className={cn(iconSizes.lg, 'mx-auto mb-3 animate-spin')} aria-hidden="true" />
            <figcaption className="text-sm">
              {t('common:loading', 'Φόρτωση...')}
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
            <span className="text-xs">{t('viewer.media.floorplans', { ns: 'properties', defaultValue: 'Κάτοψη' })}</span>
            {floorplanFiles.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({floorplanFiles.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Camera className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.photos', { ns: 'properties', defaultValue: 'Φωτογραφίες' })}</span>
            {photoFiles.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({photoFiles.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="videos"
            className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5"
          >
            <Video className={iconSizes.sm} aria-hidden="true" />
            <span className="text-xs">{t('viewer.media.videos', { ns: 'properties', defaultValue: 'Βίντεο' })}</span>
            {videoFiles.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({videoFiles.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <section className="flex-1 min-h-0 overflow-hidden">
          {/* Floorplans Tab - Uses centralized FloorplanGallery */}
          <TabsContent value="floorplans" className="h-full m-0 data-[state=inactive]:hidden">
            <FloorplanGallery
              files={floorplanFiles}
              emptyMessage={t('viewer.media.noFloorplans', { ns: 'properties', defaultValue: 'Δεν υπάρχουν κατόψεις' })}
              className="h-full"
              // 🏢 READ-ONLY: No delete action
            />
          </TabsContent>

          {/* Photos Tab - Uses centralized MediaGallery */}
          <TabsContent value="photos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <MediaGallery
              files={photoFiles}
              showToolbar={false}
              enableSelection={false}
              cardSize="md"
              emptyMessage={t('viewer.media.noPhotos', { ns: 'properties', defaultValue: 'Δεν υπάρχουν φωτογραφίες' })}
              className={spacing.padding.sm}
              // 🏢 READ-ONLY: No delete/download callbacks
            />
          </TabsContent>

          {/* Videos Tab - Uses centralized MediaGallery */}
          <TabsContent value="videos" className="h-full m-0 overflow-auto data-[state=inactive]:hidden">
            <MediaGallery
              files={videoFiles}
              showToolbar={false}
              enableSelection={false}
              cardSize="md"
              emptyMessage={t('viewer.media.noVideos', { ns: 'properties', defaultValue: 'Δεν υπάρχουν βίντεο' })}
              className={spacing.padding.sm}
              // 🏢 READ-ONLY: No delete/download callbacks
            />
          </TabsContent>
        </section>
      </Tabs>
    </Card>
  );
}

export default ReadOnlyMediaViewer;
