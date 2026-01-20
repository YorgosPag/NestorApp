/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Floorplan Tab
 * =============================================================================
 *
 * Unified floorplan management using EntityFilesManager + FloorplanProcessor.
 * Replaces legacy FloorplanService with centralized file storage.
 *
 * @module components/projects/tabs/ProjectFloorplanTab
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Architecture:
 * - Uses EntityFilesManager for upload/list (same as Photos, Videos, Documents)
 * - Uses FloorplanProcessor to parse DXF/render PDF on upload
 * - Caches processed data in FileRecord.processedData
 * - Uses FloorplanViewerTab-style rendering for display
 *
 * Storage Path:
 * companies/{companyId}/entities/project/{projectId}/domains/construction/categories/floorplans/files/
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map, Plus, FileUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useAuth } from '@/auth/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { canvasUtilities, layoutUtilities } from '@/styles/design-tokens';

// Types
import type { Project } from '@/types/project';
import type { DxfSceneData } from '@/types/file-record';

// Services & Hooks
import { isFloorplanFile } from '@/services/floorplans/FloorplanProcessor';
import { useFloorplanUpload } from '@/hooks/useFloorplanUpload';
import { useFloorplanFiles } from '@/hooks/useFloorplanFiles';
import { FILE_DOMAINS, FILE_CATEGORIES, ENTITY_TYPES } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectFloorplanTabProps {
  /** Project data */
  project?: Project & { id: string | number; name?: string };
  /** Alternative data prop (from UniversalTabsRenderer) */
  data?: Project;
  /** Floorplan type: 'project' for general, 'parking' for parking */
  floorplanType?: 'project' | 'parking';
  /** Title for the tab */
  title?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Accepted file types for floorplans */
const FLOORPLAN_ACCEPT = '.dxf,.pdf,application/pdf,application/dxf,image/vnd.dxf';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Project Floorplan Tab
 *
 * Displays and manages project floorplans (DXF/PDF) using:
 * - EntityFilesManager pattern for upload
 * - FloorplanProcessor for parsing/rendering
 * - Canvas-based display for DXF files
 */
export function ProjectFloorplanTab({
  project,
  data,
  floorplanType = 'project',
  title,
}: ProjectFloorplanTabProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();
  const { user } = useAuth();

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🏢 ENTERPRISE: State for loaded scene (V2: fetched from Storage)
  const [loadedScene, setLoadedScene] = useState<DxfSceneData | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);

  // Resolve project from props
  const resolvedProject = project || data;
  const companyId = user?.companyId;
  const projectId = resolvedProject?.id ? String(resolvedProject.id) : null;
  const userId = user?.uid;

  // Determine purpose based on floorplan type
  const purpose = floorplanType === 'parking' ? 'parking-floorplan' : 'project-floorplan';

  // 🏢 ENTERPRISE: Use centralized hooks for upload and file loading
  const {
    uploadFloorplan,
    isUploading,
    progress,
    error: uploadError,
    errorCode: uploadErrorCode,
    clearError: clearUploadError,
  } = useFloorplanUpload({
    companyId: companyId || '',
    projectId: projectId || undefined,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId || '',
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    userId: userId || '',
    entityLabel: resolvedProject?.name,
    purpose,
  });

  const {
    files,
    primaryFile: currentFile,
    loading: isLoading,
    error: loadError,
    refetch,
  } = useFloorplanFiles({
    companyId,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId || undefined,
    purposeFilter: purpose,
    autoProcess: true,
  });

  // Combined error state
  const error = uploadError || loadError;

  // Translated title
  const displayTitle = title
    ? (title.includes('.') ? t(title) : title)
    : floorplanType === 'parking'
      ? t('tabs.parkingFloorplan.title')
      : t('tabs.projectFloorplan.title');

  // =========================================================================
  // EFFECTS
  // =========================================================================

  /**
   * 🏢 ENTERPRISE V3: Load scene data via authenticated API
   *
   * V3 Architecture: Scene fetched via /api/floorplans/scene with auth
   * V1 Legacy: Scene was embedded in Firestore document (backward compatible)
   */
  useEffect(() => {
    if (!currentFile?.processedData) {
      setLoadedScene(null);
      return;
    }

    const processedData = currentFile.processedData;

    // V3: Load via authenticated API (processedDataPath exists)
    if (processedData.processedDataPath && currentFile.id && auth.currentUser) {
      setSceneLoading(true);
      setSceneError(null);

      const loadSceneFromAPI = async () => {
        try {
          // 🔒 Get ID token for API authentication
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          const idToken = await currentUser.getIdToken();

          const response = await fetch(`/api/floorplans/scene?fileId=${currentFile.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });

          // Handle 202 - processing in progress
          if (response.status === 202) {
            console.log('⏳ [ProjectFloorplanTab] Scene not yet processed, will retry...');
            setSceneError(t('building.floorplan.processingInProgress', 'Η επεξεργασία είναι σε εξέλιξη...'));
            setSceneLoading(false);
            return;
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const sceneData: DxfSceneData = await response.json();
          console.log('✅ [ProjectFloorplanTab] Scene loaded via API:', {
            entities: sceneData.entities?.length,
            layers: Object.keys(sceneData.layers || {}).length,
          });
          setLoadedScene(sceneData);
          setSceneLoading(false);
        } catch (err) {
          console.error('❌ [ProjectFloorplanTab] Failed to load scene from API:', err);
          setSceneError(err instanceof Error ? err.message : 'Unknown error');
          setSceneLoading(false);
        }
      };

      loadSceneFromAPI();
      return;
    }

    // V1 Legacy: Use embedded scene (backward compatibility)
    if (processedData.scene) {
      console.log('📋 [ProjectFloorplanTab] Using embedded scene (V1 legacy)');
      setLoadedScene(processedData.scene);
      setSceneLoading(false);
      return;
    }

    // No scene available
    setLoadedScene(null);
  }, [currentFile?.processedData?.processedDataPath, currentFile?.processedData?.scene, currentFile?.id, user, t]);

  /**
   * Render loaded scene to canvas
   */
  useEffect(() => {
    if (!loadedScene || !canvasRef.current) return;
    if (!loadedScene.entities || loadedScene.entities.length === 0) return;

    renderDxfToCanvas(loadedScene);
  }, [loadedScene]);

  // =========================================================================
  // RENDERING FUNCTIONS
  // =========================================================================

  /**
   * Render DXF scene data to canvas
   * Same logic as FloorplanViewerTab for consistency
   */
  const renderDxfToCanvas = useCallback((scene: DxfSceneData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Detect dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds and scale
    const bounds = scene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    const drawingWidth = bounds.max.x - bounds.min.x;
    const drawingHeight = bounds.max.y - bounds.min.y;

    const scaleX = canvas.width / drawingWidth;
    const scaleY = canvas.height / drawingHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - drawingWidth * scale) / 2;
    const offsetY = (canvas.height - drawingHeight * scale) / 2;

    // Get layer color
    const getLayerColor = (layerName: string): string => {
      return scene.layers?.[layerName]?.color || '#e2e8f0';
    };

    ctx.lineWidth = 1;

    // Render entities
    scene.entities.forEach((entity) => {
      // Skip invisible layers
      if (scene.layers?.[entity.layer]?.visible === false) return;

      const layerColor = getLayerColor(entity.layer);
      ctx.strokeStyle = layerColor;

      const e = entity as Record<string, unknown>;

      switch (entity.type) {
        case 'line': {
          const start = e.start as { x: number; y: number } | undefined;
          const end = e.end as { x: number; y: number } | undefined;
          if (start && end) {
            ctx.beginPath();
            ctx.moveTo(
              (start.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - start.y) * scale + offsetY
            );
            ctx.lineTo(
              (end.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - end.y) * scale + offsetY
            );
            ctx.stroke();
          }
          break;
        }

        case 'polyline': {
          const vertices = e.vertices as Array<{ x: number; y: number }> | undefined;
          const closed = e.closed as boolean | undefined;
          if (vertices && Array.isArray(vertices) && vertices.length > 1) {
            ctx.beginPath();
            const firstVertex = vertices[0];
            ctx.moveTo(
              (firstVertex.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - firstVertex.y) * scale + offsetY
            );

            vertices.slice(1).forEach((vertex) => {
              ctx.lineTo(
                (vertex.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - vertex.y) * scale + offsetY
              );
            });

            if (closed) ctx.closePath();
            ctx.stroke();
          }
          break;
        }

        case 'circle': {
          const center = e.center as { x: number; y: number } | undefined;
          const radius = e.radius as number | undefined;
          if (center && radius) {
            ctx.beginPath();
            ctx.arc(
              (center.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - center.y) * scale + offsetY,
              radius * scale,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }
          break;
        }

        case 'arc': {
          const arcCenter = e.center as { x: number; y: number } | undefined;
          const arcRadius = e.radius as number | undefined;
          const startAngle = e.startAngle as number | undefined;
          const endAngle = e.endAngle as number | undefined;
          if (arcCenter && arcRadius && startAngle !== undefined && endAngle !== undefined) {
            ctx.beginPath();
            ctx.arc(
              (arcCenter.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - arcCenter.y) * scale + offsetY,
              arcRadius * scale,
              endAngle,
              startAngle,
              false
            );
            ctx.stroke();
          }
          break;
        }

        case 'text': {
          const position = e.position as { x: number; y: number } | undefined;
          const text = e.text as string | undefined;
          const height = e.height as number | undefined;
          if (position && text) {
            ctx.fillStyle = layerColor;
            ctx.font = `${Math.max(8, (height || 10) * scale)}px Arial`;
            ctx.fillText(
              text,
              (position.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - position.y) * scale + offsetY
            );
          }
          break;
        }
      }
    });
  }, []);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Handle file selection - uses centralized useFloorplanUpload hook
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId || !projectId || !userId) return;

    // Validate file type
    const ext = file.name.split('.').pop() || '';
    if (!isFloorplanFile(file.type, ext)) {
      console.warn('⚠️ [ProjectFloorplanTab] Invalid file type:', file.type, ext);
      return;
    }

    // Clear any previous errors
    clearUploadError();

    console.log('📁 [ProjectFloorplanTab] Starting upload via centralized pipeline:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      purpose,
    });

    // Upload using centralized hook (3-step pipeline + processing)
    const result = await uploadFloorplan(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (result.success) {
      console.log('✅ [ProjectFloorplanTab] Upload successful:', result.fileRecord?.id);
      // Files list will auto-update via real-time listener
    } else {
      console.error('❌ [ProjectFloorplanTab] Upload failed:', result.error);
    }
  }, [companyId, projectId, userId, purpose, uploadFloorplan, clearUploadError]);

  /**
   * Trigger file input click
   */
  const handleAddFloorplan = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Guard: No project or auth
  if (!resolvedProject?.id || !companyId || !userId) {
    return (
      <Card className="w-full h-full">
        <CardContent className="flex items-center justify-center h-64">
          <p className={cn('text-sm', colors.text.muted)}>
            {t('tabs.floorplan.noProject')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <header className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Map className={iconSizes.md} />
            {displayTitle}
          </CardTitle>
          <nav className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
              className="flex items-center gap-1"
              title={t('common.refresh')}
            >
              <RefreshCw className={cn(iconSizes.sm, isLoading && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddFloorplan}
              disabled={isUploading}
              className="flex items-center gap-1"
            >
              {isUploading ? (
                <>
                  <AnimatedSpinner size="small" />
                  <span className="ml-1">{progress}%</span>
                </>
              ) : (
                <Plus className={iconSizes.sm} />
              )}
              {t('tabs.floorplan.addFloorplan')}
            </Button>
          </nav>
        </header>
      </CardHeader>

      <CardContent className="p-2 flex-1 flex flex-col overflow-hidden">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={FLOORPLAN_ACCEPT}
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* Error display - enterprise error handling with specific messages */}
        {error && (
          <aside
            className={cn(
              'flex items-center gap-2 p-3 mb-4 rounded-md',
              uploadErrorCode === 'AUTH_MISSING_COMPANY_CLAIM' || uploadErrorCode === 'AUTH_COMPANY_MISMATCH'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            )}
            role="alert"
          >
            <AlertCircle className={iconSizes.sm} />
            <span className="text-sm">{error}</span>
          </aside>
        )}

        {/* Loading state */}
        {isLoading ? (
          <section className="flex items-center justify-center h-64">
            <AnimatedSpinner size="large" />
            <span className="ml-3">{t('tabs.floorplan.loading')}</span>
          </section>
        ) : currentFile ? (
          /* Floorplan display - handles both processed and unprocessed files */
          <figure
            className={cn(
              'w-full h-full flex-1 overflow-hidden relative',
              layoutUtilities.contentAreas.tailwind.viewerStandard,
              colors.bg.secondary,
              getStatusBorder('info')
            )}
          >
            {/* DXF Canvas - requires processedData */}
            {currentFile.processedData?.fileType === 'dxf' && (
              <>
                {/* Scene loading state (V2: fetching from Storage) */}
                {sceneLoading && (
                  <section className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
                    <AnimatedSpinner size="large" />
                    <span className="mt-3 text-sm">{t('tabs.floorplan.loadingScene')}</span>
                  </section>
                )}
                {/* Scene error state */}
                {sceneError && (
                  <section className="absolute inset-0 flex flex-col items-center justify-center">
                    <AlertCircle className={cn(iconSizes.xl, 'text-destructive mb-2')} />
                    <span className="text-sm text-destructive">{sceneError}</span>
                  </section>
                )}
                {/* Canvas for DXF rendering */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={canvasUtilities.geoInteractive.canvasFullDisplay()}
                  aria-label={t('tabs.floorplan.canvasAlt')}
                />
              </>
            )}

            {/* PDF Preview - from processedData */}
            {currentFile.processedData?.fileType === 'pdf' && currentFile.processedData.pdfPreviewUrl && (
              <img
                src={currentFile.processedData.pdfPreviewUrl}
                alt={t('tabs.floorplan.pdfAlt', { fileName: currentFile.displayName })}
                className="w-full h-full object-contain"
              />
            )}

            {/* 🏢 ENTERPRISE: PDF Fallback - direct display when processing fails (CORS) */}
            {/* Uses iframe for native browser PDF rendering with full container coverage */}
            {!currentFile.processedData && currentFile.downloadUrl && currentFile.ext === 'pdf' && (
              <iframe
                src={currentFile.downloadUrl}
                title={currentFile.displayName}
                className="absolute inset-0 w-full h-full border-0"
              />
            )}

            {/* DXF without processedData - show processing message */}
            {!currentFile.processedData && currentFile.ext === 'dxf' && (
              <section className="flex flex-col items-center justify-center h-full">
                <AnimatedSpinner size="large" />
                <span className="mt-3 text-sm">{t('tabs.floorplan.processing')}</span>
              </section>
            )}
          </figure>
        ) : (
          /* Empty state */
          <section className="flex flex-col items-center justify-center h-64 text-center">
            <FileUp className={cn(iconSizes.xl, colors.text.muted, 'mb-4')} />
            <h3 className={cn('text-lg font-semibold mb-2', colors.text.muted)}>
              {t('tabs.floorplan.noFloorplan.title')}
            </h3>
            <p className={cn('mb-4', colors.text.muted)}>
              {t('tabs.floorplan.noFloorplan.description')}
            </p>
            <Button variant="outline" onClick={handleAddFloorplan}>
              <Plus className={cn(iconSizes.sm, 'mr-2')} />
              {t('tabs.floorplan.uploadFirst')}
            </Button>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectFloorplanTab;
