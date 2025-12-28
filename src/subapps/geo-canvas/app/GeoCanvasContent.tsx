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
import { ProfessionalDrawingInterface } from '../components/ProfessionalDrawingInterface';
import { TechnicalDrawingInterface } from '../components/TechnicalDrawingInterface';
import { AlertManagementPanel } from '../components/AlertManagementPanel';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../../dxf-viewer/components/modal/ModalLoadingStates';

// ✅ NEW: Enterprise Centralized Polygon System Provider
import { PolygonSystemProvider } from '../systems/polygon-system';

import { useFloorPlanUpload } from '../floor-plan-system/hooks/useFloorPlanUpload';
import { useFloorPlanControlPoints } from '../floor-plan-system/hooks/useFloorPlanControlPoints';
import { useGeoTransformation } from '../floor-plan-system/hooks/useGeoTransformation';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSnapEngine } from '../floor-plan-system/snapping';
import { useOptimizedUserRole } from '@/contexts/OptimizedUserRoleContext';
import { PageErrorBoundary, ComponentErrorBoundary } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import ErrorReportingDashboard from '@/components/development/ErrorReportingDashboard';
import { useAnalytics } from '@/services/AnalyticsBridge';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { canvasUtilities } from '@/styles/design-tokens';
import { CraneIcon } from '@/subapps/dxf-viewer/components/icons';
import { Globe, AlertCircle, Construction, CheckCircle, RefreshCcw } from 'lucide-react';
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
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const { user, setUserType, isCitizen, isProfessional, isTechnical } = useOptimizedUserRole();
  const [activeView, setActiveView] = useState<'foundation' | 'georeferencing' | 'map'>('georeferencing');
  const [showAlertDashboard, setShowAlertDashboard] = useState(false);

  // ✅ NEW: Address Search Marker State
  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);

  // ✅ NEW: Administrative Boundaries State (Enhanced for Layer Management)
  const [administrativeBoundaries, setAdministrativeBoundaries] = useState<{
    feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
    visible: boolean;
    style?: {
      strokeColor?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
    };
  }[]>([]);

  // ✅ NEW: Boundary Layer Management State
  const [boundaryLayers, setBoundaryLayers] = useState<Array<{
    id: string;
    name: string;
    type: 'region' | 'municipality' | 'municipal_unit' | 'community';
    visible: boolean;
    opacity: number;
    style: {
      strokeColor: string;
      strokeWidth: number;
      fillColor: string;
      fillOpacity: number;
    };
    boundary: {
      feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
      result: any;
    };
  }>>([]);

  // **📊 ANALYTICS INTEGRATION**
  const analytics = useAnalytics();
  const [pendingUserType, setPendingUserType] = useState<string | null>(null);

  // Handle analytics tracking after state changes (prevents setState during render warning)
  React.useEffect(() => {
    if (pendingUserType && user?.userType === pendingUserType) {
      // Defer analytics tracking to next tick to prevent setState during render
      setTimeout(() => {
        // Track analytics after render cycle is complete
        analytics.trackUserBehavior('user_type_selected', 'UserTypeSelector', {
          selectedUserType: pendingUserType,
          previousUserType: null // We don't track previous anymore to avoid race conditions
        });

        // Update user analytics context
        const userId = user?.email || 'anonymous';
        // ✅ ENTERPRISE: Type guard instead of 'as any'
        if (pendingUserType && (pendingUserType === 'citizen' || pendingUserType === 'professional' || pendingUserType === 'technical')) {
          analytics.updateUser(userId, pendingUserType);
        }

        console.log('🎭 User type analytics tracked:', pendingUserType);
      }, 0);

      // Clear pending state immediately
      setPendingUserType(null);
    }
  }, [user?.userType, pendingUserType]); // ✅ Removed analytics and user?.email from deps

  // Simplified user type selection (no analytics in render cycle)
  const handleUserTypeSelect = useCallback((userType: 'citizen' | 'professional' | 'technical') => {
    // Set pending analytics tracking
    setPendingUserType(userType);

    // Update state immediately
    setUserType(userType);

    console.log('🎭 User type selected:', userType);
  }, [setUserType]);

  // 🏢 ENTERPRISE: SINGLE SOURCE OF TRUTH for Control Points
  // Floor Plan Upload hook
  const floorPlanUpload = useFloorPlanUpload();

  // Floor Plan Control Points hook (STEP 2.2) - OFFICIAL SYSTEM
  const controlPoints = useFloorPlanControlPoints();

  // Floor Plan Geo-Transformation hook (STEP 2.3) - OFFICIAL SYSTEM
  // ❗ CRITICAL: Memoize options to prevent infinite re-renders
  const transformOpts = React.useMemo(() => ({ debug: false }), []); // ✅ Disabled debug to prevent console logs
  const transformation = useGeoTransformation(controlPoints.points, transformOpts);

  // Snap Engine hook (STEP 3: Snap-to-Point)
  const snapEngine = useSnapEngine(floorPlanUpload.result, {
    debug: false // ✅ Disabled debug to prevent console logs
  });

  // 🎯 ENTERPRISE: Unified Transform State (Single Source of Truth)
  const transformState = React.useMemo(() => ({
    controlPoints: controlPoints.points,
    isCalibrated: transformation.isValid,
    quality: transformation.quality,
    rmsError: transformation.rmsError,
    matrix: transformation.matrix
  }), [controlPoints.points, transformation.isValid, transformation.quality, transformation.rmsError, transformation.matrix]);

  // 🚨 CRITICAL DEBUGGING για GeoCanvasContent (removed to prevent render loops)
  // console.log('🏢 GeoCanvasContent transformState:', {
  //   controlPointsCount: transformState.controlPoints.length,
  //   controlPoints: transformState.controlPoints,
  //   isCalibrated: transformState.isCalibrated,
  //   timestamp: Date.now()
  // });

  // Floor Plan Layer state
  const [floorPlanVisible, setFloorPlanVisible] = useState(true);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.8);
  const mapRef = useRef<any>(null); // MapLibre map instance

  // ✅ NEW: Handle location selection από address search/GPS
  const handleLocationSelected = useCallback((lat: number, lng: number, address?: any) => {
    console.log('Location selected, centering map:', { lat, lng, address });

    // Set search marker
    let displayAddress = 'Αναζητημένη θέση';

    // Handle different address formats
    if (typeof address === 'string') {
      displayAddress = address;
    } else if (address && typeof address === 'object') {
      // Handle GreekAddress format: {street, number, area, municipality, postalCode, region, country, fullAddress}
      if (address.fullAddress) {
        displayAddress = address.fullAddress;
      } else if (address.street) {
        // Build address from components
        const parts = [
          address.street,
          address.number,
          address.area,
          address.municipality
        ].filter(Boolean);
        displayAddress = parts.join(' ') || 'Αναζητημένη θέση';
      } else {
        // Fallback για άλλα object formats (π.χ. Nominatim)
        displayAddress = address.display_name || 'Αναζητημένη θέση';
      }
    }

    setSearchMarker({
      lat,
      lng,
      address: displayAddress
    });

    // Auto-hide marker after 30 seconds
    setTimeout(() => {
      setSearchMarker(null);
      console.log('🗑️ Search marker auto-cleared after 30 seconds');
    }, 30000);

    if (mapRef.current) {
      // Center και zoom στη νέα θέση
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16, // Κατάλληλο zoom level για διεύθυνση
        duration: 2000, // 2 seconds animation
        essential: true
      });

      console.log('🗺️ Map centered to selected location');
    } else {
      console.warn('⚠️ Map reference not available yet');
    }
  }, []);

  // ✅ NEW: Handle administrative boundary selection (Enhanced for Layer Management)
  const handleAdminBoundarySelected = useCallback((boundary: GeoJSON.Feature | GeoJSON.FeatureCollection, result: any) => {
    console.log('🏛️ Administrative boundary selected:', { boundary, result });

    // Determine boundary type και default style
    let type: 'region' | 'municipality' | 'municipal_unit' | 'community';
    let defaultStyle: any;

    if (result.adminLevel === 4) { // Region
      type = 'region';
      defaultStyle = {
        strokeColor: '#7c3aed',
        strokeWidth: 3,
        fillColor: '#8b5cf6',
        fillOpacity: 0.15
      };
    } else if (result.adminLevel === 8) { // Municipality
      type = 'municipality';
      defaultStyle = {
        strokeColor: '#2563eb',
        strokeWidth: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1
      };
    } else if (result.adminLevel === 9) { // Municipal Unit
      type = 'municipal_unit';
      defaultStyle = {
        strokeColor: '#059669',
        strokeWidth: 2,
        fillColor: '#10b981',
        fillOpacity: 0.1
      };
    } else { // Community or other
      type = 'community';
      defaultStyle = {
        strokeColor: '#d97706',
        strokeWidth: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.1
      };
    }

    // Create new layer
    const layerId = `boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newLayer = {
      id: layerId,
      name: result.name,
      type,
      visible: true,
      opacity: 1.0,
      style: defaultStyle,
      boundary: {
        feature: boundary,
        result
      }
    };

    // Add layer to boundary layers
    setBoundaryLayers(prev => [...prev, newLayer]);

    // Update administrative boundaries για backwards compatibility
    setAdministrativeBoundaries(prev => [...prev, {
      feature: boundary,
      visible: true,
      style: {
        strokeColor: defaultStyle.strokeColor,
        strokeWidth: defaultStyle.strokeWidth,
        strokeOpacity: 0.8,
        fillColor: defaultStyle.fillColor,
        fillOpacity: defaultStyle.fillOpacity
      }
    }]);

    // Calculate boundary center για map centering
    if (mapRef.current && boundary) {
      try {
        let center: [number, number] | null = null;
        let zoom = 10;

        if (boundary.type === 'Feature' && boundary.geometry) {
          // Simple center calculation for demo - production would use turf.js
          if (boundary.geometry.type === 'Polygon' && boundary.geometry.coordinates?.[0]) {
            const coords = boundary.geometry.coordinates[0] as [number, number][];
            if (coords.length > 0) {
              const avgLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
              const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
              center = [avgLng, avgLat];
              zoom = result.adminLevel === 4 ? 8 : 12; // Regions wider view, municipalities closer
            }
          }
        } else if (boundary.type === 'FeatureCollection' && boundary.features.length > 0) {
          // For FeatureCollection, use first feature's center
          const firstFeature = boundary.features[0];
          if (firstFeature.geometry?.type === 'Polygon' && firstFeature.geometry.coordinates?.[0]) {
            const coords = firstFeature.geometry.coordinates[0] as [number, number][];
            if (coords.length > 0) {
              const avgLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
              const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
              center = [avgLng, avgLat];
              zoom = 10;
            }
          }
        }

        if (center) {
          mapRef.current.flyTo({
            center,
            zoom,
            duration: 2000,
            essential: true
          });
          console.log(`🗺️ Map centered to ${result.name}:`, center);
        }
      } catch (error) {
        console.warn('⚠️ Failed to center map on boundary:', error);
      }
    }

    console.log(`✅ Boundary layer "${result.name}" added with ID: ${layerId}`);
  }, []);

  // ✅ NEW: Boundary Layer Control Handlers
  const handleLayerToggle = useCallback((layerId: string, visible: boolean) => {
    setBoundaryLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, visible } : layer
      )
    );

    // Update administrative boundaries για compatibility με InteractiveMap
    setBoundaryLayers(prev => {
      const visibleLayers = prev.filter(layer => layer.visible);
      setAdministrativeBoundaries(visibleLayers.map(layer => ({
        feature: layer.boundary.feature,
        visible: layer.visible,
        style: {
          strokeColor: layer.style.strokeColor,
          strokeWidth: layer.style.strokeWidth,
          strokeOpacity: layer.opacity,
          fillColor: layer.style.fillColor,
          fillOpacity: layer.style.fillOpacity * layer.opacity
        }
      })));
      return prev;
    });

    console.log(`🔄 Layer ${layerId} visibility: ${visible}`);
  }, []);

  const handleLayerOpacityChange = useCallback((layerId: string, opacity: number) => {
    setBoundaryLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    );

    // Update administrative boundaries
    setBoundaryLayers(prev => {
      const visibleLayers = prev.filter(layer => layer.visible);
      setAdministrativeBoundaries(visibleLayers.map(layer => ({
        feature: layer.boundary.feature,
        visible: layer.visible,
        style: {
          strokeColor: layer.style.strokeColor,
          strokeWidth: layer.style.strokeWidth,
          strokeOpacity: layer.opacity,
          fillColor: layer.style.fillColor,
          fillOpacity: layer.style.fillOpacity * layer.opacity
        }
      })));
      return prev;
    });

    console.log(`🎨 Layer ${layerId} opacity: ${opacity}`);
  }, []);

  const handleLayerStyleChange = useCallback((layerId: string, styleChanges: any) => {
    setBoundaryLayers(prev =>
      prev.map(layer =>
        layer.id === layerId
          ? { ...layer, style: { ...layer.style, ...styleChanges } }
          : layer
      )
    );

    // Update administrative boundaries
    setBoundaryLayers(prev => {
      const visibleLayers = prev.filter(layer => layer.visible);
      setAdministrativeBoundaries(visibleLayers.map(layer => ({
        feature: layer.boundary.feature,
        visible: layer.visible,
        style: {
          strokeColor: layer.style.strokeColor,
          strokeWidth: layer.style.strokeWidth,
          strokeOpacity: layer.opacity,
          fillColor: layer.style.fillColor,
          fillOpacity: layer.style.fillOpacity * layer.opacity
        }
      })));
      return prev;
    });

    console.log(`🎨 Layer ${layerId} style updated:`, styleChanges);
  }, []);

  const handleLayerRemove = useCallback((layerId: string) => {
    setBoundaryLayers(prev => {
      const updated = prev.filter(layer => layer.id !== layerId);

      // Update administrative boundaries
      const visibleLayers = updated.filter(layer => layer.visible);
      setAdministrativeBoundaries(visibleLayers.map(layer => ({
        feature: layer.boundary.feature,
        visible: layer.visible,
        style: {
          strokeColor: layer.style.strokeColor,
          strokeWidth: layer.style.strokeWidth,
          strokeOpacity: layer.opacity,
          fillColor: layer.style.fillColor,
          fillOpacity: layer.style.fillOpacity * layer.opacity
        }
      })));

      return updated;
    });

    console.log(`🗑️ Layer ${layerId} removed`);
  }, []);

  const handleAddNewBoundary = useCallback(() => {
    // This will trigger the address search panel to open boundaries tab
    console.log('➕ Add new boundary requested');
    // We can implement this later to programmatically open the search panel
  }, []);

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
      <div className={`w-full h-full flex items-center justify-center ${colors.bg.secondary} text-white`}>
        <div className="text-center">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p className="text-white">{t('loadingStates.loadingTranslations')}</p>
        </div>
      </div>
    );
  }
  return (
    <PolygonSystemProvider initialRole="citizen">
      <div className={`w-full h-full flex flex-col ${colors.bg.secondary} text-white`}>
      {/* HEADER SECTION */}
      <header className={`${colors.bg.primary} ${quick.separatorH} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
              <Globe className={iconSizes.lg} />
              {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">
              {t('subtitle')} ({t('phases.foundation')})
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Phase 2.3: Alert Management Dashboard */}
            <button
              onClick={() => setShowAlertDashboard(!showAlertDashboard)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                showAlertDashboard
                  ? `${colors.bg.warning} text-white`
                  : `${colors.bg.hover} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
              }`}
            >
              <AlertCircle className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('alertDashboard.title')}</span>
            </button>

            {/* Phase 2.2: Show Floor Plan Upload ONLY for Professional/Technical users */}
            {(isProfessional || isTechnical) && (
              <FloorPlanUploadButton onClick={handleFloorPlanUploadClick} />
            )}

            <div className={`px-3 py-1 ${colors.bg.success} rounded-full text-xs`}>
              {t('phases.transformation')}
            </div>
            <div className={`px-3 py-1 ${colors.bg.info} rounded-full text-xs`}>
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
          <nav className={`${colors.bg.primary} ${quick.separatorH} p-3`} role="toolbar">
            <ul className="flex items-center space-x-4 list-none">
              <li className="flex items-center space-x-2">
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
                  className={`${colors.bg.hover} ${quick.input} px-3 py-1 text-sm`}
                >
                  <option value="georeferencing">{t('views.georeferencing')}</option>
                  <option value="foundation">{t('views.foundation')}</option>
                  <option disabled>{t('views.mapping')}</option>
                  <option disabled>Split View ({t('phases.ui')})</option>
                </select>
              </li>

              <li className="flex items-center space-x-2">
                <span className="text-gray-400">{t('toolbar.crs')}</span>
                <select className={`${colors.bg.hover} ${quick.input} px-3 py-1 text-sm`}>
                  <option>{t('coordinateSystems.epsg4326')}</option>
                  <option>{t('coordinateSystems.epsg2100')}</option>
                  <option>UTM 34N (EPSG:32634)</option>
                </select>
              </li>
            </ul>
          </nav>

          {/* 🖥️ MAIN CONTENT - Canvas/Map Area */}
          <div className={`flex-1 ${colors.bg.backgroundSecondary} relative`}>
            {activeView === 'foundation' && (
              /* Phase 1: Foundation Display */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-4xl p-8 w-full">
                  <div className="flex justify-center mb-6">
                    <Globe className="w-32 h-32 text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-blue-400">
                    {t('title')}
                  </h2>
                  <p className="text-xl text-gray-400 mb-8">
                    {t('subtitle')}
                  </p>

                  {/* Phase 2.2: User Type Selector */}
                  <div className="mb-8">
                    <ComponentErrorBoundary componentName="UserTypeSelector">
                      <UserTypeSelector
                        currentType={user?.userType}
                        onSelect={handleUserTypeSelect}
                      />
                    </ComponentErrorBoundary>

                    {/* Reset Button - If user already selected type */}
                    {user?.userType && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => {
                            // ✅ ENTERPRISE: Clear user type by setting to a valid empty state
                            window.location.reload(); // Reload to reset all user state
                          }}
                          className={`px-4 py-2 ${colors.bg.muted} text-white rounded-md text-sm flex items-center gap-2 ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.FAST_COLORS}`}
                        >
                          <RefreshCcw className={iconSizes.sm} />
                          {t('userActions.changeUserType')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 text-left">
                    <div className={`${colors.bg.primary} p-6 rounded-lg`}>
                      <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
                        <CheckCircle className={iconSizes.md} />
                        Phase 1 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>{isLoading ? '• Δομή θεμελίων' : t('phaseDetails.phase1Features.foundationStructure')}</li>
                        <li>{isLoading ? '• Σύστημα τύπων Enterprise' : t('phaseDetails.phase1Features.enterpriseTypeSystem')}</li>
                        <li>{isLoading ? '• Ρύθμιση διαμόρφωσης' : t('phaseDetails.phase1Features.configurationSetup')}</li>
                        <li>{isLoading ? '• Ενσωμάτωση router έτοιμη' : t('phaseDetails.phase1Features.routerIntegrationReady')}</li>
                      </ul>
                    </div>

                    <div className={`${colors.bg.primary} p-6 rounded-lg`}>
                      <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
                        <CheckCircle className={iconSizes.md} />
                        Phase 2 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>{isLoading ? '• Μηχανή μετασχηματισμού DXF' : t('phaseDetails.phase2Features.dxfTransformationEngine')}</li>
                        <li>{isLoading ? '• Υποστήριξη συστήματος συντεταγμένων' : t('phaseDetails.phase2Features.coordinateSystemSupport')}</li>
                        <li>{isLoading ? '• Εργαλεία γεωαναφοράς' : t('phaseDetails.phase2Features.georeferencingTools')}</li>
                        <li>{isLoading ? '• Διαχείριση σημείων ελέγχου' : t('phaseDetails.phase2Features.controlPointManagement')}</li>
                      </ul>
                    </div>
                  </div>

                  {/* Architecture Overview */}
                  <div className={`mt-8 p-6 ${colors.bg.primary} rounded-lg`}>
                    <h3 className="text-lg font-semibold mb-4 text-blue-400 flex items-center gap-2">
                      <Construction className={iconSizes.md} />
                      {isLoading ? 'Επισκόπηση Αρχιτεκτονικής' : t('phaseDetails.architectureOverview.title')}
                    </h3>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p>
                        <strong>{isLoading ? 'Κεντρικοποιημένο Σύστημα: Ενσωματωμένο στο οικοσύστημα DXF Viewer' : t('phaseDetails.architectureOverview.centralizedSystem')}</strong>
                      </p>
                      <p>
                        <strong>{isLoading ? 'Στοίβα Τεχνολογίας: React + TypeScript + MapLibre GL JS' : t('phaseDetails.architectureOverview.technologyStack')}</strong>
                      </p>
                      <p>
                        <strong>{isLoading ? 'Ροή Δεδομένων: DXF → Μετασχηματισμός → GeoJSON → Χάρτης → Ειδοποιήσεις' : t('phaseDetails.architectureOverview.dataFlow')}</strong>
                      </p>
                      <p>
                        <strong>{isLoading ? 'Πρότυπα: ISO 19107, OGC, συμβάσεις AutoCAD' : t('phaseDetails.architectureOverview.standards')}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'georeferencing' && (
              /* Phase 3: Interactive MapLibre GL JS Workspace */
              <div className="absolute inset-0">
                <ComponentErrorBoundary componentName="InteractiveMap">
                  <InteractiveMap
                    className="w-full h-full"
                    onCoordinateClick={handleCoordinateClick}
                    showControlPoints={true}
                    showTransformationPreview={true}
                    isPickingCoordinates={controlPoints.pickingState === 'picking-geo'}
                    transformState={transformState}
                    enablePolygonDrawing={true}
                    searchMarker={searchMarker}
                    administrativeBoundaries={administrativeBoundaries}
                    onPolygonComplete={() => {
                      console.log('🎯 Polygon completed');
                    }}
                    onMapReady={(map) => {
                      console.log('🗺️ Map ready - storing reference');
                      mapRef.current = map;
                  }}
                  />
                </ComponentErrorBoundary>

                {/* 🗺️ FLOOR PLAN CANVAS LAYER */}
                {floorPlanUpload.result && floorPlanUpload.result.success && (
                  <FloorPlanCanvasLayer
                    map={mapRef.current}
                    floorPlan={floorPlanUpload.result}
                    visible={floorPlanVisible}
                    style={canvasUtilities.geoInteractive.floorPlanOverlay(
                      floorPlanOpacity,
                      '#000000', // Μαύρο χρώμα
                      2
                    )}
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
                    style={canvasUtilities.overlays.controls.topRight}
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

                {/* CONTROL POINT PICKER (STEP 2.2) */}
                {floorPlanUpload.result && floorPlanUpload.result.success && (isProfessional || isTechnical) && (
                  <div
                    style={canvasUtilities.geoInteractive.draggablePanelContainer(
                      { x: 16, y: 16 },
                      false,
                      200
                    )}
                  >
                    <FloorPlanControlPointPicker controlPoints={controlPoints} />
                  </div>
                )}

                {/* 🏘️ CITIZEN DRAWING INTERFACE (Phase 2.2.2) */}
                {isCitizen && (
                  <div
                    style={canvasUtilities.geoInteractive.draggablePanelContainer(
                      { x: 16, y: 16 },
                      false,
                      200
                    )}
                  >
                    <CitizenDrawingInterface
                      mapRef={mapRef}
                      onPolygonComplete={(polygon) => {
                        console.log('🏘️ Citizen polygon completed:', polygon);
                        // TODO: Integrate με alert system
                      }}
                      onLocationSelected={handleLocationSelected}
                      onAdminBoundarySelected={handleAdminBoundarySelected}
                      boundaryLayers={boundaryLayers}
                      onLayerToggle={handleLayerToggle}
                      onLayerOpacityChange={handleLayerOpacityChange}
                      onLayerStyleChange={handleLayerStyleChange}
                      onLayerRemove={handleLayerRemove}
                      onAddNewBoundary={handleAddNewBoundary}
                    />
                  </div>
                )}

                {/* 🏢 PROFESSIONAL DRAWING INTERFACE (Phase 2.2.3) */}
                {isProfessional && (
                  <div
                    style={canvasUtilities.geoInteractive.draggablePanelContainer(
                      { x: 16, y: 16 },
                      false,
                      200
                    )}
                  >
                    <ProfessionalDrawingInterface
                      mapRef={mapRef}
                      onPolygonComplete={(polygon) => {
                        console.log('🏢 Professional polygon completed:', polygon);
                        // TODO: Integrate με alert system
                      }}
                      onFloorPlanUploaded={(floorPlan) => {
                        console.log('📁 Professional floor plan uploaded:', floorPlan);
                        // TODO: Integrate με georeferencing system
                      }}
                    />
                  </div>
                )}

                {/* 🛠️ TECHNICAL DRAWING INTERFACE (Phase 2.2.4) */}
                {isTechnical && (
                  <div
                    style={canvasUtilities.geoInteractive.draggablePanelContainer(
                      { x: 16, y: 16 },
                      false,
                      200
                    )}
                  >
                    <TechnicalDrawingInterface
                      mapRef={mapRef}
                      onPolygonComplete={(polygon) => {
                        console.log('🛠️ Technical polygon completed:', polygon);
                        // TODO: Integrate με alert system και DXF precision system
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR - System Status */}
        <aside className={`w-80 ${colors.bg.primary} ${quick.separatorV} p-4`}>
          <div className="space-y-6">
            {/* Phase Progress */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                {t('sidebar.phaseProgress.title')}
              </h3>
              <div className="space-y-3">
                <div className={`p-3 ${colors.bg.success}/20 ${quick.card} ${getStatusBorder('success')}`}>
                  <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase1Title')}</div>
                  <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase1Description')}</div>
                </div>
                <div className={`p-3 ${colors.bg.success}/20 ${quick.card} ${getStatusBorder('success')}`}>
                  <div className="text-sm font-medium text-green-300">{t('sidebar.phaseProgress.phase2Title')}</div>
                  <div className="text-xs text-green-400">{t('sidebar.phaseProgress.phase2Description')}</div>
                </div>
                <div className={`p-3 ${colors.bg.hover} rounded`}>
                  <div className="text-sm font-medium text-yellow-400">{t('sidebar.phaseProgress.phase3Title')}</div>
                  <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase3Description')}</div>
                </div>
                <div className={`p-3 ${colors.bg.hover} rounded`}>
                  <div className="text-sm font-medium text-gray-400">{t('sidebar.phaseProgress.phase4Title')}</div>
                  <div className="text-xs text-gray-400">{t('sidebar.phaseProgress.phase4Description')}</div>
                </div>
                <div className={`p-3 ${colors.bg.hover} rounded`}>
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
              <ul className="space-y-2 text-sm list-none">
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.controlPointManagement')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.affineTransformation')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.accuracyValidation')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.spatialDistributionAnalysis')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.rmsErrorCalculation')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={`${iconSizes.xs} ${colors.bg.success} rounded-full`} aria-hidden="true"></span>
                  <span>{t('sidebar.availableFeatures.coordinateTransformation')}</span>
                </li>
              </ul>
            </section>

            {/* Technical Specs */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                {t('sidebar.technicalSpecs.title')}
              </h3>
              <dl className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <dt>{t('sidebar.technicalSpecs.transformation')}</dt>
                  <dd className="text-blue-300">{t('sidebar.technicalSpecs.transformationValue')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('sidebar.technicalSpecs.accuracy')}</dt>
                  <dd className="text-green-300">{t('sidebar.technicalSpecs.accuracyValue')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('sidebar.technicalSpecs.crsSupport')}</dt>
                  <dd className="text-purple-300">{t('sidebar.technicalSpecs.crsSupportValue')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('sidebar.technicalSpecs.mathEngine')}</dt>
                  <dd className="text-yellow-300">{t('sidebar.technicalSpecs.mathEngineValue')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('sidebar.technicalSpecs.standards')}</dt>
                  <dd className="text-blue-300">{t('sidebar.technicalSpecs.standardsValue')}</dd>
                </div>
              </dl>
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
      <footer className={`${colors.bg.primary} ${quick.separatorH} p-3`}>
        <nav className="flex items-center justify-between text-sm">
          <ul className="flex items-center space-x-4 list-none">
            <li className="text-green-400">● {t('footer.status.active')}</li>
            <li className="text-green-400">{t('footer.status.phase2DxfTransformation')}</li>
            <li className="text-blue-400">{t('footer.status.georeferencingReady')}</li>
          </ul>

          <section className="flex items-center space-x-4">
            <span className="text-gray-400">
              {t('sidebar.technicalSpecs.standardsValue')} | OGC Standards | {t('sidebar.technicalSpecs.mathEngineValue')}
            </span>
            <span className="text-blue-400 flex items-center gap-2">
              <Globe className={iconSizes.sm} />
              Pagonis-Nestor Geo-Canvas v2.0
            </span>
          </section>
        </nav>
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

      {/* 🚨 ALERT MANAGEMENT DASHBOARD (Phase 2.3) */}
      {showAlertDashboard && (
        <div
          style={canvasUtilities.geoInteractive.fixedSidebarPanel('right', '480px')}
        >
          <ComponentErrorBoundary componentName="AlertManagementPanel">
            <AlertManagementPanel
              onClose={() => setShowAlertDashboard(false)}
              className="shadow-2xl"
            />
          </ComponentErrorBoundary>
        </div>
      )}

      {/* 🛠️ DEVELOPMENT ERROR REPORTING DASHBOARD */}
      <ErrorReportingDashboard position="bottom-right" minimized={true} />
    </div>
    </PolygonSystemProvider>
  );
}

// **🛡️ ENTERPRISE ERROR BOUNDARY WRAPPER**
// Wrap το GeoCanvasContent με PageErrorBoundary για enterprise error handling
const GeoCanvasContentWithErrorBoundary = (props: GeoCanvasAppProps) => (
  <PageErrorBoundary
    componentName="GeoCanvasContent"
    enableRetry={true}
    maxRetries={2}
    enableReporting={true}
    onError={(error, errorInfo, errorId) => {
      // ✅ ENTERPRISE FIX: Defer error logging to avoid setState during render
      setTimeout(() => {
        console.error('GEO-ALERT Error Captured:', {
          errorId,
          component: 'GeoCanvasContent',
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        });
      }, 0);
    }}
  >
    <GeoCanvasContent {...props} />
  </PageErrorBoundary>
);

// Export το wrapped component
export default GeoCanvasContentWithErrorBoundary;