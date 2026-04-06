/**
 * CONTROL POINTS LIST - Status, Quality & Points Display
 *
 * Sub-component of FloorPlanControlPointPicker
 * Shows points status, transformation quality, list of points, and empty state
 *
 * @module floor-plan-system/components/ControlPointsList
 * Extracted from FloorPlanControlPointPicker.tsx (ADR-065 Phase 3, #13)
 */

import React from 'react';
import { CheckCircle, AlertTriangle, MapPin } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { draggablePanelProgressBar } from '../../components/InteractiveMap.styles';
import type { FloorPlanControlPoint } from '../types/control-points';

// ===================================================================
// TYPES
// ===================================================================

interface TransformationData {
  isValid: boolean;
  quality: string | null;
  rmsError: number | null;
  result: {
    maxError?: number;
    meanError?: number;
  } | null;
}

interface EditingState {
  editingId: string | null;
  editLabel: string;
  onStartEdit: (point: FloorPlanControlPoint) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSetEditLabel: (label: string) => void;
}

// ===================================================================
// POINTS STATUS
// ===================================================================

interface PointsStatusProps {
  pointsCount: number;
  hasMinPoints: boolean;
}

export const PointsStatus: React.FC<PointsStatusProps> = ({ pointsCount, hasMinPoints }) => {
  const { t } = useTranslationLazy('geo-canvas');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {t('floorPlanControlPoints.status.points')} {pointsCount}
        </span>
        {hasMinPoints ? (
          <span className={`text-sm ${colors.text.success} font-medium`}>
            <CheckCircle className={`${iconSizes.xs} inline-block mr-1.5`} />
            {t('floorPlanControlPoints.status.readyForGeoreferencing')}
          </span>
        ) : (
          <span className={`text-sm ${colors.text.warning} font-medium`}>
            <AlertTriangle className={`${iconSizes.xs} inline-block mr-1.5`} />
            {t('floorPlanControlPoints.status.needMorePoints', {
              count: 3 - pointsCount,
              plural: 3 - pointsCount !== 1 ? 's' : ''
            })}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className={`mt-2 w-full ${colors.bg.hover} rounded-full h-2`}>
        <div
          className={`h-2 rounded-full transition-all ${
            hasMinPoints ? colors.bg.success : colors.bg.warning
          }`}
          style={draggablePanelProgressBar((pointsCount / 3) * 100)}
        />
      </div>
    </div>
  );
};

// ===================================================================
// TRANSFORMATION QUALITY
// ===================================================================

interface TransformationQualityProps {
  transformation: TransformationData;
}

export const TransformationQuality: React.FC<TransformationQualityProps> = ({ transformation }) => {
  const { t } = useTranslationLazy('geo-canvas');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  if (!transformation.isValid || !transformation.quality) return null;

  const qualityColorMap: Record<string, string> = {
    excellent: `${colors.bg.success} ${colors.text.success}`,
    good: `${colors.bg.info} ${colors.text.info}`,
    fair: `${colors.bg.warning} ${colors.text.warning}`,
  };

  const qualityColors = qualityColorMap[transformation.quality] ?? `${colors.bg.error} ${colors.text.error}`;

  return (
    <div className={`mb-4 p-3 ${quick.card}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{t('floorPlanControlPoints.status.transformationQuality')}</span>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${qualityColors}`}>
          {transformation.quality.toUpperCase()}
        </span>
      </div>

      <div className={`space-y-1 text-xs ${colors.text.foreground}`}>
        <div className="flex justify-between">
          <span>RMS Error:</span>
          <span className="font-mono font-semibold">{transformation.rmsError?.toFixed(2)}m</span>
        </div>
        {transformation.result?.maxError && (
          <div className="flex justify-between">
            <span>Max Error:</span>
            <span className="font-mono font-semibold">{transformation.result.maxError.toFixed(2)}m</span>
          </div>
        )}
        {transformation.result?.meanError && (
          <div className="flex justify-between">
            <span>Mean Error:</span>
            <span className="font-mono font-semibold">{transformation.result.meanError.toFixed(2)}m</span>
          </div>
        )}
      </div>

      {transformation.quality === 'poor' && (
        <div className={`mt-2 text-xs ${colors.text.error}`}>
          {t('floorPlanControlPoints.status.lowAccuracyWarning')}
        </div>
      )}
    </div>
  );
};

// ===================================================================
// CONTROL POINTS LIST
// ===================================================================

interface ControlPointsListProps {
  points: FloorPlanControlPoint[];
  hasMinPoints: boolean;
  transformation: TransformationData;
  editing: EditingState;
  onDelete: (id: string) => void;
}

export const ControlPointsList: React.FC<ControlPointsListProps> = ({
  points,
  hasMinPoints,
  transformation,
  editing,
  onDelete
}) => {
  const { t } = useTranslationLazy('geo-canvas');
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <>
      <PointsStatus pointsCount={points.length} hasMinPoints={hasMinPoints} />
      <TransformationQuality transformation={transformation} />

      {/* Control Points List */}
      {points.length > 0 && (
        <div className={`${quick.table} max-h-80 overflow-y-auto`}>
          <div className={`${colors.bg.hover} px-3 py-2 ${quick.separatorH} font-semibold text-sm`}>
            {t('floorPlanControlPoints.list.title')}
          </div>

          {points.map((point, index) => (
            <div
              key={point.id}
              className={`px-3 py-2 ${quick.separatorH} last:border-b-0 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
            >
              {/* Point Header */}
              <div className="flex items-center justify-between mb-2">
                {editing.editingId === point.id ? (
                  <input
                    type="text"
                    value={editing.editLabel}
                    onChange={(e) => editing.onSetEditLabel(e.target.value)}
                    className={`flex-1 px-2 py-1 ${quick.input} ${getStatusBorder('info')} text-sm`}
                    placeholder="Enter label..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') editing.onSaveEdit(point.id);
                      if (e.key === 'Escape') editing.onCancelEdit();
                    }}
                  />
                ) : (
                  <span className="font-medium text-sm">
                    {point.label || `Point ${index + 1}`}
                  </span>
                )}

                <div className="flex gap-1">
                  {editing.editingId === point.id ? (
                    <>
                      <button
                        onClick={() => editing.onSaveEdit(point.id)}
                        className={`px-2 py-1 text-xs ${colors.bg.success} text-white rounded ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`}
                      >
                        &#10003;
                      </button>
                      <button
                        onClick={editing.onCancelEdit}
                        className={`px-2 py-1 text-xs ${colors.bg.hover} text-white rounded ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                      >
                        &#10007;
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => editing.onStartEdit(point)}
                        className={`px-2 py-1 text-xs ${colors.bg.info} text-white rounded ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
                      >
                        &#9998;
                      </button>
                      <button
                        onClick={() => onDelete(point.id)}
                        className={`px-2 py-1 text-xs ${colors.bg.error} text-white rounded ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                      >
                        &#128465;
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Point Coordinates */}
              <div className={`text-xs ${colors.text.muted} space-y-1`}>
                <div>
                  <span className="font-medium">Floor Plan:</span>{' '}
                  ({point.floorPlan.x.toFixed(2)}, {point.floorPlan.y.toFixed(2)})
                </div>
                <div>
                  <span className="font-medium">Map:</span>{' '}
                  ({point.geo.lng.toFixed(6)}, {point.geo.lat.toFixed(6)})
                </div>
                <div className={colors.text.tertiary}>
                  {new Date(point.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {points.length === 0 && (
        <div className={`text-center py-8 ${colors.text.tertiary}`}>
          <div className="mb-2">
            <MapPin className="text-4xl block mx-auto" />
          </div>
          <p className="text-sm">{t('floorPlanControlPoints.list.noPoints')}</p>
          <p className="text-xs mt-1">{t('floorPlanControlPoints.instructions.idle')}</p>
        </div>
      )}
    </>
  );
};
