/**
 * FLOOR PLAN CONTROL POINT PICKER COMPONENT
 *
 * UI component για control point placement workflow
 *
 * @module floor-plan-system/components/FloorPlanControlPointPicker
 *
 * Features:
 * - Visual state indication (idle/picking-floor/picking-geo)
 * - Start/Cancel picking buttons
 * - Dynamic instructions based on state
 * - Control points list με edit/delete
 * - Minimum points validation (3+ required)
 * - Visual markers για picked points
 *
 * Split (ADR-065 Phase 3, #13):
 * - ManualInputTab.tsx — Manual coordinate input form
 * - ControlPointsList.tsx — Points list, status, transformation quality
 */

import { safeJsonParse } from '@/lib/json-utils';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useGeoTransformation } from '../hooks/useGeoTransformation';
import type { FloorPlanControlPoint, FloorPlanCoordinate, GeoCoordinate } from '../types/control-points';
import type { UseFloorPlanControlPointsReturn } from '../hooks/useFloorPlanControlPoints';
import { useNotifications } from '@/providers/NotificationProvider';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import {
  draggablePanelContainer,
  draggablePanelHandle,
  draggablePanelTabNavigation,
  draggablePanelTabButton,
} from '../../components/InteractiveMap.styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CheckCircle, Info, MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { ManualInputTab, MANUAL_INPUT_INITIAL } from './ManualInputTab';
import type { ManualInputState } from './ManualInputTab';
import { ControlPointsList } from './ControlPointsList';

/**
 * Component props
 */
export interface FloorPlanControlPointPickerProps {
  controlPoints: UseFloorPlanControlPointsReturn;
  className?: string;
}

/**
 * FloorPlanControlPointPicker Component
 *
 * Manages control point placement UI
 */
export const FloorPlanControlPointPicker: React.FC<FloorPlanControlPointPickerProps> = ({
  controlPoints: controlPointsInstance,
  className = ''
}) => {
  // ===================================================================
  // HOOKS
  // ===================================================================

  const { t } = useTranslationLazy('geo-canvas');
  const { confirm, dialogProps } = useConfirmDialog();
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { success, error } = useNotifications();

  const {
    points,
    pickingState,
    tempFloorPlan,
    hasMinPoints,
    startPicking,
    cancelPicking,
    deletePoint,
    clearAll,
    updateLabel
  } = controlPointsInstance;

  const transformation = useGeoTransformation(points, { debug: true });

  console.debug('🔍 Transformation state:', {
    pointsCount: points.length,
    isValid: transformation.isValid,
    quality: transformation.quality,
    rmsError: transformation.rmsError,
    matrix: transformation.matrix
  });

  // ===================================================================
  // LOCAL STATE
  // ===================================================================

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'manual'>('visual');
  const [manualInput, setManualInput] = useState<ManualInputState>(MANUAL_INPUT_INITIAL);
  const [showSaveLoad] = useState(false);

  // ===================================================================
  // EFFECTS
  // ===================================================================

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // ===================================================================
  // HANDLERS
  // ===================================================================

  const handleStartPicking = () => {
    console.debug('🎯 User clicked "Add Control Point"');
    startPicking();
  };

  const handleCancelPicking = () => {
    console.debug('❌ User cancelled picking');
    cancelPicking();
  };

  const handleDelete = (id: string) => {
    console.debug('🗑️ Deleting control point:', id);
    deletePoint(id);
  };

  const handleClearAll = async () => {
    const confirmed = await confirm({
      title: t('floorPlanControlPoints.confirm.clearAll'),
      description: t('floorPlanControlPoints.confirm.clearAll'),
      variant: 'warning',
    });
    if (confirmed) {
      console.debug('🗑️ Clearing all control points');
      clearAll();
    }
  };

  const handleStartEdit = (point: FloorPlanControlPoint) => {
    setEditingId(point.id);
    setEditLabel(point.label || '');
  };

  const handleSaveEdit = (id: string) => {
    if (editLabel.trim()) {
      updateLabel(id, editLabel.trim());
    }
    setEditingId(null);
    setEditLabel('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
  };

  const handleAddManualPoint = () => {
    try {
      const dxfPoint: FloorPlanCoordinate = {
        x: parseFloat(manualInput.dxfX),
        y: parseFloat(manualInput.dxfY)
      };

      const geoPoint: GeoCoordinate = {
        lng: parseFloat(manualInput.geoLng),
        lat: parseFloat(manualInput.geoLat)
      };

      if (isNaN(dxfPoint.x) || isNaN(dxfPoint.y) || isNaN(geoPoint.lng) || isNaN(geoPoint.lat)) {
        error(t('toastMessages.invalidCoordinates'));
        return;
      }

      const newPoint: FloorPlanControlPoint = {
        id: `manual-${Date.now()}`,
        floorPlan: dxfPoint,
        geo: geoPoint,
        accuracy: parseFloat(manualInput.accuracy) || 1.0,
        label: manualInput.description || undefined,
        createdAt: Date.now()
      };

      console.debug('🔧 Manual point to add:', newPoint);
      success(t('toastMessages.pointAddedManually'));
      setManualInput(MANUAL_INPUT_INITIAL);
    } catch (err) {
      console.error('Error adding manual point:', err);
      error(t('toastMessages.errorAddingPoint'));
    }
  };

  const handleCalibrate = () => {
    if (!transformation.isValid) {
      error(t('toastMessages.needMinimumPoints'));
      return;
    }
    success(t('toastMessages.calibrationComplete', { quality: transformation.quality?.toUpperCase() }));
    console.debug('🎯 Calibration completed:', transformation);
  };

  const handleSavePoints = () => {
    if (points.length === 0) {
      error(t('toastMessages.noPointsToSave'));
      return;
    }

    const dataStr = JSON.stringify({
      points,
      transformation: transformation.result,
      exportedAt: new Date().toISOString()
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    triggerExportDownload({
      blob: dataBlob,
      filename: `control-points-${new Date().toISOString().split('T')[0]}.json`,
    });
    success(t('toastMessages.pointsSaved'));
  };

  const handleLoadPoints = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = safeJsonParse<{ points?: unknown[] }>(e.target?.result as string, null as unknown as { points?: unknown[] });
      if (data === null) {
        error(t('toastMessages.errorLoadingFile'));
        return;
      }
      if (data.points && Array.isArray(data.points)) {
        console.debug('📁 Loading points:', data.points);
        success(t('toastMessages.pointsLoaded', { count: data.points.length }));
      } else {
        error(t('toastMessages.invalidPointsFile'));
      }
    };
    reader.readAsText(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };

  // ===================================================================
  // RENDER HELPERS
  // ===================================================================

  const getStateBadgeColor = (): string => {
    switch (pickingState) {
      case 'idle':
        return `${colors.bg.hover} ${colors.text.muted}`;
      case 'picking-floor':
        return `${colors.bg.info} ${colors.text.info}`;
      case 'picking-geo':
        return `${colors.bg.success} ${colors.text.success}`;
      default:
        return `${colors.bg.hover} ${colors.text.muted}`;
    }
  };

  const getStateLabel = (): string => {
    switch (pickingState) {
      case 'idle':
        return t('floorPlanControlPoints.state.idle');
      case 'picking-floor':
        return t('floorPlanControlPoints.state.pickingFloorPlan');
      case 'picking-geo':
        return t('floorPlanControlPoints.state.pickingGeo');
      default:
        return t('floorPlanControlPoints.state.idle');
    }
  };

  const getInstructions = (): string => {
    switch (pickingState) {
      case 'idle':
        return t('floorPlanControlPoints.instructions.idle');
      case 'picking-floor':
        return t('floorPlanControlPoints.instructions.pickFloorPlan');
      case 'picking-geo':
        return t('floorPlanControlPoints.instructions.pickGeo');
      default:
        return '';
    }
  };

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div
      ref={panelRef}
      className={`floor-plan-control-point-picker ${className}`}
      style={draggablePanelContainer(position, isDragging)}
    >
      <ConfirmDialog {...dialogProps} />

      {/* DRAG HANDLE */}
      <div onMouseDown={handleMouseDown} style={draggablePanelHandle(isDragging)}>
        <span><MapPin className={`${iconSizes.sm} inline-block mr-1.5`} />{t('floorPlanControlPoints.title')}</span>
        <span style={layoutUtilities.cssVars.helpText.small}>{t('floorPlanControlPoints.dragHandle')}</span>
      </div>

      {/* TAB NAVIGATION */}
      <div style={draggablePanelTabNavigation()}>
        <button onClick={() => setActiveTab('visual')} style={draggablePanelTabButton(activeTab === 'visual')}>
          {t('floorPlanControlPoints.tabs.visualPicking')}
        </button>
        <button onClick={() => setActiveTab('manual')} style={draggablePanelTabButton(activeTab === 'manual')}>
          {t('floorPlanControlPoints.tabs.manualInput')}
        </button>
      </div>

      {/* CONTENT */}
      <div style={layoutUtilities.cssVars.contentContainer}>
        {/* VISUAL TAB */}
        {activeTab === 'visual' && (
          <>
            <div className="mb-4">
              <p className={`text-sm ${colors.text.muted}`}>{t('floorPlanControlPoints.description')}</p>
            </div>

            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStateBadgeColor()}`}>
                {getStateLabel()}
              </span>
            </div>

            <div className={`mb-4 p-3 ${colors.bg.info} ${quick.card} ${getStatusBorder('info')}`}>
              <p className={`text-sm ${colors.text.info}`}>
                <Info className={`${iconSizes.xs} inline-block mr-1.5`} />
                {getInstructions()}
              </p>
              {tempFloorPlan && (
                <p className={`text-xs ${colors.text.info} mt-2`}>
                  <CheckCircle className={`${iconSizes.xs} inline-block mr-1.5`} />
                  Floor plan point selected: ({tempFloorPlan.x.toFixed(2)}, {tempFloorPlan.y.toFixed(2)})
                </p>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              {pickingState === 'idle' ? (
                <button
                  onClick={handleStartPicking}
                  className={`px-4 py-2 ${colors.bg.info} text-white rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} transition-colors`}
                >
                  {t('floorPlanControlPoints.buttons.addControlPoint')}
                </button>
              ) : (
                <button
                  onClick={handleCancelPicking}
                  className={`px-4 py-2 ${colors.bg.error} text-white rounded ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} transition-colors`}
                >
                  {t('floorPlanControlPoints.buttons.cancel')}
                </button>
              )}
              {points.length > 0 && pickingState === 'idle' && (
                <button
                  onClick={handleClearAll}
                  className={`px-4 py-2 ${colors.bg.hover} ${colors.text.muted} rounded ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}
                >
                  {t('floorPlanControlPoints.buttons.clearAll')}
                </button>
              )}
            </div>
          </>
        )}

        {/* MANUAL TAB */}
        {activeTab === 'manual' && (
          <ManualInputTab
            manualInput={manualInput}
            onInputChange={setManualInput}
            onAddManualPoint={handleAddManualPoint}
          />
        )}

        {/* MANAGEMENT BUTTONS */}
        <div className={`mb-4 ${getDirectionalBorder('muted', 'top')} pt-4`}>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={handleCalibrate}
              disabled={!transformation.isValid}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                transformation.isValid
                  ? `${colors.bg.success} text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`
                  : `${colors.bg.hover} ${colors.text.muted} cursor-not-allowed`
              }`}
            >
              {t('floorPlanControlPoints.actions.calibrate')}
            </button>

            <button
              onClick={handleSavePoints}
              disabled={points.length === 0}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                points.length > 0
                  ? `${colors.bg.info} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                  : `${colors.bg.hover} ${colors.text.muted} cursor-not-allowed`
              }`}
            >
              {t('floorPlanControlPoints.actions.save')}
            </button>

            <FileUploadButton
              onFileSelect={handleLoadPoints}
              accept=".json,application/json"
              fileType="any"
              buttonText={t('floorPlanControlPoints.actions.load')}
              variant="default"
              size="sm"
              showIcon={false}
              className={`${colors.bg.info} text-white ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            />

            {points.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`px-3 py-2 ${colors.bg.error} text-white rounded text-sm font-medium ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} transition-colors`}
              >
                {t('floorPlanControlPoints.buttons.clearAll')}
              </button>
            )}
          </div>
        </div>

        {/* POINTS LIST + STATUS + QUALITY */}
        <ControlPointsList
          points={points}
          hasMinPoints={hasMinPoints}
          transformation={transformation}
          editing={{
            editingId,
            editLabel,
            onStartEdit: handleStartEdit,
            onSaveEdit: handleSaveEdit,
            onCancelEdit: handleCancelEdit,
            onSetEditLabel: setEditLabel
          }}
          onDelete={handleDelete}
        />

        {/* Debug Info (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className={`mt-4 p-2 ${colors.bg.hover} rounded text-xs`}>
            <div className="font-mono">
              <div>State: {pickingState}</div>
              <div>Points: {points.length}</div>
              <div>Has Min: {hasMinPoints ? 'Yes' : 'No'}</div>
              {tempFloorPlan && (
                <div>Temp Floor: ({tempFloorPlan.x}, {tempFloorPlan.y})</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloorPlanControlPointPicker;
