'use client';

import React, { useState, useCallback } from 'react';
import type * as mapboxgl from 'mapbox-gl';
import { Upload, FileImage, FileText, Layers, Building, Check, X, Bell, BarChart, Settings } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useCentralizedPolygonSystem } from '../systems/polygon-system';
import { GEO_COLORS } from '../config/color-config';
import { FloorPlanUploadModal } from '../floor-plan-system/components/FloorPlanUploadModal';
import { PropertyStatusManager } from './PropertyStatusManager';
// TODO: Implement real estate monitoring integration
// import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';
// import type { RealEstatePolygon } from '@geo-alert/core';
type RealEstatePolygon = {
  id: string;
  polygon: Array<[number, number]>;
  settings: Record<string, unknown>;
  createdAt: string;
};
import type { ParserResult } from '../floor-plan-system/types';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';

interface ProfessionalDrawingInterfaceProps {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  onPolygonComplete?: (polygon: any) => void;
  onFloorPlanUploaded?: (floorPlan: any) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
}

/**
 * 🏢 GEO-ALERT Phase 2.5.3: Enhanced Professional Drawing Interface
 *
 * Interface για επαγγελματίες (μεσίτες, κατασκευαστές) με:
 * - Floor Plan Upload (DXF, PDF, DWG, PNG, JPG)
 * - Auto-detection algorithms για κατόψεις
 * - Batch polygon creation
 * - Integration με existing floor-plan-system
 * - 🏠 Real Estate Monitoring Integration (Phase 2.5.3)
 *
 * Professional features:
 * - Upload κατόψεων (image/PDF)
 * - Auto-detection of rooms/properties
 * - Batch polygon creation
 * - Advanced georeferencing
 * - Real Estate Alert Management
 * - Market Monitoring Dashboard
 */
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
  // ✅ ENTERPRISE: Combine local and centralized drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const actualIsDrawing = isDrawing || systemIsDrawing;
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // 🏠 Phase 2.5: Property Status Management
  const [showPropertyManager, setShowPropertyManager] = useState(false);
  const [currentPropertyStatus, setCurrentPropertyStatus] = useState<PropertyStatus>('for-sale');

  // 🏠 Phase 2.5.3: Real Estate Monitoring Integration
  const [showMonitoringDashboard, setShowMonitoringDashboard] = useState(false);
  const [batchMonitoringMode, setBatchMonitoringMode] = useState(false);

  // Real Estate Monitoring Integration (TODO: Replace with real implementation)
  const {
    addRealEstatePolygon,
    getRealEstateAlerts,
    getStatistics,
    exportMatches
  } = {
    addRealEstatePolygon: (_polygon: RealEstatePolygon) => {},
    getRealEstateAlerts: () => [] as RealEstatePolygon[],
    getStatistics: () => ({ totalPolygons: 0, totalAlerts: 0, activeAlerts: 0 }),
    exportMatches: () => Promise.resolve('')
  };

  // ✅ ENTERPRISE FIX: Get statistics as object, not function
  const realEstateStats = getStatistics();

  // ✅ ENTERPRISE: Use centralized polygon system with Professional role
  const {
    polygons,
    stats,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    clearAll,
    isDrawing: systemIsDrawing,
    currentRole
  } = useCentralizedPolygonSystem();

  // 🏠 Phase 2.5: Property Status Management Handlers
  const handlePropertyStatusChange = useCallback((status: PropertyStatus) => {
    setCurrentPropertyStatus(status);
    console.log('🏢 Professional: Property status changed to', status);
    // TODO: Update active polygon/property status
  }, []);

  const handlePropertyManagerToggle = useCallback(() => {
    setShowPropertyManager(!showPropertyManager);
    setSelectedTool(showPropertyManager ? null : 'property-manager');
  }, [showPropertyManager]);

  // Professional batch real estate monitoring handler
  const handleBatchRealEstateMonitoring = useCallback((polygons: any[]) => {
    console.log('🏢 Professional: Setting up batch real estate monitoring for', polygons.length, 'polygons');

    polygons.forEach((polygon, index) => {
      const realEstatePolygon: RealEstatePolygon = {
        ...polygon,
        type: 'real-estate',
        alertSettings: {
          enabled: true,
          priceRange: { min: 100000, max: 1000000 }, // Professional range
          propertyTypes: ['apartment', 'house', 'commercial'],
          includeExclude: 'include'
        }
      };

      addRealEstatePolygon(realEstatePolygon);

      if (onRealEstateAlertCreated) {
        onRealEstateAlertCreated(realEstatePolygon);
      }
    });

    console.log('✅ Professional: Batch monitoring setup completed');
  }, [addRealEstatePolygon, onRealEstateAlertCreated]);

  // Tool selection handler
  const handleToolSelect = useCallback((tool: 'upload' | 'polygon' | 'auto-detect' | 'property-manager' | 'monitoring-dashboard') => {
    if (actualIsDrawing) {
      // Cancel current drawing
      cancelDrawing();
      setIsDrawing(false);
    }

    setSelectedTool(tool);

    // Start appropriate tool mode
    switch (tool) {
      case 'upload':
        // Open floor plan upload modal
        setShowUploadModal(true);
        console.log('🏢 Professional: Floor plan upload mode');
        break;

      case 'polygon':
        // Professional polygon mode (more precise)
        startDrawing('simple', {
          fillColor: GEO_COLORS.USER_INTERFACE.PROFESSIONAL_FILL, // Green professional fill
          strokeColor: GEO_COLORS.USER_INTERFACE.PROFESSIONAL_STROKE,
          strokeWidth: 2
        });
        setIsDrawing(true);
        console.log('🔷 Professional: Precision polygon mode started');
        break;

      case 'auto-detect':
        // Auto-detection mode (requires floor plan to be uploaded first)
        if (!parserResult) {
          console.warn('⚠️ Professional: Auto-detection requires a floor plan upload first');
          // Fallback to upload mode
          setShowUploadModal(true);
        } else {
          console.log('🤖 Professional: Auto-detection mode activated');
          // TODO: Implement auto-detection algorithm
        }
        break;

      case 'property-manager':
        // 🏠 Phase 2.5: Property Management mode
        setShowPropertyManager(true);
        console.log('🏢 Professional: Property management mode activated');
        break;

      case 'monitoring-dashboard':
        // 🏠 Phase 2.5.3: Real Estate Monitoring Dashboard
        setShowMonitoringDashboard(true);
        console.log('📊 Professional: Real estate monitoring dashboard opened');
        break;
    }
  }, [actualIsDrawing, startDrawing, cancelDrawing, parserResult]);

  // Floor plan upload handlers
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setIsParsing(true);

    // TODO: Parse the file using floor-plan-system parsers
    // For now, mock the parsing
    setTimeout(() => {
      const mockResult: ParserResult = {
        type: 'raster',
        bounds: {
          minX: 0,
          minY: 0,
          maxX: 1000,
          maxY: 1000
        },
        imageUrl: URL.createObjectURL(file),
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      };

      setParserResult(mockResult);
      setIsParsing(false);

      if (onFloorPlanUploaded) {
        onFloorPlanUploaded(mockResult);
      }

      console.log('📁 Professional: Floor plan uploaded and parsed', mockResult);
    }, 2000);
  }, [onFloorPlanUploaded]);

  const handleUploadModalClose = useCallback(() => {
    setShowUploadModal(false);
    setSelectedTool(null);
  }, []);

  // Complete drawing
  const handleComplete = useCallback(() => {
    const polygon = finishDrawing();
    if (polygon && onPolygonComplete) {
      onPolygonComplete(polygon);
      console.log('✅ Professional: Drawing completed', polygon);
    }
    setIsDrawing(false);
    setSelectedTool(null);
  }, [finishDrawing, onPolygonComplete]);

  // Cancel drawing
  const handleCancel = useCallback(() => {
    cancelDrawing();
    setIsDrawing(false);
    setSelectedTool(null);
    console.log('❌ Professional: Drawing cancelled');
  }, [cancelDrawing]);

  // Auto-detect rooms/properties
  const handleAutoDetect = useCallback(() => {
    if (!parserResult) {
      console.warn('⚠️ No floor plan available for auto-detection');
      return;
    }

    // Mock auto-detection of 3 polygons
    console.log('🤖 Professional: Running auto-detection algorithm...');

    // Simulate auto-detection delay
    setTimeout(() => {
      // Create 3 mock detected polygons
      for (let i = 1; i <= 3; i++) {
        const mockPolygon = {
          id: `auto-detected-${i}`,
          type: 'property',
          coordinates: [
            [100 * i, 100 * i],
            [200 * i, 100 * i],
            [200 * i, 200 * i],
            [100 * i, 200 * i],
            [100 * i, 100 * i]
          ],
          metadata: {
            detectedType: i === 1 ? 'living-room' : i === 2 ? 'bedroom' : 'kitchen',
            confidence: 0.85 + (i * 0.05),
            autoDetected: true
          }
        };

        if (onPolygonComplete) {
          onPolygonComplete(mockPolygon);
        }
      }

      console.log('✅ Professional: Auto-detection completed - 3 properties detected');
    }, 1500);

    setSelectedTool(null);
  }, [parserResult, onPolygonComplete]);

  return (
    <>
      <div className={`${colors.bg.primary} ${quick.card} shadow-lg p-4`}>
        {/* Header */}
        <div className="mb-4">
          <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>
            {t('drawingInterfaces.professional.title')}
          </h3>
          <p className={`text-sm ${colors.text.muted}`}>
            {t('drawingInterfaces.professional.subtitle')}
          </p>
        </div>

        {/* Tool Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {/* Floor Plan Upload */}
          <button
            onClick={() => handleToolSelect('upload')}
            disabled={actualIsDrawing}
            className={`
              flex flex-col items-center justify-center p-4 ${quick.card}
              transition-all duration-200 min-h-[100px]
              ${selectedTool === 'upload'
                ? `${getStatusBorder('success')} ${colors.bg.success}`
                : `border-border \${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`
              }
              ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.ENHANCED}'}
            `}
          >
            <Upload className={`${iconSizes.lg} mb-2 ${colors.text.success}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.upload')}</span>
            <span className={`text-xs ${colors.text.muted}`}>Κάτοψη</span>
          </button>

          {/* Precision Polygon */}
          <button
            onClick={() => handleToolSelect('polygon')}
            disabled={actualIsDrawing && selectedTool !== 'polygon'}
            className={`
              flex flex-col items-center justify-center p-4 ${quick.card}
              transition-all duration-200 min-h-[100px]
              ${selectedTool === 'polygon'
                ? `${getStatusBorder('success')} ${colors.bg.success}`
                : `border-border \${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`
              }
              ${actualIsDrawing && selectedTool !== 'polygon' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.ENHANCED}'}
            `}
          >
            <Building className={`${iconSizes.lg} mb-2 ${colors.text.info}`} />
            <span className="text-sm font-medium">{t('drawingInterfaces.professional.tools.property')}</span>
            <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.professional.tools.propertyManual')}</span>
          </button>

          {/* Auto-Detection */}
          <button
            onClick={() => handleToolSelect('auto-detect')}
            disabled={actualIsDrawing || !parserResult}
            className={`
              flex flex-col items-center justify-center p-4 ${quick.card}
              transition-all duration-200 min-h-[100px]
              ${selectedTool === 'auto-detect'
                ? `${getStatusBorder('success')} ${colors.bg.success}`
                : `border-border \${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`
              }
              ${(actualIsDrawing || !parserResult) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.ENHANCED}'}
            `}
          >
            <Layers className={`${iconSizes.lg} mb-2 ${colors.text.accent}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.autoDetect')}</span>
            <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.professional.tools.autoDetectAuto')}</span>
          </button>

          {/* 🏠 Phase 2.5: Property Status Manager */}
          <button
            onClick={() => handleToolSelect('property-manager')}
            disabled={actualIsDrawing}
            className={`
              flex flex-col items-center justify-center p-4 ${quick.card}
              transition-all duration-200 min-h-[100px]
              ${selectedTool === 'property-manager'
                ? `${getStatusBorder('warning')} ${colors.bg.warning}`
                : `border-border \${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`
              }
              ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.ENHANCED}'}
            `}
          >
            <Building className={`${iconSizes.lg} mb-2 ${colors.text.warning}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.properties')}</span>
            <span className={`text-xs ${colors.text.muted}`}>{t('hardcodedTexts.ui.status')}</span>
          </button>

          {/* 🏠 Phase 2.5.3: Real Estate Monitoring Dashboard */}
          <button
            onClick={() => handleToolSelect('monitoring-dashboard')}
            disabled={actualIsDrawing}
            className={`
              flex flex-col items-center justify-center p-4 ${quick.card}
              transition-all duration-200 min-h-[100px]
              ${selectedTool === 'monitoring-dashboard'
                ? `${getStatusBorder('info')} ${colors.bg.info}`
                : `border-border \${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.bg.primary}`
              }
              ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.ENHANCED}'}
            `}
          >
            <BarChart className={`${iconSizes.lg} mb-2 ${colors.text.info}`} />
            <span className="text-sm font-medium">{t('hardcodedTexts.ui.monitor')}</span>
            <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.professional.tools.monitoringMarket')}</span>
          </button>
        </div>

        {/* Action Buttons */}
        {actualIsDrawing && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleComplete}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors`}
            >
              <Check className={iconSizes.md} />
              <span className="font-medium">Ολοκλήρωση</span>
            </button>

            <button
              onClick={handleCancel}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.error} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} transition-colors`}
            >
              <X className={iconSizes.md} />
              <span className="font-medium">Ακύρωση</span>
            </button>
          </div>
        )}

        {/* Auto-Detection Button */}
        {selectedTool === 'auto-detect' && parserResult && (
          <div className="mb-4">
            <button
              onClick={handleAutoDetect}
              className={`w-full flex items-center justify-center gap-2 ${colors.bg.accent} ${colors.text.foreground} py-3 px-4 ${quick.card} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} transition-colors`}
            >
              <Layers className={iconSizes.md} />
              <span className="font-medium">Ανίχνευση Δωματίων</span>
            </button>
          </div>
        )}

        {/* Floor Plan Status */}
        {parserResult && (
          <div className={`mb-4 p-3 ${colors.bg.success} ${quick.card} ${getStatusBorder('success')}`}>
            <p className={`text-sm ${colors.text.success}`}>
              <span className="font-medium">Κάτοψη:</span> {parserResult.metadata?.fileName || 'Uploaded'} ✅
            </p>
            {parserResult.metadata?.fileSize && (
              <p className={`text-xs ${colors.text.success}`}>
                Μέγεθος: {(parserResult.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
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
              <p className={`text-xs ${colors.text.muted}`}>
                <span className="font-medium">Ακίνητα:</span> {stats.totalPolygons}
              </p>
            )}

            {realEstateStats.totalAlerts > 0 && (
              <div className={`text-xs ${colors.text.info}`}>
                <p>
                  <span className="font-medium">{t('hardcodedTexts.labels.monitoringZones')}</span> {realEstateStats.totalAlerts}
                </p>
                {realEstateStats.totalMatches > 0 && (
                  <p>
                    <span className="font-medium">{t('hardcodedTexts.labels.detectedProperties')}</span> {realEstateStats.totalMatches}
                  </p>
                )}
                {realEstateStats.lastCheck && (
                  <p>
                    <span className="font-medium">{t('hardcodedTexts.labels.lastScan')}</span> {new Date(realEstateStats.lastCheck).toLocaleTimeString('el-GR')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floor Plan Upload Modal */}
      <FloorPlanUploadModal
        isOpen={showUploadModal}
        onClose={handleUploadModalClose}
        onFileSelect={handleFileSelect}
        parserResult={parserResult}
        selectedFile={selectedFile}
        isParsing={isParsing}
      />

      {/* 🏠 Phase 2.5: Property Status Manager */}
      {showPropertyManager && (
        <div className="mt-4">
          <PropertyStatusManager
            onStatusChange={handlePropertyStatusChange}
            onColorSchemeChange={(scheme) => {
              console.log('🏢 Professional: Color scheme changed to', scheme);
              // TODO: Apply color scheme to floor plan visualization
            }}
            onLayerVisibilityChange={(statuses, visible) => {
              console.log('🏢 Professional: Layer visibility changed', { statuses, visible });
              // TODO: Toggle property layer visibility
            }}
            className="max-w-md"
          />
        </div>
      )}

      {/* 🏠 Phase 2.5.3: Real Estate Monitoring Dashboard */}
      {showMonitoringDashboard && (
        <div className={`mt-4 ${colors.bg.primary} rounded-lg shadow-lg ${quick.card} p-4`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${colors.text.foreground} flex items-center gap-2`}>
              <BarChart className={`${iconSizes.md} ${colors.text.info}`} />
              {t('realEstateMonitoring.title')}
            </h3>
            <button
              onClick={() => {
                setShowMonitoringDashboard(false);
                setSelectedTool(null);
              }}
              className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            >
              <X className={iconSizes.md} />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className={`${colors.bg.info} p-3 rounded-md`}>
              <p className={`text-sm font-medium ${colors.text.info}`}>{t('realEstateMonitoring.stats.monitoringZones')}</p>
              <p className={`text-2xl font-bold ${colors.text.info}`}>{realEstateStats.totalAlerts}</p>
            </div>
            <div className={`${colors.bg.success} p-3 rounded-md`}>
              <p className={`text-sm font-medium ${colors.text.success}`}>{t('realEstateMonitoring.stats.propertiesFound')}</p>
              <p className={`text-2xl font-bold ${colors.text.success}`}>{realEstateStats.totalMatches}</p>
            </div>
            <div className={`${colors.bg.warning} p-3 rounded-md`}>
              <p className={`text-sm font-medium ${colors.text.warning}`}>{t('realEstateMonitoring.stats.avgConfidence')}</p>
              <p className={`text-2xl font-bold ${colors.text.warning}`}>
                {realEstateStats.averageConfidence ? `${Math.round(realEstateStats.averageConfidence * 100)}%` : '-'}
              </p>
            </div>
            <div className={`${colors.bg.accent} p-3 rounded-md`}>
              <p className={`text-sm font-medium ${colors.text.accent}`}>{t('realEstateMonitoring.stats.lastScan')}</p>
              <p className={`text-sm font-bold ${colors.text.accent}`}>
                {realEstateStats.lastCheck ? new Date(realEstateStats.lastCheck).toLocaleDateString('el-GR') : '-'}
              </p>
            </div>
          </div>

          {/* Professional Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <button
              onClick={() => setBatchMonitoringMode(!batchMonitoringMode)}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border transition-colors ${
                batchMonitoringMode
                  ? `${colors.bg.info} ${getStatusBorder('info')} ${colors.text.info}`
                  : `${colors.bg.secondary} border-border ${colors.text.muted} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
              }`}
            >
              <Settings className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('realEstateMonitoring.actions.batchMode')}</span>
            </button>

            <button
              onClick={() => {
                if (polygons.length > 0) {
                  handleBatchRealEstateMonitoring(polygons);
                }
              }}
              disabled={polygons.length === 0}
              className={`flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-2 px-4 rounded-lg ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors disabled:opacity-50`}
            >
              <Bell className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('realEstateMonitoring.actions.monitorAll', { count: polygons.length })}</span>
            </button>

            <button
              onClick={() => {
                exportMatches('CSV');
                console.log('📊 Professional: Exporting data to CSV');
              }}
              disabled={realEstateStats.totalMatches === 0}
              className={`flex items-center justify-center gap-2 ${colors.bg.muted} ${colors.text.foreground} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors disabled:opacity-50`}
            >
              <FileText className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('realEstateMonitoring.actions.exportCsv')}</span>
            </button>
          </div>

          {/* Professional Tips */}
          <div className={`${colors.bg.info} ${quick.info} p-3`}>
            <h4 className={`text-sm font-semibold ${colors.text.info} mb-2`}>{t('realEstateMonitoring.tips.title')}</h4>
            <ul className={`text-xs ${colors.text.info} space-y-1`}>
              <li>{t('realEstateMonitoring.tips.batchMode')}</li>
              <li>{t('realEstateMonitoring.tips.export')}</li>
              <li>{t('realEstateMonitoring.tips.realtime')}</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}