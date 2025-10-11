'use client';

import React, { useState, useCallback, useRef } from 'react';
import { InteractiveMap } from '../components/InteractiveMap';
import { FloorPlanUploadButton } from '../floor-plan-system/components/FloorPlanUploadButton';
import { FloorPlanUploadModal } from '../floor-plan-system/components/FloorPlanUploadModal';
import { FloorPlanCanvasLayer } from '../floor-plan-system/rendering/FloorPlanCanvasLayer';
import { FloorPlanControls } from '../floor-plan-system/rendering/FloorPlanControls';
import { FloorPlanControlPointPicker } from '../floor-plan-system/components/FloorPlanControlPointPicker';
import { UserTypeSelector } from '../components/UserTypeSelector';
import { CitizenDrawingInterface } from '../components/CitizenDrawingInterface';
import { useFloorPlanUpload } from '../floor-plan-system/hooks/useFloorPlanUpload';
import { useFloorPlanControlPoints } from '../floor-plan-system/hooks/useFloorPlanControlPoints';
import { useGeoTransformation } from '../floor-plan-system/hooks/useGeoTransformation';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useSnapEngine } from '../floor-plan-system/snapping';
import { useOptimizedUserRole } from '@/contexts/OptimizedUserRoleContext';
import type { GeoCanvasAppProps } from '../types';
import type { GeoCoordinate, DxfCoordinate } from '../types';

/**
 * GEO-CANVAS CONTENT COMPONENT
 * Κεντρικό component για το Geo-Alert system interface
 *
 * Phase 1: Basic skeleton και structure
 * Phase 2: DXF transformation engine
 * Phase 3: MapLibre GL JS integration
 * Phase 4-8: Advanced features από roadmap
 */
export function GeoCanvasContent(props: GeoCanvasAppProps) {
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const { user, setUserType, isCitizen, isProfessional, isTechnical } = useOptimizedUserRole();
  const [activeView, setActiveView] = useState<'foundation' | 'georeferencing' | 'map'>('georeferencing');

  // 🏢 ENTERPRISE: SINGLE SOURCE OF TRUTH for Control Points
  // Floor Plan Upload hook
  const floorPlanUpload = useFloorPlanUpload();

  // Floor Plan Control Points hook (STEP 2.2) - OFFICIAL SYSTEM
  const controlPoints = useFloorPlanControlPoints();

  // Floor Plan Geo-Transformation hook (STEP 2.3) - OFFICIAL SYSTEM
  // ❗ CRITICAL: Memoize options to prevent infinite re-renders
  const transformOpts = React.useMemo(() => ({ debug: true }), []);
  const transformation = useGeoTransformation(controlPoints.points, transformOpts);

  // Snap Engine hook (STEP 3: Snap-to-Point)
  const snapEngine = useSnapEngine(floorPlanUpload.result, {
    debug: true
  });

  // 🎯 ENTERPRISE: Unified Transform State (Single Source of Truth)
  const transformState = React.useMemo(() => ({
    controlPoints: controlPoints.points,
    isCalibrated: transformation.isValid,
    quality: transformation.quality,
    rmsError: transformation.rmsError,
    matrix: transformation.matrix
  }), [controlPoints.points, transformation.isValid, transformation.quality, transformation.rmsError, transformation.matrix]);

  // 🚨 CRITICAL DEBUGGING για GeoCanvasContent
  console.log('🏢 GeoCanvasContent transformState:', {
    controlPointsCount: transformState.controlPoints.length,
    controlPoints: transformState.controlPoints,
    isCalibrated: transformState.isCalibrated,
    timestamp: Date.now()
  });

  // Floor Plan Layer state
  const [floorPlanVisible, setFloorPlanVisible] = useState(true);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.8);
  const mapRef = useRef<any>(null); // MapLibre map instance

  // Floor Plan Upload handler - uses hook
  const handleFloorPlanUploadClick = useCallback(() => {
    floorPlanUpload.clearUpload(); // Clear previous state
    floorPlanUpload.openModal();
    console.log('🏗️ Floor Plan Upload button clicked - Modal will open');
  }, [floorPlanUpload]);

  // Floor Plan file selection handler - uses hook
  const handleFloorPlanFileSelect = useCallback(async (file: File) => {
    await floorPlanUpload.uploadFile(file);
  }, [floorPlanUpload]);

  // ===================================================================
  // CONTROL POINT PICKING HANDLERS (STEP 2.2)
  // ===================================================================

  /**
   * Handle floor plan canvas click
   * STEP 1: User clicks on floor plan to select local coordinate
   *
   * ❗ CRITICAL FIX: Only allow clicks when in 'picking-floor' state
   * This prevents canvas from stealing clicks when we're waiting for map click
   */
  const handleFloorPlanClick = useCallback((x: number, y: number, event: React.MouseEvent) => {
    console.log('🗺️ Floor plan clicked:', { x, y });
    console.log('🎯 Current pickingState:', controlPoints.pickingState);

    // Only process if we're waiting for floor plan point
    if (controlPoints.pickingState === 'picking-floor') {
      console.log('✅ Valid state - calling addFloorPlanPoint');
      controlPoints.addFloorPlanPoint(x, y);
    } else {
      console.log('⏭️ Ignoring click - not in picking-floor state');
    }
  }, [controlPoints.pickingState, controlPoints.addFloorPlanPoint]);

  // Draggable panel state - Positioned to avoid map controls (left: accuracy legend, right: coordinates)
  const [panelPosition, setPanelPosition] = useState({ x: 320, y: 16 }); // Center-left position
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 🏢 ENTERPRISE: Map coordinate picking handler (SINGLE SOURCE OF TRUTH)
  const handleCoordinateClick = useCallback(async (coordinate: GeoCoordinate) => {
    console.log('🗺️ Coordinate picked:', coordinate);

    // ✅ OFFICIAL: Check if we're in control point picking mode (STEP 2.2)
    if (controlPoints.pickingState === 'picking-geo') {
      controlPoints.addGeoPoint(coordinate.lng, coordinate.lat);
      return;
    }
  }, [controlPoints.pickingState, controlPoints.addGeoPoint]);

  // Drag handlers for panel (FloorPlanControlPointPicker)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - panelPosition.x,
      y: e.clientY - panelPosition.y
    });
  }, [panelPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    // Ensure panel doesn't cover map controls:
    // - Left edge: avoid accuracy legend (300px from left)
    // - Right edge: avoid coordinate display (350px from right)
    // - Top edge: keep 16px margin
    // - Bottom: keep 100px margin
    const minX = 16;
    const maxX = window.innerWidth - 350; // Keep away from right controls
    const minY = 16;
    const maxY = window.innerHeight - 100;

    const newX = Math.max(minX, Math.min(maxX, e.clientX - dragStart.x));
    const newY = Math.max(minY, Math.min(maxY, e.clientY - dragStart.y));

    setPanelPosition({ x: newX, y: newY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Show loading while translations are being loaded
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white">Φόρτωση μεταφράσεων...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white">
      {/* 📊 HEADER SECTION */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              🌍 {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">
              {t('subtitle')} ({t('phases.foundation')})
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Phase 2.2: Show Floor Plan Upload ONLY for Professional/Technical users */}
            {(isProfessional || isTechnical) && (
              <FloorPlanUploadButton onClick={handleFloorPlanUploadClick} />
            )}

            <div className="px-3 py-1 bg-green-600 rounded-full text-xs">
              {t('phases.transformation')}
            </div>
            <div className="px-3 py-1 bg-blue-600 rounded-full text-xs">
              {t('status.transformationReady')}
            </div>
          </div>
        </div>
      </header>

      {/* 🗺️ MAIN CONTENT AREA */}
      <main className="flex-1 flex">

        {/* 🎯 CENTER AREA - Map/Canvas */}
        <div className="flex-1 flex flex-col">
          {/* 🔧 TOP TOOLBAR */}
          <div className="bg-gray-800 border-b border-gray-700 p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">{t('toolbar.view')}</span>
                <select
                  value={activeView}
                  onChange={(e) => {
                    const value = e.target.value;
                    // ✅ ENTERPRISE: Type guard instead of 'as any'
                    if (value === 'foundation' || value === 'georeferencing' || value === 'map') {
                      setActiveView(value);
                    }
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
                >
                  <option value="georeferencing">{t('views.georeferencing')}</option>
                  <option value="foundation">{t('views.foundation')}</option>
                  <option disabled>{t('views.mapping')}</option>
                  <option disabled>Split View ({t('phases.ui')})</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-gray-400">{t('toolbar.crs')}</span>
                <select className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm">
                  <option>{t('coordinateSystems.epsg4326')}</option>
                  <option>{t('coordinateSystems.epsg2100')}</option>
                  <option>UTM 34N (EPSG:32634)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 🖥️ MAIN CONTENT - Canvas/Map Area */}
          <div className="flex-1 bg-gray-900 relative">
            {activeView === 'foundation' && (
              /* Phase 1: Foundation Display */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-4xl p-8 w-full">
                  <div className="text-8xl mb-6">🌍</div>
                  <h2 className="text-3xl font-bold mb-4 text-blue-400">
                    {t('title')}
                  </h2>
                  <p className="text-xl text-gray-400 mb-8">
                    {t('subtitle')}
                  </p>

                  {/* Phase 2.2: User Type Selector */}
                  {!user?.userType && (
                    <div className="mb-8">
                      <UserTypeSelector
                        currentType={user?.userType}
                        onSelect={setUserType}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6 text-left">
                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">
                        ✅ Phase 1 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>{t('phaseDetails.phase1Features.foundationStructure')}</li>
                        <li>{t('phaseDetails.phase1Features.enterpriseTypeSystem')}</li>
                        <li>{t('phaseDetails.phase1Features.configurationSetup')}</li>
                        <li>{t('phaseDetails.phase1Features.routerIntegrationReady')}</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">
                        ✅ Phase 2 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>{t('phaseDetails.phase2Features.dxfTransformationEngine')}</li>
                        <li>{t('phaseDetails.phase2Features.coordinateSystemSupport')}</li>
                        <li>{t('phaseDetails.phase2Features.georeferencingTools')}</li>
                        <li>{t('phaseDetails.phase2Features.controlPointManagement')}</li>
                      </ul>
                    </div>
                  </div>

                  {/* Architecture Overview */}
                  <div className="mt-8 p-6 bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">
                      🏗️ {t('phaseDetails.architectureOverview.title')}
                    </h3>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p>
                        <strong>{t('phaseDetails.architectureOverview.centralizedSystem')}</strong>
                      </p>
                      <p>
                        <strong>{t('phaseDetails.architectureOverview.technologyStack')}</strong>
                      </p>
                      <p>
                        <strong>{t('phaseDetails.architectureOverview.dataFlow')}</strong>
                      </p>
                      <p>
                        <strong>{t('phaseDetails.architectureOverview.standards')}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'georeferencing' && (
              /* Phase 3: Interactive MapLibre GL JS Workspace */
              <div className="absolute inset-0">
                <InteractiveMap
                  className="w-full h-full"
                  onCoordinateClick={handleCoordinateClick}
                  showControlPoints={true}
                  showTransformationPreview={true}
                  isPickingCoordinates={controlPoints.pickingState === 'picking-geo'}
                  transformState={transformState}
                  onPolygonComplete={() => {
                    console.log('🎯 Polygon completed');
                  }}
                  onMapReady={(map) => {
                    console.log('🗺️ Map ready - storing reference');
                    mapRef.current = map;
                  }}
                />

                {/* 🗺️ FLOOR PLAN CANVAS LAYER */}
                {floorPlanUpload.result && floorPlanUpload.result.success && (
                  <FloorPlanCanvasLayer
                    map={mapRef.current}
                    floorPlan={floorPlanUpload.result}
                    visible={floorPlanVisible}
                    style={{
                      opacity: floorPlanOpacity,
                      strokeColor: '#000000', // Μαύρο χρώμα
                      strokeWidth: 2
                    }}
                    zIndex={100}
                    onClick={handleFloorPlanClick}
                    disableInteractions={controlPoints.pickingState === 'picking-geo'}
                    transformMatrix={transformation.matrix}
                    snapEngine={controlPoints.pickingState === 'picking-floor' ? snapEngine : undefined}
                  />
                )}

                {/* 🎛️ FLOOR PLAN CONTROLS */}
                {floorPlanUpload.result && floorPlanUpload.result.success && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      zIndex: 200
                    }}
                  >
                    <FloorPlanControls
                      visible={floorPlanVisible}
                      opacity={floorPlanOpacity}
                      fileName={floorPlanUpload.file?.name}
                      onVisibilityChange={setFloorPlanVisible}
                      onOpacityChange={setFloorPlanOpacity}
                    />
                  </div>
                )}

                {/* 📍 CONTROL POINT PICKER (STEP 2.2) */}
                {floorPlanUpload.result && floorPlanUpload.result.success && (isProfessional || isTechnical) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '16px',
                      zIndex: 200,
                      maxWidth: '400px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      padding: '16px'
                    }}
                  >
                    <FloorPlanControlPointPicker controlPoints={controlPoints} />
                  </div>
                )}

                {/* 🏘️ CITIZEN DRAWING INTERFACE (Phase 2.2.2) */}
                {isCitizen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '16px',
                      zIndex: 200,
                      maxWidth: '360px'
                    }}
                  >
                    <CitizenDrawingInterface
                      mapRef={mapRef}
                      onPolygonComplete={(polygon) => {
                        console.log('🏘️ Citizen polygon completed:', polygon);
                        // TODO: Integrate με alert system
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 📊 RIGHT SIDEBAR - System Status */}
        <aside className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <div className="space-y-6">
            {/* Phase Progress */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                {t('sidebar.phaseProgress.title')}
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-green-900 border border-green-600 rounded">
                  <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase1Title')}</div>
                  <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase1Description')}</div>
                </div>
                <div className="p-3 bg-green-900 border border-green-600 rounded">
                  <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase2Title')}</div>
                  <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase2Description')}</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-yellow-400">{t('sidebar.phaseProgress.phase3Title')}</div>
                  <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase3Description')}</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-gray-400">{t('sidebar.phaseProgress.phase4Title')}</div>
                  <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase4Description')}</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-gray-400">{t('sidebar.phaseProgress.phase5Title')}</div>
                  <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase5Description')}</div>
                </div>
              </div>
            </section>

            {/* Current Features */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-green-400">
                {t('sidebar.availableFeatures.title')}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.controlPointManagement')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.affineTransformation')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.accuracyValidation')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.spatialDistributionAnalysis')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.rmsErrorCalculation')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>{t('sidebar.availableFeatures.coordinateTransformation')}</span>
                </div>
              </div>
            </section>

            {/* Technical Specs */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                {t('sidebar.technicalSpecs.title')}
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>{t('sidebar.technicalSpecs.transformation')}</span>
                  <span className="text-blue-300">{t('sidebar.technicalSpecs.transformationValue')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('sidebar.technicalSpecs.accuracy')}</span>
                  <span className="text-green-300">{t('sidebar.technicalSpecs.accuracyValue')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('sidebar.technicalSpecs.crsSupport')}</span>
                  <span className="text-purple-300">{t('sidebar.technicalSpecs.crsSupportValue')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('sidebar.technicalSpecs.mathEngine')}</span>
                  <span className="text-yellow-300">{t('sidebar.technicalSpecs.mathEngineValue')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('sidebar.technicalSpecs.standards')}</span>
                  <span className="text-blue-300">{t('sidebar.technicalSpecs.standardsValue')}</span>
                </div>
              </div>
            </section>

            {/* Next Steps */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-yellow-400">
                {t('sidebar.comingNext.title')}
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div>{t('sidebar.comingNext.maplibreIntegration')}</div>
                <div>{t('sidebar.comingNext.interactiveCoordinatePicking')}</div>
                <div>{t('sidebar.comingNext.realtimeTransformationPreview')}</div>
                <div>{t('sidebar.comingNext.multipleBasemapLayers')}</div>
                <div>{t('sidebar.comingNext.visualAccuracyIndicators')}</div>
              </div>
            </section>
          </div>
        </aside>
      </main>

      {/* 📋 FOOTER STATUS */}
      <footer className="bg-gray-800 border-t border-gray-700 p-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-green-400">● Active</span>
            <span className="text-green-400">Phase 2: DXF Transformation</span>
            <span className="text-blue-400">Georeferencing Ready</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-gray-400">
              {t('sidebar.technicalSpecs.standardsValue')} | OGC Standards | {t('sidebar.technicalSpecs.mathEngineValue')}
            </span>
            <span className="text-blue-400">
              🏢 Pagonis-Nestor Geo-Canvas v2.0
            </span>
          </div>
        </div>
      </footer>

      {/* 📁 FLOOR PLAN UPLOAD MODAL */}
      <FloorPlanUploadModal
        isOpen={floorPlanUpload.isModalOpen}
        onClose={floorPlanUpload.closeModal}
        onFileSelect={handleFloorPlanFileSelect}
        parserResult={floorPlanUpload.result}
        selectedFile={floorPlanUpload.file}
        isParsing={floorPlanUpload.isParsing}
      />
    </div>
  );
}

export default GeoCanvasContent;