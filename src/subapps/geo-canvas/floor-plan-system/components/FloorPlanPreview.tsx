'use client';

import React from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ParserResult } from '../types';
import { layoutUtilities } from '@/styles/design-tokens';

/**
 * 🖼️ FLOOR PLAN PREVIEW COMPONENT
 *
 * Displays thumbnail preview and metadata για parsed floor plan
 *
 * Features:
 * - Thumbnail image display
 * - Format-specific metadata
 * - Layer information (DXF)
 * - Image dimensions (PNG/JPG)
 * - File size and format
 */

export interface FloorPlanPreviewProps {
  /** Parser result */
  result: ParserResult;

  /** File info */
  file: File;

  /** Optional CSS class */
  className?: string;
}

export function FloorPlanPreview({ result, file, className = '' }: FloorPlanPreviewProps) {
  const { t } = useTranslationLazy('geo-canvas');
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <article className={`flex flex-col gap-4 ${className}`} aria-labelledby="floor-plan-preview-title">
      {/* Thumbnail Preview */}
      {result.thumbnail && (
        <section className={`${colors.bg.hover} ${quick.card} p-4`} aria-labelledby="thumbnail-title">
          <h3 id="thumbnail-title" className="text-sm font-semibold text-gray-700 mb-3">
            {t('floorPlan.preview.thumbnailTitle')}
          </h3>
          <figure className={`flex justify-center items-center ${colors.bg.primary} ${quick.input}`}>
            <img
              src={result.thumbnail}
              alt="Floor plan preview"
              className="max-w-full h-auto rounded"
              style={{ maxHeight: layoutUtilities.maxHeight(400) }}
            />
          </figure>
        </section>
      )}

      {/* File Information */}
      <section className={`${colors.bg.info} ${quick.card} p-4 ${getStatusBorder('info')}`} aria-labelledby="file-info-title">
        <h3 id="file-info-title" className="text-sm font-semibold text-blue-700 mb-3">
          {t('floorPlan.preview.fileInfoTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-600">{t('floorPlan.preview.fileName')}:</div>
          <div className="font-medium text-gray-900 truncate" title={file.name}>
            {file.name}
          </div>

          <div className="text-gray-600">{t('floorPlan.preview.format')}:</div>
          <div className="font-medium text-gray-900">{result.format}</div>

          <div className="text-gray-600">{t('floorPlan.preview.fileSize')}:</div>
          <div className="font-medium text-gray-900">{formatFileSize(file.size)}</div>
        </div>
      </section>

      {/* DXF-specific metadata */}
      {result.format === 'DXF' && result.geoJSON && result.bounds && (
        <section className={`${colors.bg.success} ${quick.card} p-4 ${getStatusBorder('success')}`}>
          <h3 className="text-sm font-semibold text-green-700 mb-3">
            {t('floorPlan.preview.dxfDataTitle')}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">{t('floorPlan.preview.entities')}:</div>
            <div className="font-medium text-gray-900">{result.entities || 0}</div>

            <div className="text-gray-600">{t('floorPlan.preview.layers')}:</div>
            <div className="font-medium text-gray-900">{result.layers?.length || 0}</div>

            <div className="text-gray-600">{t('floorPlan.preview.features')}:</div>
            <div className="font-medium text-gray-900">{result.geoJSON.features.length}</div>

            <div className="text-gray-600">{t('floorPlan.preview.dimensions')}:</div>
            <div className="font-medium text-gray-900">
              {(result.bounds.maxX - result.bounds.minX).toFixed(2)} × {(result.bounds.maxY - result.bounds.minY).toFixed(2)}
            </div>
          </div>

          {/* Layer list */}
          {result.layers && result.layers.length > 0 && (
            <div className={`mt-3 pt-3 ${getDirectionalBorder('muted', 'top')}`}>
              <div className="text-xs font-semibold text-green-700 mb-2">
                {t('floorPlan.preview.layerList')}:
              </div>
              <div className="flex flex-wrap gap-1">
                {result.layers.slice(0, 10).map((layer, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 ${colors.bg.success} text-green-800 text-xs ${quick.input}`}
                  >
                    {layer}
                  </span>
                ))}
                {result.layers.length > 10 && (
                  <span className="px-2 py-1 text-green-600 text-xs">
                    +{result.layers.length - 10} {t('floorPlan.preview.moreLayers')}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Image-specific metadata */}
      {(result.format === 'PNG' || result.format === 'JPG' || result.format === 'TIFF') &&
       'metadata' in result && result.metadata && (
        <section className={`${colors.bg.accent} ${quick.card} p-4 ${getStatusBorder('info')}`}>
          <h3 className="text-sm font-semibold text-purple-700 mb-3">
            {t('floorPlan.preview.imageDataTitle')}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">{t('floorPlan.preview.dimensions')}:</div>
            <div className="font-medium text-gray-900">
              {result.metadata.width} × {result.metadata.height} px
            </div>

            <div className="text-gray-600">{t('floorPlan.preview.aspectRatio')}:</div>
            <div className="font-medium text-gray-900">
              {result.metadata.aspectRatio.toFixed(2)}
            </div>

            <div className="text-gray-600">{t('floorPlan.preview.transparency')}:</div>
            <div className="font-medium text-gray-900">
              {result.metadata.hasAlpha
                ? t('floorPlan.preview.supported')
                : t('floorPlan.preview.notSupported')}
            </div>
          </div>
        </section>
      )}

      {/* Next steps hint */}
      <section className={`${colors.bg.warning} ${quick.card} p-4 ${getStatusBorder('warning')}`}>
        <div className="flex items-start gap-2">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-700 mb-1">
              {t('floorPlan.preview.nextStepsTitle')}
            </h3>
            <p className="text-xs text-yellow-800">
              {t('floorPlan.preview.nextStepsDescription')}
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
