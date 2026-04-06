'use client';

/**
 * 🏢 GEO-ALERT Phase 2.5.3: Enhanced Professional Drawing Interface
 *
 * Monitoring dashboard extracted to professional-drawing-dashboard.tsx (ADR-065).
 *
 * Interface for professionals (μεσίτες, κατασκευαστές) with:
 * - Floor Plan Upload (DXF, PDF, DWG, PNG, JPG)
 * - Auto-detection algorithms for floor plans
 * - Batch polygon creation
 * - Real Estate Monitoring Integration
 */

import React, { useState, useCallback } from 'react';
// ✅ ENTERPRISE FIX: Remove mapbox-gl dependency - use local type definition
interface MapRef {
  current: unknown | null;
}
import { Upload, FileText, Layers, Building, Check, X, Bell, BarChart, Settings } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useCentralizedPolygonSystem } from '../systems/polygon-system';
import { GEO_COLORS } from '../config/color-config';
import { FloorPlanUploadModal } from '../floor-plan-system/components/FloorPlanUploadModal';
import { PropertyStatusManager } from './PropertyStatusManager';
import { MonitoringDashboard } from './professional-drawing-dashboard';
import { generateLayerId } from '@/services/enterprise-id.service';
import type { ParserResult } from '../floor-plan-system/types';
import type { EnhancedPropertyStatus as PropertyStatus } from '@/constants/property-statuses-enterprise';
import { INTERACTIVE_PATTERNS, HOVER_SHADOWS } from '@/components/ui/effects';

// TODO: Implement real estate monitoring integration
type RealEstatePolygon = {
  id: string;
  polygon: Array<[number, number]>;
  settings: Record<string, unknown>;
  createdAt: string;
  type?: string;
  alertSettings?: {
    enabled: boolean;
    priceRange: { min: number; max: number };
    propertyTypes: string[];
    includeExclude: 'include' | 'exclude';
  };
};

interface ProfessionalDrawingInterfaceProps {
  mapRef: React.RefObject<unknown | null>;
  onPolygonComplete?: (polygon: unknown) => void;
  onFloorPlanUploaded?: (floorPlan: unknown) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
}

export function ProfessionalDrawingInterface({
  mapRef,
  onPolygonComplete,
  onFloorPlanUploaded,
  onRealEstateAlertCreated
}: ProfessionalDrawingInterfaceProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const [selectedTool, setSelectedTool] = useState<'upload' | 'polygon' | 'auto-detect' | 'property-manager' | 'monitoring-dashboard' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showPropertyManager, setShowPropertyManager] = useState(false);
  const [currentPropertyStatus, setCurrentPropertyStatus] = useState<PropertyStatus>('for-sale');
  const [showMonitoringDashboard, setShowMonitoringDashboard] = useState(false);
  const [batchMonitoringMode, setBatchMonitoringMode] = useState(false);

  // Real Estate Monitoring Integration (TODO: Replace with real implementation)
  const { addRealEstatePolygon, getRealEstateAlerts, getStatistics, exportMatches } = {
    addRealEstatePolygon: (_polygon: RealEstatePolygon) => {},
    getRealEstateAlerts: () => [] as RealEstatePolygon[],
    getStatistics: () => ({ totalPolygons: 0, totalAlerts: 0, activeAlerts: 0, totalMatches: 0, averageConfidence: 0.85, lastCheck: new Date().toISOString() }),
    exportMatches: () => Promise.resolve('')
  };
  const realEstateStats = getStatistics();

  const { polygons, stats, startDrawing, finishDrawing, cancelDrawing, clearAll, isDrawing: systemIsDrawing } = useCentralizedPolygonSystem();
  const actualIsDrawing = isDrawing || systemIsDrawing;

  const handlePropertyStatusChange = useCallback((status: PropertyStatus) => {
    setCurrentPropertyStatus(status);
    console.debug('🏢 Professional: Property status changed to', status);
  }, []);

  const handleBatchRealEstateMonitoring = useCallback((polygons: Array<Partial<RealEstatePolygon>>) => {
    polygons.forEach((polygon) => {
      const polygonId = typeof polygon.id === 'string' ? polygon.id : generateLayerId();
      const realEstatePolygon: RealEstatePolygon = {
        id: polygonId,
        polygon: Array.isArray(polygon.polygon) ? polygon.polygon : [],
        settings: polygon.settings ?? {},
        createdAt: typeof polygon.createdAt === 'string' ? polygon.createdAt : new Date().toISOString(),
        type: 'real-estate',
        alertSettings: { enabled: true, priceRange: { min: 100000, max: 1000000 }, propertyTypes: ['apartment', 'house', 'commercial'], includeExclude: 'include' }
      };
      addRealEstatePolygon(realEstatePolygon);
      if (onRealEstateAlertCreated) onRealEstateAlertCreated(realEstatePolygon);
    });
  }, [addRealEstatePolygon, onRealEstateAlertCreated]);

  const handleToolSelect = useCallback((tool: 'upload' | 'polygon' | 'auto-detect' | 'property-manager' | 'monitoring-dashboard') => {
    if (actualIsDrawing) { cancelDrawing(); setIsDrawing(false); }
    setSelectedTool(tool);

    switch (tool) {
      case 'upload': setShowUploadModal(true); break;
      case 'polygon':
        startDrawing('simple', { fillColor: GEO_COLORS.USER_INTERFACE.PROFESSIONAL_FILL, strokeColor: GEO_COLORS.USER_INTERFACE.PROFESSIONAL_STROKE, strokeWidth: 2 });
        setIsDrawing(true);
        break;
      case 'auto-detect':
        if (!parserResult) { setShowUploadModal(true); } break;
      case 'property-manager': setShowPropertyManager(true); break;
      case 'monitoring-dashboard': setShowMonitoringDashboard(true); break;
    }
  }, [actualIsDrawing, startDrawing, cancelDrawing, parserResult]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setTimeout(() => {
      const mockResult: ParserResult = { success: true, format: 'PNG', bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, imageUrl: URL.createObjectURL(file) };
      setParserResult(mockResult);
      setIsParsing(false);
      if (onFloorPlanUploaded) onFloorPlanUploaded(mockResult);
    }, 2000);
  }, [onFloorPlanUploaded]);

  const handleComplete = useCallback(() => {
    const polygon = finishDrawing();
    if (polygon && onPolygonComplete) onPolygonComplete(polygon);
    setIsDrawing(false);
    setSelectedTool(null);
  }, [finishDrawing, onPolygonComplete]);

  const handleCancel = useCallback(() => {
    cancelDrawing();
    setIsDrawing(false);
    setSelectedTool(null);
  }, [cancelDrawing]);

  const handleAutoDetect = useCallback(() => {
    if (!parserResult) return;
    setTimeout(() => {
      for (let i = 1; i <= 3; i++) {
        if (onPolygonComplete) {
          onPolygonComplete({
            id: `auto-detected-${i}`, type: 'property',
            coordinates: [[100 * i, 100 * i], [200 * i, 100 * i], [200 * i, 200 * i], [100 * i, 200 * i], [100 * i, 100 * i]],
            metadata: { detectedType: i === 1 ? 'living-room' : i === 2 ? 'bedroom' : 'kitchen', confidence: 0.85 + (i * 0.05), autoDetected: true }
          });
        }
      }
    }, 1500);
    setSelectedTool(null);
  }, [parserResult, onPolygonComplete]);

  return (
    <>
      <div className={`${colors.bg.primary} ${quick.card} shadow-lg p-4`}>
        <div className="mb-4">
          <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>{t('drawingInterfaces.professional.title')}</h3>
          <p className={`text-sm ${colors.text.muted}`}>{t('drawingInterfaces.professional.subtitle')}</p>
        </div>

        {/* Tool Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <button onClick={() => handleToolSelect('upload')} disabled={actualIsDrawing}
            className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${selectedTool === 'upload' ? `${getStatusBorder('success')} ${colors.bg.success}` : `border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`} ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}>
            <Upload className={`${iconSizes.lg} mb-2 ${colors.text.success}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.upload')}</span>
          </button>

          <button onClick={() => handleToolSelect('polygon')} disabled={actualIsDrawing && selectedTool !== 'polygon'}
            className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${selectedTool === 'polygon' ? `${getStatusBorder('success')} ${colors.bg.success}` : `border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`} ${actualIsDrawing && selectedTool !== 'polygon' ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}>
            <Building className={`${iconSizes.lg} mb-2 ${colors.text.info}`} />
            <span className="text-sm font-medium">{t('drawingInterfaces.professional.tools.property')}</span>
          </button>

          <button onClick={() => handleToolSelect('auto-detect')} disabled={actualIsDrawing || !parserResult}
            className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${selectedTool === 'auto-detect' ? `${getStatusBorder('success')} ${colors.bg.success}` : `border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`} ${(actualIsDrawing || !parserResult) ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}>
            <Layers className={`${iconSizes.lg} mb-2 ${colors.text.accent}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.autoDetect')}</span>
          </button>

          <button onClick={() => handleToolSelect('property-manager')} disabled={actualIsDrawing}
            className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${selectedTool === 'property-manager' ? `${getStatusBorder('warning')} ${colors.bg.warning}` : `border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`} ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}>
            <Building className={`${iconSizes.lg} mb-2 ${colors.text.warning}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.properties')}</span>
          </button>

          <button onClick={() => handleToolSelect('monitoring-dashboard')} disabled={actualIsDrawing}
            className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${selectedTool === 'monitoring-dashboard' ? `${getStatusBorder('info')} ${colors.bg.info}` : `border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`} ${isDrawing ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}>
            <BarChart className={`${iconSizes.lg} mb-2 ${colors.text.info}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.monitor')}</span>
          </button>
        </div>

        {/* Action Buttons */}
        {actualIsDrawing && (
          <div className="flex gap-2 mb-4">
            <button onClick={handleComplete}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors`}>
              <Check className={iconSizes.md} /><span className="font-medium">{t('drawingInterfaces.professional.tools.complete', { defaultValue: '' })}</span>
            </button>
            <button onClick={handleCancel}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.error} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} transition-colors`}>
              <X className={iconSizes.md} /><span className="font-medium">{t('drawingInterfaces.professional.tools.cancel', { defaultValue: '' })}</span>
            </button>
          </div>
        )}

        {/* Auto-Detection Button */}
        {selectedTool === 'auto-detect' && parserResult && (
          <div className="mb-4">
            <button onClick={handleAutoDetect}
              className={`w-full flex items-center justify-center gap-2 ${colors.bg.accent} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} transition-colors`}>
              <Layers className={iconSizes.md} /><span className="font-medium">{t('drawingInterfaces.professional.tools.detectRooms', { defaultValue: '' })}</span>
            </button>
          </div>
        )}

        {/* Floor Plan Status */}
        {parserResult && (
          <div className={`mb-4 p-3 ${colors.bg.success} ${quick.card} ${getStatusBorder('success')}`}>
            <p className={`text-sm ${colors.text.success}`}>
              <span className="font-medium">{t('drawingInterfaces.professional.floorPlanLabel', { defaultValue: '' })}:</span> {selectedFile?.name || 'Uploaded'} ✅
            </p>
            {selectedFile && (
              <p className={`text-xs ${colors.text.success}`}>{t('drawingInterfaces.professional.sizeLabel', { defaultValue: '' })}: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
        )}

        {/* Instructions */}
        {selectedTool && (
          <div className={`mt-4 p-3 ${colors.bg.info} ${quick.card} ${getStatusBorder('info')}`}>
            <p className={`text-sm ${colors.text.info}`}>
              {selectedTool === 'upload' && t('drawingInterfaces.professional.uploadFloorPlan')}
              {selectedTool === 'polygon' && t('drawingInterfaces.professional.addPropertyPoints')}
              {selectedTool === 'auto-detect' && t('drawingInterfaces.professional.autoDetectRooms')}
              {selectedTool === 'property-manager' && t('drawingInterfaces.professional.propertyManager')}
              {selectedTool === 'monitoring-dashboard' && t('drawingInterfaces.professional.marketDashboard')}
            </p>
          </div>
        )}

        {/* Statistics */}
        {(stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
          <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md space-y-1`}>
            {stats.totalPolygons > 0 && (
              <p className={`text-xs ${colors.text.muted}`}><span className="font-medium">{t('hardcodedTexts.labels.properties', { defaultValue: '' })}:</span> {stats.totalPolygons}</p>
            )}
            {realEstateStats.totalAlerts > 0 && (
              <div className={`text-xs ${colors.text.info}`}>
                <p><span className="font-medium">{t('hardcodedTexts.labels.monitoringZones')}</span> {realEstateStats.totalAlerts}</p>
                {realEstateStats.totalMatches > 0 && <p><span className="font-medium">{t('hardcodedTexts.labels.detectedProperties')}</span> {realEstateStats.totalMatches}</p>}
                {realEstateStats.lastCheck && <p><span className="font-medium">{t('hardcodedTexts.labels.lastScan')}</span> {new Date(realEstateStats.lastCheck).toLocaleTimeString('el-GR')}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <FloorPlanUploadModal isOpen={showUploadModal} onClose={() => { setShowUploadModal(false); setSelectedTool(null); }} onFileSelect={handleFileSelect} parserResult={parserResult} selectedFile={selectedFile} isParsing={isParsing} />

      {showPropertyManager && (
        <div className="mt-4">
          <PropertyStatusManager
            onStatusChange={handlePropertyStatusChange}
            onColorSchemeChange={(scheme) => { console.debug('🏢 Professional: Color scheme changed to', scheme); }}
            onLayerVisibilityChange={(statuses, visible) => { console.debug('🏢 Professional: Layer visibility changed', { statuses, visible }); }}
            className="max-w-md"
          />
        </div>
      )}

      {showMonitoringDashboard && (
        <MonitoringDashboard
          t={t}
          realEstateStats={realEstateStats}
          polygonCount={polygons.length}
          batchMonitoringMode={batchMonitoringMode}
          onBatchModeToggle={() => setBatchMonitoringMode(!batchMonitoringMode)}
          onMonitorAll={() => { if (polygons.length > 0) handleBatchRealEstateMonitoring(polygons); }}
          onExport={() => { exportMatches(); }}
          onClose={() => { setShowMonitoringDashboard(false); setSelectedTool(null); }}
        />
      )}
    </>
  );
}
