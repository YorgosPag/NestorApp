'use client';

/**
 * CITIZEN DRAWING INTERFACE
 *
 * Simple interface for citizens with drawing tools:
 * - Point Alert, Simple Polygon, Freehand Drawing, Real Estate Alerts
 * Mobile-first design with touch-friendly buttons
 *
 * Split (ADR-065 Phase 3, #16):
 * - citizen-drawing-types.ts — Types, mocks
 * - RealEstateSetupPanel.tsx — Real estate setup dialog
 */

import * as React from 'react';
const { useState, useCallback, useEffect } = React;

import { MapPin, Hexagon, Hand, Trash2, Check, X, Search, Building2, Settings } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { GEO_COLORS } from '../config/color-config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { RealEstateSetupPanel } from './RealEstateSetupPanel';
import type { RealEstateSettings } from './RealEstateSetupPanel';
import type {
  MapboxMap,
  RealEstatePolygon,
  PolygonPoint,
  BoundaryLayer,
} from './citizen-drawing-types';
import {
  HOVER_BACKGROUND_EFFECTS,
  HOVER_SHADOWS,
  TRANSITION_PRESETS,
  AddressSearchPanel,
  AdminBoundaryDemo,
  BoundaryLayerControlPanel,
  useCentralizedPolygonSystem,
  useMockRealEstateService,
} from './citizen-drawing-types';

interface CitizenDrawingInterfaceProps {
  mapRef: React.RefObject<MapboxMap | null>;
  onPolygonComplete?: (polygon: RealEstatePolygon) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
  onLocationSelected?: (lat: number, lng: number, address?: Record<string, unknown>) => void;
  onAdminBoundarySelected?: (boundary: GeoJSON.Feature | GeoJSON.FeatureCollection, result: Record<string, unknown>) => void;
  boundaryLayers?: BoundaryLayer[];
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onLayerStyleChange?: (layerId: string, style: Partial<BoundaryLayer['style']>) => void;
  onLayerRemove?: (layerId: string) => void;
  onAddNewBoundary?: () => void;
}

export function CitizenDrawingInterface({
  mapRef,
  onPolygonComplete,
  onRealEstateAlertCreated,
  onLocationSelected,
  onAdminBoundarySelected,
  boundaryLayers = [],
  onLayerToggle,
  onLayerOpacityChange,
  onLayerStyleChange,
  onLayerRemove,
  onAddNewBoundary
}: CitizenDrawingInterfaceProps) {
  const { t } = useTranslationLazy('geo-canvas');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const [selectedTool, setSelectedTool] = useState<'point' | 'polygon' | 'freehand' | 'real-estate' | null>(null);
  const [pointRadius, setPointRadius] = useState<number>(100);
  const [lastPointPolygonId, setLastPointPolygonId] = useState<string | null>(null);
  const [showAdminDemo, setShowAdminDemo] = useState(false);
  const [showBoundaryControl, setShowBoundaryControl] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [showRealEstateSetup, setShowRealEstateSetup] = useState(false);

  const {
    polygons, stats, startDrawing, finishDrawing, cancelDrawing,
    clearAll, isDrawing, updatePolygonConfig
  } = useCentralizedPolygonSystem();

  const [realEstateSettings, setRealEstateSettings] = useState<RealEstateSettings>({
    priceRange: {
      min: parseInt(process.env.NEXT_PUBLIC_CITIZEN_PRICE_MIN || '50000'),
      max: parseInt(process.env.NEXT_PUBLIC_CITIZEN_PRICE_MAX || '500000')
    },
    propertyTypes: ['apartment'],
    includeExclude: 'include'
  });

  const { addRealEstatePolygon, getStatistics } = useMockRealEstateService();
  const realEstateStats = getStatistics();

  // --- HANDLERS ---

  const handleRealEstateAlertComplete = useCallback((polygon: RealEstatePolygon) => {
    const realEstatePolygon: RealEstatePolygon = {
      ...polygon,
      type: 'real-estate',
      alertSettings: {
        enabled: true,
        priceRange: realEstateSettings.priceRange,
        propertyTypes: realEstateSettings.propertyTypes,
        includeExclude: realEstateSettings.includeExclude
      }
    };
    addRealEstatePolygon(realEstatePolygon);
    onRealEstateAlertCreated?.(realEstatePolygon);
    setShowRealEstateSetup(false);
  }, [realEstateSettings, addRealEstatePolygon, onRealEstateAlertCreated]);

  const handleToolSelect = useCallback((tool: 'point' | 'polygon' | 'freehand' | 'real-estate') => {
    if (isDrawing) cancelDrawing();
    setSelectedTool(tool);

    const toolConfigs = {
      point: { fillColor: GEO_COLORS.withOpacity(GEO_COLORS.USER_INTERFACE.CITIZEN_STROKE, 0.2), strokeColor: GEO_COLORS.USER_INTERFACE.CITIZEN_STROKE, strokeWidth: 2, pointMode: true, radius: pointRadius },
      polygon: { fillColor: GEO_COLORS.USER_INTERFACE.CITIZEN_POLYGON_FILL, strokeColor: GEO_COLORS.USER_INTERFACE.CITIZEN_POLYGON_STROKE, strokeWidth: 2 },
      freehand: { fillColor: GEO_COLORS.USER_INTERFACE.CITIZEN_AREA_FILL, strokeColor: GEO_COLORS.USER_INTERFACE.CITIZEN_AREA_STROKE, strokeWidth: 2 },
    };

    if (tool === 'real-estate') {
      setShowRealEstateSetup(true);
    } else {
      startDrawing('simple', toolConfigs[tool]);
    }
  }, [isDrawing, startDrawing, cancelDrawing, pointRadius]);

  const handleComplete = useCallback(() => {
    const polygon = finishDrawing();
    if (polygon) {
      const converted: RealEstatePolygon = {
        id: polygon.id,
        polygon: polygon.points.map((p: PolygonPoint) => [p.lat ?? p.x ?? 0, p.lng ?? p.y ?? 0] as [number, number]),
        settings: {},
        createdAt: new Date().toISOString(),
        ...(selectedTool === 'real-estate' ? { type: 'real-estate' } : {})
      };
      if (selectedTool === 'real-estate') handleRealEstateAlertComplete(converted);
      else onPolygonComplete?.(converted);
    }
    setSelectedTool(null);
    setLastPointPolygonId(null);
  }, [finishDrawing, selectedTool, onPolygonComplete, handleRealEstateAlertComplete]);

  const handleCancel = useCallback(() => {
    cancelDrawing();
    setSelectedTool(null);
    setLastPointPolygonId(null);
  }, [cancelDrawing]);

  const handleClearAll = useCallback(() => { clearAll(); }, [clearAll]);

  const handleLocationFromSearch = useCallback((lat: number, lng: number, address?: Record<string, unknown>) => {
    setShowAddressSearch(false);
    onLocationSelected?.(lat, lng, address);
  }, [onLocationSelected]);

  // Track point mode polygons for radius updates
  useEffect(() => {
    const pointPolygon = polygons
      .filter(p => p.config?.pointMode === true && p.points.length === 1)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))[0];
    if (pointPolygon && pointPolygon.id !== lastPointPolygonId) {
      setLastPointPolygonId(pointPolygon.id);
    }
  }, [polygons, lastPointPolygonId]);

  useEffect(() => {
    if (lastPointPolygonId && selectedTool === 'point') {
      updatePolygonConfig(lastPointPolygonId, { radius: pointRadius });
    }
  }, [lastPointPolygonId, pointRadius, selectedTool, updatePolygonConfig]);

  const handleRealEstateStartDrawing = useCallback(() => {
    startDrawing('simple', {
      fillColor: GEO_COLORS.USER_INTERFACE.EMERGENCY_FILL,
      strokeColor: GEO_COLORS.USER_INTERFACE.EMERGENCY_STROKE,
      strokeWidth: 2
    });
    setSelectedTool('real-estate');
    setShowRealEstateSetup(false);
  }, [startDrawing]);

  // --- RENDER HELPERS ---

  const toolButton = (tool: 'point' | 'polygon' | 'freehand' | 'real-estate', icon: React.ReactNode, label: string, desc: string, isWarning = false) => (
    <button
      onClick={() => handleToolSelect(tool)}
      disabled={isDrawing && selectedTool !== tool}
      className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px]
        ${selectedTool === tool
          ? `${getStatusBorder(isWarning ? 'warning' : 'info')} ${isWarning ? colors.bg.warning : colors.bg.info}`
          : `${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`}
        ${isDrawing && selectedTool !== tool ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-xs ${colors.text.muted}`}>{desc}</span>
    </button>
  );

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow-lg p-4`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>{t('drawingInterfaces.citizen.title')}</h3>
            <p className={`text-sm ${colors.text.muted}`}>{t('drawingInterfaces.citizen.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowAddressSearch(!showAddressSearch)}
            className={`flex items-center gap-2 px-3 py-2 ${quick.card} transition-all ${showAddressSearch ? `${getStatusBorder('info')} ${colors.bg.info} ${colors.text.info}` : `${colors.bg.primary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}`}
          >
            <Search className={iconSizes.sm} />
          </button>
        </div>
      </div>

      {showAddressSearch && (
        <div className="mb-4">
          <AddressSearchPanel
            onLocationSelected={(lat, lng, address) => handleLocationFromSearch(lat, lng, address as Record<string, unknown>)}
            onAdminBoundarySelected={(boundary, result) => onAdminBoundarySelected?.(boundary, result as Record<string, unknown>)}
            onClose={() => setShowAddressSearch(false)}
          />
        </div>
      )}

      {/* Tool Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {toolButton('point', <MapPin className={`${iconSizes.xl} mb-2 ${colors.text.info}`} />, t('drawingInterfaces.citizen.tools.point'), t('drawingInterfaces.citizen.tools.pointDescription'))}
        {toolButton('polygon', <Hexagon className={`${iconSizes.xl} mb-2 ${colors.text.success}`} />, t('drawingInterfaces.citizen.tools.polygon'), t('drawingInterfaces.citizen.tools.polygonDescription'))}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {toolButton('freehand', <Hand className={`${iconSizes.xl} mb-2 ${colors.text.accent}`} />, t('drawingInterfaces.citizen.tools.freehand'), t('drawingInterfaces.citizen.tools.freehandDrawing'))}
        {toolButton('real-estate', <NAVIGATION_ENTITIES.property.icon className={`${iconSizes.xl} mb-2 ${NAVIGATION_ENTITIES.property.color}`} />, t('drawingInterfaces.citizen.tools.realEstate'), t('drawingInterfaces.citizen.tools.realEstateDescription'), true)}
      </div>

      {/* Utility Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { onClick: () => setShowAddressSearch(!showAddressSearch), active: showAddressSearch, icon: <Search className={`${iconSizes.xl} mb-2 text-indigo-600`} />, label: t('drawingInterfaces.citizen.tools.addressSearch'), isLayerControl: false, status: 'info' },
          { onClick: () => setShowAdminDemo(!showAdminDemo), active: showAdminDemo, icon: <Building2 className={`${iconSizes.xl} mb-2 text-violet-600`} />, label: t('drawingInterfaces.citizen.tools.boundariesDemo'), isLayerControl: false, status: 'info' },
          { onClick: () => setShowBoundaryControl(!showBoundaryControl), active: showBoundaryControl, icon: <Settings className={`${iconSizes.xl} mb-2 text-emerald-600`} />, label: t('drawingInterfaces.citizen.tools.layerControl'), isLayerControl: true, status: 'success' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.onClick} className={`flex flex-col items-center justify-center p-4 ${quick.card} transition-all duration-200 min-h-[100px] ${btn.active ? `${getStatusBorder(btn.status as 'info' | 'success')} ${colors.bg[btn.status as 'info' | 'success']}/10` : `${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`} cursor-pointer ${HOVER_SHADOWS.ENHANCED}`}>
            {btn.icon}
            <span className="text-sm font-medium">{btn.label}</span>
            {btn.isLayerControl && <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.citizen.tools.layersCount', { count: boundaryLayers.length })}</span>}
          </button>
        ))}
      </div>

      {/* Point Radius Selector */}
      {selectedTool === 'point' && (
        <div className={`mb-4 p-3 ${colors.bg.info} ${quick.card}`}>
          <h4 className={`text-sm font-medium ${colors.text.info} mb-3`}>{t('drawingInterfaces.citizen.tools.pointDescription')}</h4>
          {[50, 100, 250, 500, 1000, 2000].map((radius) => (
            <button key={radius} onClick={() => setPointRadius(radius)}
              className={`inline-block m-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${pointRadius === radius ? `${colors.bg.info} ${colors.text.foreground} shadow-md` : `${colors.bg.primary} ${colors.text.info} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}`}>
              {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {isDrawing && (
        <div className="flex gap-2 mb-4">
          <button onClick={handleComplete} className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-3 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.SUCCESS} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <Check className={iconSizes.md} /><span className="font-medium">{t('drawingInterfaces.citizen.actions.complete')}</span>
          </button>
          <button onClick={handleCancel} className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.error} ${colors.text.foreground} py-3 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.DESTRUCTIVE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <X className={iconSizes.md} /><span className="font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
          </button>
        </div>
      )}

      {showRealEstateSetup && (
        <RealEstateSetupPanel settings={realEstateSettings} onSettingsChange={setRealEstateSettings} onStartDrawing={handleRealEstateStartDrawing} onClose={() => setShowRealEstateSetup(false)} />
      )}

      {polygons.length > 0 && !isDrawing && (
        <button onClick={handleClearAll} className={`w-full flex items-center justify-center gap-2 ${colors.bg.hover} ${colors.text.muted} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
          <Trash2 className={iconSizes.sm} /><span className="text-sm">{t('drawingInterfaces.citizen.actions.clearAll')} ({polygons.length})</span>
        </button>
      )}

      {selectedTool && (
        <div className={`mt-4 p-3 ${colors.bg.info} ${quick.card}`}>
          <p className={`text-sm ${colors.text.info}`}>
            {selectedTool === 'point' && t('instructions.citizen.placePoint')}
            {selectedTool === 'polygon' && t('instructions.citizen.addPolygonPoints')}
            {selectedTool === 'freehand' && t('instructions.citizen.drawFreehand')}
            {selectedTool === 'real-estate' && t('drawingInterfaces.citizen.instructions.realEstate')}
          </p>
        </div>
      )}

      {(stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md space-y-1`}>
          {stats.totalPolygons > 0 && <p className={`text-xs ${colors.text.muted}`}>{stats.totalPolygons}</p>}
          {realEstateStats.totalAlerts > 0 && <p className={`text-xs ${colors.text.warning}`}>{realEstateStats.totalAlerts}</p>}
        </div>
      )}

      {showAdminDemo && <div className="mt-4"><AdminBoundaryDemo /></div>}
      {showBoundaryControl && (
        <div className="mt-4">
          <BoundaryLayerControlPanel layers={boundaryLayers} onLayerToggle={onLayerToggle || (() => {})} onLayerOpacityChange={onLayerOpacityChange || (() => {})} onLayerStyleChange={onLayerStyleChange || (() => {})} onLayerRemove={onLayerRemove || (() => {})} onAddNewBoundary={onAddNewBoundary || (() => {})} />
        </div>
      )}
    </div>
  );
}
