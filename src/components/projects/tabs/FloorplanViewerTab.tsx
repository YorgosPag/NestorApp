'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, Plus, Edit } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { canvasUtilities } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: Import FloorplanData type for proper typing
import type { FloorplanData, DxfSceneData, FloorplanFileType } from '@/services/floorplans/FloorplanService';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🏢 ENTERPRISE: Determine file type with backward compatibility
  const fileType: FloorplanFileType = floorplanData?.fileType || 'dxf';
  const isDxf = fileType === 'dxf';
  const isPdf = fileType === 'pdf';

  // 🏢 ENTERPRISE DEBUG: Log what data we're receiving
  console.log('🖼️ [FloorplanViewerTab] Render:', {
    hasFloorplanData: !!floorplanData,
    fileType,
    isDxf,
    isPdf,
    hasPdfImageUrl: !!floorplanData?.pdfImageUrl,
    pdfImageUrlLength: floorplanData?.pdfImageUrl?.length || 0,
    fileName: floorplanData?.fileName
  });

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
    ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';  // Using semantic colors via design system
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds and scale - align TOP-LEFT with canvas TOP-LEFT (different from main canvas)
    const bounds = scene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    const drawingWidth = bounds.max.x - bounds.min.x;
    const drawingHeight = bounds.max.y - bounds.min.y;

    // Calculate scale to fill entire canvas completely
    const availableWidth = canvas.width;
    const availableHeight = canvas.height;
    const scaleX = availableWidth / drawingWidth;
    const scaleY = availableHeight / drawingHeight;

    // Use the LARGER scale to fill the entire canvas (may crop some content)
    // Or use smaller scale to fit entirely - let's try fitting first
    const scale = Math.min(scaleX, scaleY);

    // Position TOP-LEFT corner of drawing at TOP-LEFT corner of canvas (0,0)
    const offsetX = 0;
    const offsetY = 0;

    // Use original layer colors from DXF (same as main canvas)
    const getLayerColor = (layerName: string): string => {
      return scene.layers?.[layerName]?.color || '#e2e8f0'; // ✅ ENTERPRISE: Light gray fallback
    };

    ctx.lineWidth = 1;

    // Render all entity types with TOP-LEFT alignment using original layer colors
    scene.entities.forEach((entity) => {
      // Skip invisible layers
      if (scene.layers?.[entity.layer]?.visible === false) {
        return;
      }

      // Get the actual layer color (same logic as main canvas)
      const layerColor = getLayerColor(entity.layer);
      ctx.strokeStyle = layerColor;

      // 🏢 ENTERPRISE: Type-safe property access for entity rendering
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

            if (closed) {
              ctx.closePath();
            }
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
  }, [floorplanData, isDxf]);

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Map className={iconSizes.md} />
            {title}
          </CardTitle>
          <div className="flex gap-2">
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
      
      <CardContent className="p-2 flex-1 min-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <AnimatedSpinner size="large" />
            <span className="ml-3">{t('tabs.floorplan.loading')}</span>
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
            <Map className={`${iconSizes.xl} ${colors.text.muted} mb-4`} />
            <h3 className={`text-lg font-semibold ${colors.text.muted} mb-2`}>{t('tabs.floorplan.noFloorplan.title')}</h3>
            <p className={`${colors.text.muted} mb-4`}>{t('tabs.floorplan.noFloorplan.description')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}