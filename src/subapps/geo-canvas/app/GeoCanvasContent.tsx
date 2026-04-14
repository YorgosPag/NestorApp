'use client';

/**
 * GeoCanvasContent — Main component for the Geo-Alert system interface.
 * @see useBoundaryLayers.ts — boundary layer state + handlers
 * @see GeoCanvasPanels.tsx — SystemStatusPanel + FoundationView sub-components
 */

import React, { useState, useCallback, useRef } from 'react';
import { InteractiveMap } from '../components/InteractiveMap';
import { FloorPlanUploadButton } from '../floor-plan-system/components/FloorPlanUploadButton';
import { FloorPlanUploadModal } from '../floor-plan-system/components/FloorPlanUploadModal';
import { FloorPlanCanvasLayer } from '../floor-plan-system/rendering/FloorPlanCanvasLayer';
import { FloorPlanControls } from '../floor-plan-system/rendering/FloorPlanControls';
import { FloorPlanControlPointPicker } from '../floor-plan-system/components/FloorPlanControlPointPicker';
import { CitizenDrawingInterface } from '../components/CitizenDrawingInterface';
import { ProfessionalDrawingInterface } from '../components/ProfessionalDrawingInterface';
import { TechnicalDrawingInterface } from '../components/TechnicalDrawingInterface';
import { AlertManagementPanel } from '../components/AlertManagementPanel';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../../dxf-viewer/components/modal/ModalLoadingStates';
import { PolygonSystemProvider } from '../systems/polygon-system';
import { useFloorPlanUpload } from '../floor-plan-system/hooks/useFloorPlanUpload';
import { useFloorPlanControlPoints } from '../floor-plan-system/hooks/useFloorPlanControlPoints';
import { useGeoTransformation } from '../floor-plan-system/hooks/useGeoTransformation';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSnapEngine } from '../floor-plan-system/snapping';
import { useUserRole, useUserType } from '@/auth';
import { PageErrorBoundary, ComponentErrorBoundary } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import ErrorReportingDashboard from '@/components/development/ErrorReportingDashboard';
import { useAnalytics } from '@/services/AnalyticsBridge';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { canvasUtilities } from '@/styles/design-tokens';
import { useIsMobile } from '@/hooks/useMobile';
import { draggablePanelContainer, fixedSidebarPanel } from '../components/InteractiveMap.styles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Globe, AlertCircle, Menu, SlidersHorizontal } from 'lucide-react';
import type { GeoCanvasAppProps, GeoCoordinate } from '../types';
import type { MapInstance } from '../hooks/map/useMapInteractions';

import { useBoundaryLayers } from './useBoundaryLayers';
import { FoundationView } from './GeoCanvasPanels';

type MapLibreMapInstance = MapInstance | null;

export function GeoCanvasContent(props: GeoCanvasAppProps) {
  const iconSizes = useIconSizes();
  const borders = useBorderTokens();
  const colors = useSemanticColors();
  const isMobile = useIsMobile();
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const { user } = useUserRole();
  const { setUserType, isCitizen, isProfessional, isTechnical } = useUserType();
  const [activeView, setActiveView] = useState<'foundation' | 'georeferencing' | 'map'>('georeferencing');
  const [showAlertDashboard, setShowAlertDashboard] = useState(false);
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const mapRef = useRef<MapLibreMapInstance>(null);

  // Extracted hooks
  const boundary = useBoundaryLayers(mapRef);

  // Analytics
  const analytics = useAnalytics();
  const [pendingUserType, setPendingUserType] = useState<string | null>(null);

  React.useEffect(() => {
    if (pendingUserType && user?.userType === pendingUserType) {
      setTimeout(() => {
        analytics.trackUserBehavior('user_type_selected', 'UserTypeSelector', { selectedUserType: pendingUserType, previousUserType: null });
        const userId = user?.uid || 'anonymous';
        if (pendingUserType === 'citizen' || pendingUserType === 'professional' || pendingUserType === 'technical') {
          analytics.updateUser(userId, pendingUserType);
        }
      }, 0);
      setPendingUserType(null);
    }
  }, [user?.userType, pendingUserType]);

  const handleUserTypeSelect = useCallback((userType: 'citizen' | 'professional' | 'technical') => {
    setPendingUserType(userType);
    setUserType(userType);
  }, [setUserType]);

  // Floor plan hooks
  const floorPlanUpload = useFloorPlanUpload();
  const controlPoints = useFloorPlanControlPoints();
  const transformOpts = React.useMemo(() => ({ debug: false }), []);
  const transformation = useGeoTransformation(controlPoints.points, transformOpts);
  const snapEngine = useSnapEngine(floorPlanUpload.result, { debug: false });

  const transformState = React.useMemo(() => ({
    controlPoints: controlPoints.points,
    isCalibrated: transformation.isValid,
    quality: transformation.quality,
    rmsError: transformation.rmsError,
    matrix: transformation.matrix,
  }), [controlPoints.points, transformation.isValid, transformation.quality, transformation.rmsError, transformation.matrix]);

  const [floorPlanVisible, setFloorPlanVisible] = useState(true);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.8);

  const handleFloorPlanUploadClick = useCallback(() => {
    floorPlanUpload.clearUpload();
    floorPlanUpload.openModal();
  }, [floorPlanUpload]);

  const handleFloorPlanFileSelect = useCallback(async (file: File) => {
    await floorPlanUpload.uploadFile(file);
  }, [floorPlanUpload]);

  const handleFloorPlanClick = useCallback((x: number, y: number, _event: React.MouseEvent) => {
    if (controlPoints.pickingState === 'picking-floor') {
      controlPoints.addFloorPlanPoint(x, y);
    }
  }, [controlPoints.pickingState, controlPoints.addFloorPlanPoint]);

  const handleCoordinateClick = useCallback(async (coordinate: GeoCoordinate) => {
    if (controlPoints.pickingState === 'picking-geo') {
      controlPoints.addGeoPoint(coordinate.lng, coordinate.lat);
    }
  }, [controlPoints.pickingState, controlPoints.addGeoPoint]);

  const hasFloorPlanResult = Boolean(floorPlanUpload.result && floorPlanUpload.result.success);

  // Stable no-op callbacks — prevent new references on every render
  const handlePolygonComplete = useCallback(() => {}, []);
  const handleMapReady = useCallback((map: MapInstance) => { mapRef.current = map; }, []);
  const handleFloorPlanUploaded = useCallback(() => {}, []);

  const roleWorkspacePanel = isCitizen
    ? <CitizenDrawingInterface mapRef={mapRef} onPolygonComplete={handlePolygonComplete} onLocationSelected={boundary.handleLocationSelected} onAdminBoundarySelected={boundary.handleAdminBoundarySelected} boundaryLayers={boundary.boundaryLayers} onLayerToggle={boundary.handleLayerToggle} onLayerOpacityChange={boundary.handleLayerOpacityChange} onLayerStyleChange={boundary.handleLayerStyleChange} onLayerRemove={boundary.handleLayerRemove} onAddNewBoundary={boundary.handleAddNewBoundary} />
    : isProfessional
      ? <ProfessionalDrawingInterface mapRef={mapRef} onPolygonComplete={handlePolygonComplete} onFloorPlanUploaded={handleFloorPlanUploaded} />
      : isTechnical
        ? <TechnicalDrawingInterface mapRef={mapRef} onPolygonComplete={handlePolygonComplete} />
        : null;


  if (isLoading) {
    return (
      <div className={`dark w-full h-full flex items-center justify-center ${colors.bg.secondary}`}>
        <div className="text-center">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p className="text-white">{t('loadingStates.loadingTranslations')}</p>
        </div>
      </div>
    );
  }

  return (
    <PolygonSystemProvider initialRole="citizen">
      <div className={`dark w-full h-full flex flex-col ${colors.bg.secondary}`}>
      {/* HEADER */}
      <header className={`${colors.bg.primary} ${borders.quick.separatorH} p-3 sm:p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
              <Globe className={iconSizes.lg} />
              {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={() => setShowAlertDashboard(!showAlertDashboard)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${showAlertDashboard ? `${colors.bg.warning} text-white` : `${colors.bg.hover} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`}`}
            >
              <AlertCircle className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('alertDashboard.title')}</span>
            </button>
            {(isProfessional || isTechnical) && <FloorPlanUploadButton onClick={handleFloorPlanUploadClick} />}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          {/* TOOLBAR */}
          <nav className={`${colors.bg.primary} ${borders.quick.separatorH} p-2 sm:p-3`} role="toolbar">
            <ul className="flex flex-wrap items-center gap-2 sm:gap-4 list-none">
              {isMobile && activeView === 'georeferencing' && (
                <>
                  <li><button type="button" onClick={() => setMobileWorkspaceOpen(true)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.FAST_COLORS}`}><Menu className={iconSizes.sm} />Panels</button></li>
                  <li><button type="button" onClick={() => setMobileStatusOpen(true)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.FAST_COLORS}`}><SlidersHorizontal className={iconSizes.sm} />Status</button></li>
                </>
              )}
              <li className="flex items-center space-x-2">
                <span className="text-gray-400">{t('toolbar.view')}</span>
                <Select value={activeView} onValueChange={(v) => { if (v === 'foundation' || v === 'georeferencing' || v === 'map') setActiveView(v); }}>
                  <SelectTrigger className="w-[150px] sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="georeferencing">{t('views.georeferencing')}</SelectItem>
                    <SelectItem value="foundation">{t('views.foundation')}</SelectItem>
                    <SelectItem value="map" disabled>{t('views.mapping')}</SelectItem>
                  </SelectContent>
                </Select>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-gray-400">{t('toolbar.crs')}</span>
                <Select defaultValue="epsg4326">
                  <SelectTrigger className="w-[150px] sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epsg4326">{t('coordinateSystems.epsg4326')}</SelectItem>
                    <SelectItem value="epsg2100">{t('coordinateSystems.epsg2100')}</SelectItem>
                    <SelectItem value="utm34n">UTM 34N (EPSG:32634)</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            </ul>
          </nav>

          {/* CANVAS / MAP AREA */}
          <div className={`flex-1 ${colors.bg.backgroundSecondary} relative`}>
            {activeView === 'foundation' && (
              <FoundationView t={t} isLoading={isLoading} colors={colors} iconSizes={iconSizes} userType={user?.userType} onUserTypeSelect={handleUserTypeSelect} />
            )}

            {activeView === 'georeferencing' && (
              <div className="absolute inset-0">
                <ComponentErrorBoundary componentName="InteractiveMap">
                  <InteractiveMap className="w-full h-full" onCoordinateClick={handleCoordinateClick} showControlPoints showTransformationPreview isPickingCoordinates={controlPoints.pickingState === 'picking-geo'} transformState={transformState} enablePolygonDrawing searchMarker={boundary.searchMarker} administrativeBoundaries={boundary.administrativeBoundaries} onPolygonComplete={handlePolygonComplete} onMapReady={handleMapReady} />
                </ComponentErrorBoundary>

                {floorPlanUpload.result && floorPlanUpload.result.success && (
                  <FloorPlanCanvasLayer map={mapRef.current} floorPlan={floorPlanUpload.result} visible={floorPlanVisible} style={{ opacity: floorPlanOpacity }} zIndex={100} onClick={handleFloorPlanClick} disableInteractions={controlPoints.pickingState === 'picking-geo'} transformMatrix={transformation.matrix} snapEngine={controlPoints.pickingState === 'picking-floor' ? snapEngine : undefined} />
                )}

                {hasFloorPlanResult && !isMobile && (
                  <div style={canvasUtilities.geoInteractive.positioning.topRight}>
                    <FloorPlanControls visible={floorPlanVisible} opacity={floorPlanOpacity} fileName={floorPlanUpload.file?.name} onVisibilityChange={setFloorPlanVisible} onOpacityChange={setFloorPlanOpacity} />
                  </div>
                )}

                {hasFloorPlanResult && !isMobile && (isProfessional || isTechnical) && (
                  <div style={draggablePanelContainer({ x: 16, y: 16 }, false, 350)}>
                    <FloorPlanControlPointPicker controlPoints={controlPoints} />
                  </div>
                )}

                {roleWorkspacePanel && !isMobile && (
                  <div style={draggablePanelContainer({ x: 16, y: 16 }, false, 350)}>{roleWorkspacePanel}</div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>


      {/* MOBILE SHEETS */}
      {isMobile && activeView === 'georeferencing' && (
        <>
          <Sheet open={mobileWorkspaceOpen} onOpenChange={setMobileWorkspaceOpen}>
            <SheetContent side="bottom" className="h-[78vh] p-0" aria-label="GeoCanvas Workspace Panels">
              <SheetHeader className="p-4 pb-0"><SheetTitle>GeoCanvas Panels</SheetTitle><SheetDescription>Touch-friendly access to tools and drawing panels.</SheetDescription></SheetHeader>
              <div className="h-[calc(78vh-64px)] overflow-y-auto p-4 space-y-4">
                {hasFloorPlanResult && (<section className={`p-3 rounded-lg ${colors.bg.primary} ${borders.quick.card}`}><FloorPlanControls visible={floorPlanVisible} opacity={floorPlanOpacity} fileName={floorPlanUpload.file?.name} onVisibilityChange={setFloorPlanVisible} onOpacityChange={setFloorPlanOpacity} /></section>)}
                {hasFloorPlanResult && (isProfessional || isTechnical) && (<section className={`p-3 rounded-lg ${colors.bg.primary} ${borders.quick.card}`}><FloorPlanControlPointPicker controlPoints={controlPoints} /></section>)}
                {roleWorkspacePanel && (<section className={`p-3 rounded-lg ${colors.bg.primary} ${borders.quick.card}`}>{roleWorkspacePanel}</section>)}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* MODALS & OVERLAYS */}
      <FloorPlanUploadModal isOpen={floorPlanUpload.isModalOpen} onClose={floorPlanUpload.closeModal} onFileSelect={handleFloorPlanFileSelect} parserResult={floorPlanUpload.result} selectedFile={floorPlanUpload.file} isParsing={floorPlanUpload.isParsing} />

      {showAlertDashboard && !isMobile && (
        <div style={fixedSidebarPanel('right', '480px')}>
          <ComponentErrorBoundary componentName="AlertManagementPanel">
            <AlertManagementPanel onClose={() => setShowAlertDashboard(false)} className="shadow-2xl" />
          </ComponentErrorBoundary>
        </div>
      )}

      <ErrorReportingDashboard position="bottom-right" minimized />
    </div>
    </PolygonSystemProvider>
  );
}

// Enterprise error boundary wrapper
const GeoCanvasContentWithErrorBoundary = (props: GeoCanvasAppProps) => (
  <PageErrorBoundary componentName="GeoCanvasContent" enableRetry maxRetries={2} enableReporting
    onError={(error, errorInfo, errorId) => {
      setTimeout(() => {
        console.error('GEO-ALERT Error Captured:', { errorId, component: 'GeoCanvasContent', error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
      }, 0);
    }}
  >
    <GeoCanvasContent {...props} />
  </PageErrorBoundary>
);

export default GeoCanvasContentWithErrorBoundary;
