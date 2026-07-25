/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, Plus, Edit } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { canvasUtilities } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: Import FloorplanData type for proper typing
import type { FloorplanData, DxfSceneData, FloorplanFileType } from '@/services/floorplans/FloorplanService';
import { cn } from '@/lib/utils';
import { paintSceneEntityGeometry } from '@/lib/dxf-scene/canvas-scene-painter';
import {
  computeFitTransform,
  projectX,
  projectY,
  type FitTransform,
} from '@/lib/dxf-scene/scene-fit-transform';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized typography tokens
import { useTypography } from '@/hooks/useTypography';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('FloorplanViewerTab');

interface FloorplanViewerTabProps {
  title: string;
  /** 🏢 ENTERPRISE: Full floorplan data including fileType */
  floorplanData?: FloorplanData | null;
  onAddFloorplan?: () => void;
  onEditFloorplan?: () => void;
}

export function FloorplanViewerTab({
  title,
  floorplanData,
  onAddFloorplan,
  onEditFloorplan
}: FloorplanViewerTabProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  // 🏢 ENTERPRISE: Centralized typography tokens
  const typography = useTypography();

  // 🏢 ENTERPRISE: Translate title if it's an i18n key
  const translatedTitle = title.includes('.')
    ? t(title)
    : title;

  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, _setIsLoading] = useState(false);

  // 🏢 ENTERPRISE: Determine file type with backward compatibility
  const fileType: FloorplanFileType = floorplanData?.fileType || 'dxf';
  const isDxf = fileType === 'dxf';
  const isPdf = fileType === 'pdf';

  // 🏢 ENTERPRISE DEBUG: Log what data we're receiving
  logger.info('[FloorplanViewerTab] Render:', { data: {
    hasFloorplanData: !!floorplanData,
    fileType,
    isDxf,
    isPdf,
    hasPdfImageUrl: !!floorplanData?.pdfImageUrl,
    pdfImageUrlLength: floorplanData?.pdfImageUrl?.length || 0,
    fileName: floorplanData?.fileName
  } });

  // 🏢 ENTERPRISE: Render DXF data to canvas (simplified - without grid/rulers)
  useEffect(() => {
    // Only render DXF files to canvas
    if (!floorplanData || !canvasRef.current || !isDxf || !floorplanData.scene) return;

    // 🏢 ENTERPRISE: Cast scene to DxfSceneData for proper typing
    const scene = floorplanData.scene as DxfSceneData;
    if (!scene.entities || scene.entities.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container size exactly
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Detect dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Clear canvas with appropriate background using semantic colors
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // eslint-disable-next-line design-system/no-hardcoded-colors -- Canvas 2D API requires literal color strings
    ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds and scale - align TOP-LEFT with canvas TOP-LEFT (different from main canvas)
    const bounds = scene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };

    // Aspect-fit scale comes from the SSoT so this tab can never drift from the
    // gallery/thumbnail. Only the ALIGNMENT differs: this surface deliberately pins
    // the drawing's top-left to the canvas origin instead of centering it, so the
    // centering offsets are dropped rather than re-derived.
    const fit: FitTransform = {
      scale: computeFitTransform(canvas.width, canvas.height, bounds).scale,
      offsetX: 0,
      offsetY: 0,
    };
    const { scale } = fit;

    // Use original layer colors from DXF (same as main canvas)
    const getLayerColor = (layerName: string): string => {
      // eslint-disable-next-line design-system/no-hardcoded-colors -- Canvas 2D API requires literal color strings
      return scene.layers?.[layerName]?.color || '#e2e8f0';
    };

    ctx.lineWidth = 1;

    // Render all entity types with TOP-LEFT alignment using original layer colors.
    // Primitive geometry goes through the `canvas-scene-painter` SSoT; only text stays
    // local, because this surface keeps its own 8px font floor.
    scene.entities.forEach((entity) => {
      // Skip invisible layers
      if (scene.layers?.[entity.layer]?.visible === false) {
        return;
      }

      // Get the actual layer color (same logic as main canvas)
      const layerColor = getLayerColor(entity.layer);
      ctx.strokeStyle = layerColor;

      if (paintSceneEntityGeometry(ctx, entity, bounds, fit)) return;

      if (entity.type !== 'text') return;

      // 🏢 ENTERPRISE: Type-safe property access for entity rendering
      const e = entity as Record<string, unknown>;
      const position = e.position as { x: number; y: number } | undefined;
      const text = e.text as string | undefined;
      const height = e.height as number | undefined;
      if (position && text) {
        ctx.fillStyle = layerColor;
        ctx.font = `${Math.max(8, (height || 10) * scale)}px Arial`;
        ctx.fillText(text, projectX(position.x, bounds, fit), projectY(position.y, bounds, fit));
      }
    });
  }, [floorplanData, isDxf]);

  return (
    <Card className="w-full h-full">
      <CardHeader className={spacing.padding.bottom.sm}>
        <div className="flex justify-between items-center">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <Map className={iconSizes.md} />
            {translatedTitle}
          </CardTitle>
          <div className={cn("flex", spacing.gap.sm)}>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddFloorplan}
              className="flex items-center gap-1"
            >
              <Plus className={iconSizes.sm} />
              {t('tabs.floorplan.addFloorplan')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEditFloorplan}
              disabled={!floorplanData}
              className="flex items-center gap-1"
            >
              <Edit className={iconSizes.sm} />
              {t('tabs.floorplan.editFloorplan')}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={cn(spacing.padding.sm, "flex-1 min-h-[500px]")}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <AnimatedSpinner size="large" />
            <span className="ml-2">{t('tabs.floorplan.loading')}</span>
          </div>
        ) : floorplanData ? (
          <div className={`w-full h-full ${colors.bg.secondary} ${getStatusBorder('info')} overflow-hidden relative min-h-[450px]`}>
            {/* 🏢 ENTERPRISE: Conditional rendering based on file type */}
            {isDxf && (
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={canvasUtilities.geoInteractive.canvasFullDisplay()}
              />
            )}
            {isPdf && floorplanData.pdfImageUrl && (
              <img
                src={floorplanData.pdfImageUrl}
                alt={t('tabs.floorplan.pdfAlt', { fileName: floorplanData.fileName })}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Map className={cn(iconSizes.xl, colors.text.muted, spacing.margin.bottom.md)} />
            <h3 className={cn(typography.heading.md, colors.text.muted, spacing.margin.bottom.sm)}>{t('tabs.floorplan.noFloorplan.title')}</h3>
            <p className={cn(colors.text.muted, spacing.margin.bottom.md)}>{t('tabs.floorplan.noFloorplan.description')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
