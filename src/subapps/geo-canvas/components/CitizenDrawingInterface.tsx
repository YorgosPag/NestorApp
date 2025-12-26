'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X, Bell, Home, Search } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { RealEstatePolygon } from '@geo-alert/core';
import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS, HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';

// ✅ NEW: Enterprise Centralized Polygon System
import { useCentralizedPolygonSystem } from '../systems/polygon-system';

// ✅ NEW: Address Search Integration
import { AddressSearchPanel } from './AddressSearchPanel';
import { AdminBoundaryDemo } from './AdminBoundaryDemo';
import { BoundaryLayerControlPanel } from './BoundaryLayerControlPanel';
import type { GreekAddress } from '@/services/real-estate-monitor/AddressResolver';
import type { BoundaryLayer } from './BoundaryLayerControlPanel';

interface CitizenDrawingInterfaceProps {
  mapRef: React.RefObject<any>;
  onPolygonComplete?: (polygon: any) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
  onLocationSelected?: (lat: number, lng: number, address?: GreekAddress) => void;
  onAdminBoundarySelected?: (boundary: GeoJSON.Feature | GeoJSON.FeatureCollection, result: any) => void;

  // ✅ NEW: Boundary Layer Control Props
  boundaryLayers?: BoundaryLayer[];
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onLayerStyleChange?: (layerId: string, style: Partial<BoundaryLayer['style']>) => void;
  onLayerRemove?: (layerId: string) => void;
  onAddNewBoundary?: () => void;
}

/**
 * 🏢 GEO-ALERT Phase 2.5.3: Enhanced Citizen Drawing Interface
 *
 * Simple interface για πολίτες με βασικά εργαλεία:
 * - Point Alert (πινέζα στο χάρτη)
 * - Simple Polygon (χειροκίνητο περίγραμμα)
 * - Freehand Drawing (ελεύθερο σχέδιο)
 * - 🏠 Real Estate Alerts (Phase 2.5.3 Enhancement)
 *
 * Mobile-first design με μεγάλα touch-friendly buttons
 * Integration με automated real estate monitoring system
 */
export function CitizenDrawingInterface({
  mapRef,
  onPolygonComplete,
  onRealEstateAlertCreated,
  onLocationSelected,
  onAdminBoundarySelected,

  // ✅ NEW: Boundary Layer Control Props
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
  const [pointRadius, setPointRadius] = useState<number>(100); // Default 100m radius
  const [lastPointPolygonId, setLastPointPolygonId] = useState<string | null>(null);

  // ✅ NEW: Demo component state
  const [showAdminDemo, setShowAdminDemo] = useState<boolean>(false);

  // ✅ NEW: Boundary layer control state
  const [showBoundaryControl, setShowBoundaryControl] = useState<boolean>(false);

  // ✅ NEW: Centralized Polygon System (replaces dual-system complexity)
  const {
    polygons,
    stats,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    clearAll,
    isDrawing,
    currentRole,
    updatePolygonConfig
  } = useCentralizedPolygonSystem();

  // 🏠 Phase 2.5.3: Real Estate Integration
  const [showRealEstateSetup, setShowRealEstateSetup] = useState(false);
  const [realEstateSettings, setRealEstateSettings] = useState({
    priceRange: {
      min: parseInt(process.env.NEXT_PUBLIC_CITIZEN_PRICE_MIN || '50000'),
      max: parseInt(process.env.NEXT_PUBLIC_CITIZEN_PRICE_MAX || '500000')
    },
    propertyTypes: ['apartment'] as string[],
    includeExclude: 'include' as 'include' | 'exclude'
  });

  // 🔍 NEW: Address Search Integration
  const [showAddressSearch, setShowAddressSearch] = useState(false);

  // Real Estate Monitoring Integration
  const {
    addRealEstatePolygon,
    getRealEstateAlerts,
    getStatistics
  } = useRealEstateMatching();

  // ✅ ENTERPRISE FIX: Get statistics as object, not function
  const realEstateStats = getStatistics();

  // Handle real estate alert creation
  const handleRealEstateAlertComplete = useCallback((polygon: any) => {
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

    // Add to monitoring system
    addRealEstatePolygon(realEstatePolygon);

    // Notify parent component
    if (onRealEstateAlertCreated) {
      onRealEstateAlertCreated(realEstatePolygon);
    }

    console.log('🏠 Citizen: Real estate alert created', realEstatePolygon);
    setShowRealEstateSetup(false);
  }, [realEstateSettings, addRealEstatePolygon, onRealEstateAlertCreated]);

  // ✅ NEW: Simplified tool selection handler (centralized system)
  const handleToolSelect = useCallback((tool: 'point' | 'polygon' | 'freehand' | 'real-estate') => {
    if (isDrawing) {
      // Cancel current drawing using centralized system
      cancelDrawing();
    }

    setSelectedTool(tool);

    // Start appropriate drawing mode
    switch (tool) {
      case 'point':
        // Point mode - pin/marker με ακτίνα
        // Θα δημιουργήσουμε ένα point marker με radius circle
        startDrawing('simple', {
          fillColor: `rgba(59, 130, 246, 0.2)`, // Light blue fill για το radius circle
          strokeColor: '#3b82f6',
          strokeWidth: 2,
          pointMode: true,
          radius: pointRadius
        });
        break;

      case 'polygon':
        // Simple polygon mode using centralized system
        startDrawing('simple', {
          fillColor: 'rgba(59, 130, 246, 0.3)', // Blue fill
          strokeColor: '#3b82f6',
          strokeWidth: 2
        });
        console.log('🔷 Citizen: Polygon mode started');
        break;

      case 'freehand':
        // Freehand drawing mode using centralized system
        startDrawing('freehand', {
          fillColor: 'rgba(16, 185, 129, 0.3)', // Green fill
          strokeColor: '#10b981',
          strokeWidth: 2
        });
        console.log('✏️ Citizen: Freehand mode started');
        break;

      case 'real-estate':
        // Real estate alert mode - show setup dialog
        setShowRealEstateSetup(true);
        console.log('🏠 Citizen: Real estate alert setup opened');
        break;
    }
  }, [isDrawing, startDrawing, cancelDrawing, pointRadius]);

  // ✅ NEW: Simplified handlers using centralized system
  const handleComplete = useCallback(() => {
    const polygon = finishDrawing();
    if (polygon) {
      if (selectedTool === 'real-estate') {
        // Handle real estate alert completion
        handleRealEstateAlertComplete(polygon);
      } else if (onPolygonComplete) {
        // Handle normal polygon completion
        onPolygonComplete(polygon);
        console.log('✅ Citizen: Drawing completed', polygon);
      }
    }
    setSelectedTool(null);
    setLastPointPolygonId(null); // Clear reference when polygon is completed
  }, [finishDrawing, selectedTool, onPolygonComplete, handleRealEstateAlertComplete]);

  // Cancel drawing
  const handleCancel = useCallback(() => {
    cancelDrawing();
    setSelectedTool(null);
    setLastPointPolygonId(null); // Clear reference to last point polygon
    console.log('❌ Citizen: Drawing cancelled');
  }, [cancelDrawing]);

  // ✅ ENTERPRISE: Track point mode polygons for real-time radius updates
  useEffect(() => {
    // Find the most recent point mode polygon
    const pointPolygon = polygons
      .filter(p => p.config?.pointMode === true && p.points.length === 1)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

    if (pointPolygon && pointPolygon.id !== lastPointPolygonId) {
      setLastPointPolygonId(pointPolygon.id);
      console.log('📍 Found new point polygon for radius tracking:', pointPolygon.id);
    }
  }, [polygons, lastPointPolygonId]);

  // ✅ ENTERPRISE: Update radius in real-time when radius changes
  useEffect(() => {
    if (lastPointPolygonId && selectedTool === 'point') {
      updatePolygonConfig(lastPointPolygonId, { radius: pointRadius });
      console.log('🔄 Updated point polygon radius:', lastPointPolygonId, pointRadius);
    }
  }, [lastPointPolygonId, pointRadius, selectedTool, updatePolygonConfig]);

  // Clear all
  const handleClearAll = useCallback(() => {
    clearAll();
    console.log('🗑️ Citizen: All polygons cleared');
  }, [clearAll]);

  // ✅ NEW: Handle location selection από address search
  const handleLocationFromSearch = useCallback((lat: number, lng: number, address?: GreekAddress) => {
    console.log('📍 Location selected from search:', { lat, lng, address });

    // Close address search panel
    setShowAddressSearch(false);

    // Notify parent component (InteractiveMap) to center map
    if (onLocationSelected) {
      onLocationSelected(lat, lng, address);
    }
  }, [onLocationSelected]);

  return (
    <div className={`${colors.bg.primary} ${quick.card} shadow-lg p-4`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>
              {t('drawingInterfaces.citizen.title')}
            </h3>
            <p className={`text-sm ${colors.text.muted}`}>
              {t('drawingInterfaces.citizen.subtitle')}
            </p>
          </div>

          {/* Address Search Toggle Button */}
          <button
            onClick={() => setShowAddressSearch(!showAddressSearch)}
            className={`
              flex items-center gap-2 px-3 py-2 ${quick.card} transition-all
              ${showAddressSearch
                ? `${getStatusBorder('info')} ${colors.bg.info} ${colors.text.info}`
                : `${colors.bg.primary} ${colors.text.muted} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
              }
            `}
            title="Αναζήτηση διεύθυνσης ή GPS"
          >
            <Search className={iconSizes.sm} />
            <span className="text-sm font-medium">Αναζήτηση</span>
          </button>
        </div>
      </div>

      {/* Address Search Panel */}
      {showAddressSearch && (
        <div className="mb-4">
          <AddressSearchPanel
            onLocationSelected={handleLocationFromSearch}
            onAdminBoundarySelected={onAdminBoundarySelected}
            onClose={() => setShowAddressSearch(false)}
          />
        </div>
      )}

      {/* Tool Buttons - Large & Touch-friendly */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Point Tool */}
        <button
          onClick={() => handleToolSelect('point')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'point'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.MEDIUM}'}
          `}
        >
          <MapPin className={`${iconSizes.xl} mb-2 ${colors.text.info}`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.point')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.citizen.tools.pointDescription')}</span>
        </button>

        {/* Polygon Tool */}
        <button
          onClick={() => handleToolSelect('polygon')}
          disabled={isDrawing && selectedTool !== 'polygon'}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'polygon'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            ${isDrawing && selectedTool !== 'polygon' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.MEDIUM}'}
          `}
        >
          <Hexagon className={`${iconSizes.xl} mb-2 ${colors.text.success}`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.polygon')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.citizen.tools.polygonDescription')}</span>
        </button>
      </div>

      {/* Second Row - Advanced Tools */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Freehand Tool */}
        <button
          onClick={() => handleToolSelect('freehand')}
          disabled={isDrawing && selectedTool !== 'freehand'}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'freehand'
              ? `${getStatusBorder('info')} ${colors.bg.info}`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            ${isDrawing && selectedTool !== 'freehand' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.MEDIUM}'}
          `}
        >
          <Hand className={`${iconSizes.xl} mb-2 text-purple-600`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.freehand')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.citizen.tools.freehandDrawing')}</span>
        </button>

        {/* Real Estate Alert Tool */}
        <button
          onClick={() => handleToolSelect('real-estate')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'real-estate'
              ? `${getStatusBorder('warning')} ${colors.bg.warning}`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ${HOVER_SHADOWS.MEDIUM}'}
          `}
        >
          <Home className={`${iconSizes.xl} mb-2 ${colors.text.warning}`} />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.realEstate')}</span>
          <span className={`text-xs ${colors.text.muted}`}>{t('drawingInterfaces.citizen.tools.realEstateDescription')}</span>
        </button>
      </div>

      {/* Third Row - Testing & Utility Tools */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Address Search Button */}
        <button
          onClick={() => setShowAddressSearch(!showAddressSearch)}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${showAddressSearch
              ? `${getStatusBorder('info')} bg-indigo-50`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            cursor-pointer ${HOVER_SHADOWS.MEDIUM}
          `}
        >
          <Search className={`${iconSizes.xl} mb-2 text-indigo-600`} />
          <span className="text-sm font-medium">Address Search</span>
          <span className={`text-xs ${colors.text.muted}`}>Διευθύνσεις & Όρια</span>
        </button>

        {/* Admin Boundaries Demo Button */}
        <button
          onClick={() => setShowAdminDemo(!showAdminDemo)}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${showAdminDemo
              ? `${getStatusBorder('info')} bg-violet-50`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            cursor-pointer ${HOVER_SHADOWS.MEDIUM}
          `}
        >
          <div className={`${iconSizes.xl} mb-2 text-violet-600 font-bold text-lg`}>🏛️</div>
          <span className="text-sm font-medium">Boundaries Demo</span>
          <span className={`text-xs ${colors.text.muted}`}>Test Interface</span>
        </button>

        {/* Boundary Layer Control Button */}
        <button
          onClick={() => setShowBoundaryControl(!showBoundaryControl)}
          className={`
            flex flex-col items-center justify-center p-4 ${quick.card}
            transition-all duration-200 min-h-[100px]
            ${showBoundaryControl
              ? `${getStatusBorder('success')} bg-emerald-50`
              : `\${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.bg.primary}`
            }
            cursor-pointer ${HOVER_SHADOWS.MEDIUM}
          `}
        >
          <div className={`${iconSizes.xl} mb-2 text-emerald-600 font-bold text-lg`}>🎛️</div>
          <span className="text-sm font-medium">Layer Control</span>
          <span className="text-xs text-gray-500">
            {boundaryLayers.length} layers
          </span>
        </button>
      </div>

      {/* Point Radius Selector - Shows only when point tool is selected */}
      {selectedTool === 'point' && (
        <div className={`mb-4 p-3 ${colors.bg.info} ${quick.card}`}>
          <h4 className={`text-sm font-medium ${colors.text.info} mb-3`}>Ακτίνα Πινέζας</h4>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[50, 100, 250].map((radius) => (
              <button
                key={radius}
                onClick={() => setPointRadius(radius)}
                className={`
                  py-2 px-3 text-sm font-medium rounded-md transition-all
                  ${pointRadius === radius
                    ? `${colors.bg.info} ${colors.text.foreground} shadow-md`
                    : `${colors.bg.primary} ${colors.text.info} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  }
                `}
              >
                {radius}m
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[500, 1000, 2000].map((radius) => (
              <button
                key={radius}
                onClick={() => setPointRadius(radius)}
                className={`
                  py-2 px-3 text-sm font-medium rounded-md transition-all
                  ${pointRadius === radius
                    ? `${colors.bg.info} ${colors.text.foreground} shadow-md`
                    : `${colors.bg.primary} ${colors.text.info} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  }
                `}
              >
                {radius >= 1000 ? `${radius/1000}km` : `${radius}m`}
              </button>
            ))}
          </div>
          <div className={`mt-3 text-xs ${colors.text.info} text-center`}>
            Επιλεγμένη ακτίνα: <span className="font-semibold">{pointRadius >= 1000 ? `${pointRadius/1000}km` : `${pointRadius}m`}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isDrawing && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-3 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.SUCCESS} ${TRANSITION_PRESETS.COLORS}`}
          >
            <Check className={iconSizes.md} />
            <span className="font-medium">{t('drawingInterfaces.citizen.actions.complete')}</span>
          </button>

          <button
            onClick={handleCancel}
            className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.error} ${colors.text.foreground} py-3 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.DESTRUCTIVE} ${TRANSITION_PRESETS.COLORS}`}
          >
            <X className={iconSizes.md} />
            <span className="font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
          </button>
        </div>
      )}

      {/* Real Estate Setup Dialog */}
      {showRealEstateSetup && (
        <div className={`mb-4 p-4 ${colors.bg.warning} ${quick.card}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`text-lg font-semibold ${colors.text.warning} flex items-center gap-2`}>
              <Bell className={iconSizes.md} />
              {t('drawingInterfaces.citizen.realEstateSetup.title')}
            </h4>
            <button
              onClick={() => setShowRealEstateSetup(false)}
              className={`${colors.text.warning} ${HOVER_BACKGROUND_EFFECTS.WARNING}`}
            >
              <X className={iconSizes.md} />
            </button>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${colors.text.warning} mb-2`}>
              {t('citizenDrawingInterface.priceRange.label')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t('drawingInterfaces.common.from')}
                value={realEstateSettings.priceRange.min || ''}
                onChange={(e) => setRealEstateSettings(prev => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, min: Number(e.target.value) || undefined }
                }))}
                className={`px-3 py-2 ${quick.input} text-sm`}
              />
              <input
                type="number"
                placeholder={t('drawingInterfaces.common.to')}
                value={realEstateSettings.priceRange.max || ''}
                onChange={(e) => setRealEstateSettings(prev => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, max: Number(e.target.value) || undefined }
                }))}
                className={`px-3 py-2 ${quick.input} text-sm`}
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${colors.text.warning} mb-2`}>
              {t('drawingInterfaces.citizen.realEstateSetup.propertyType')}
            </label>
            <select
              value={realEstateSettings.propertyTypes[0] || 'apartment'}
              onChange={(e) => setRealEstateSettings(prev => ({
                ...prev,
                propertyTypes: [e.target.value]
              }))}
              className={`w-full px-3 py-2 ${quick.input} text-sm`}
            >
              <option value="apartment">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.apartment')}</option>
              <option value="house">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.house')}</option>
              <option value="land">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.land')}</option>
              <option value="commercial">{t('drawingInterfaces.citizen.realEstateSetup.propertyTypes.commercial')}</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Start polygon drawing for real estate alert using centralized system
                startDrawing('simple', {
                  fillColor: 'rgba(255, 165, 0, 0.3)', // Orange fill
                  strokeColor: '#ff8c00',
                  strokeWidth: 2
                });
                setSelectedTool('real-estate');
                setShowRealEstateSetup(false);
                console.log('🏠 Citizen: Real estate polygon drawing started');
              }}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.warning} ${colors.text.foreground} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.WARNING} ${TRANSITION_PRESETS.COLORS}`}
            >
              <MapPin className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.drawArea')}</span>
            </button>

            <button
              onClick={() => setShowRealEstateSetup(false)}
              className={`flex-1 flex items-center justify-center gap-2 ${colors.bg.muted} ${colors.text.muted} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.COLORS}`}
            >
              <X className={iconSizes.sm} />
              <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Clear All Button */}
      {polygons.length > 0 && !isDrawing && (
        <button
          onClick={handleClearAll}
          className={`w-full flex items-center justify-center gap-2 ${colors.bg.hover} ${colors.text.muted} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.COLORS}`}
        >
          <Trash2 className={iconSizes.sm} />
          <span className="text-sm">{t('drawingInterfaces.citizen.actions.clearAll')} ({polygons.length})</span>
        </button>
      )}

      {/* Instructions */}
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

      {/* Statistics */}
      {(stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className={`mt-4 p-3 ${colors.bg.secondary} rounded-md space-y-1`}>
          {stats.totalPolygons > 0 && (
            <p className={`text-xs ${colors.text.muted}`}>
              <span className="font-medium">Περιοχές:</span> {stats.totalPolygons}
            </p>
          )}

          {realEstateStats.totalAlerts > 0 && (
            <div className={`text-xs ${colors.text.warning}`}>
              <p>
                <span className="font-medium">🏠 Ειδοποιήσεις Ακινήτων:</span> {realEstateStats.totalAlerts}
              </p>
              {realEstateStats.totalMatches > 0 && (
                <p>
                  <span className="font-medium">🎯 Βρέθηκαν:</span> {realEstateStats.totalMatches} ακίνητα
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Administrative Boundaries Demo Panel */}
      {showAdminDemo && (
        <div className="mt-4">
          <AdminBoundaryDemo />
        </div>
      )}

      {/* Boundary Layer Control Panel */}
      {showBoundaryControl && (
        <div className="mt-4">
          <BoundaryLayerControlPanel
            layers={boundaryLayers}
            onLayerToggle={onLayerToggle || (() => {})}
            onLayerOpacityChange={onLayerOpacityChange || (() => {})}
            onLayerStyleChange={onLayerStyleChange || (() => {})}
            onLayerRemove={onLayerRemove || (() => {})}
            onAddNewBoundary={onAddNewBoundary || (() => {})}
          />
        </div>
      )}
    </div>
  );
}