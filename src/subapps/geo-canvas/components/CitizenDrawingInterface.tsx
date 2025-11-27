'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X, Bell, Home, Search } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { RealEstatePolygon } from '@geo-alert/core';
import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';

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
    priceRange: { min: 50000, max: 500000 },
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
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('drawingInterfaces.citizen.title')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('drawingInterfaces.citizen.subtitle')}
            </p>
          </div>

          {/* Address Search Toggle Button */}
          <button
            onClick={() => setShowAddressSearch(!showAddressSearch)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${showAddressSearch
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }
            `}
            title="Αναζήτηση διεύθυνσης ή GPS"
          >
            <Search className="w-4 h-4" />
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
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'point'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <MapPin className="w-8 h-8 mb-2 text-blue-600" />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.point')}</span>
          <span className="text-xs text-gray-500">{t('drawingInterfaces.citizen.tools.pointDescription')}</span>
        </button>

        {/* Polygon Tool */}
        <button
          onClick={() => handleToolSelect('polygon')}
          disabled={isDrawing && selectedTool !== 'polygon'}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'polygon'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing && selectedTool !== 'polygon' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <Hexagon className="w-8 h-8 mb-2 text-green-600" />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.polygon')}</span>
          <span className="text-xs text-gray-500">{t('drawingInterfaces.citizen.tools.polygonDescription')}</span>
        </button>
      </div>

      {/* Second Row - Advanced Tools */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Freehand Tool */}
        <button
          onClick={() => handleToolSelect('freehand')}
          disabled={isDrawing && selectedTool !== 'freehand'}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'freehand'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing && selectedTool !== 'freehand' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <Hand className="w-8 h-8 mb-2 text-purple-600" />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.freehand')}</span>
          <span className="text-xs text-gray-500">{t('drawingInterfaces.citizen.tools.freehandDrawing')}</span>
        </button>

        {/* Real Estate Alert Tool */}
        <button
          onClick={() => handleToolSelect('real-estate')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'real-estate'
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <Home className="w-8 h-8 mb-2 text-orange-600" />
          <span className="text-sm font-medium">{t('drawingInterfaces.citizen.tools.realEstate')}</span>
          <span className="text-xs text-gray-500">{t('drawingInterfaces.citizen.tools.realEstateDescription')}</span>
        </button>
      </div>

      {/* Third Row - Testing & Utility Tools */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Address Search Button */}
        <button
          onClick={() => setShowAddressSearch(!showAddressSearch)}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${showAddressSearch
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            cursor-pointer hover:shadow-md
          `}
        >
          <Search className="w-8 h-8 mb-2 text-indigo-600" />
          <span className="text-sm font-medium">Address Search</span>
          <span className="text-xs text-gray-500">Διευθύνσεις & Όρια</span>
        </button>

        {/* Admin Boundaries Demo Button */}
        <button
          onClick={() => setShowAdminDemo(!showAdminDemo)}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${showAdminDemo
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            cursor-pointer hover:shadow-md
          `}
        >
          <div className="w-8 h-8 mb-2 text-violet-600 font-bold text-lg">🏛️</div>
          <span className="text-sm font-medium">Boundaries Demo</span>
          <span className="text-xs text-gray-500">Test Interface</span>
        </button>

        {/* Boundary Layer Control Button */}
        <button
          onClick={() => setShowBoundaryControl(!showBoundaryControl)}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${showBoundaryControl
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            cursor-pointer hover:shadow-md
          `}
        >
          <div className="w-8 h-8 mb-2 text-emerald-600 font-bold text-lg">🎛️</div>
          <span className="text-sm font-medium">Layer Control</span>
          <span className="text-xs text-gray-500">
            {boundaryLayers.length} layers
          </span>
        </button>
      </div>

      {/* Point Radius Selector - Shows only when point tool is selected */}
      {selectedTool === 'point' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Ακτίνα Πινέζας</h4>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[50, 100, 250].map((radius) => (
              <button
                key={radius}
                onClick={() => setPointRadius(radius)}
                className={`
                  py-2 px-3 text-sm font-medium rounded-md transition-all
                  ${pointRadius === radius
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
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
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                  }
                `}
              >
                {radius >= 1000 ? `${radius/1000}km` : `${radius}m`}
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-blue-600 text-center">
            Επιλεγμένη ακτίνα: <span className="font-semibold">{pointRadius >= 1000 ? `${pointRadius/1000}km` : `${pointRadius}m`}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isDrawing && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">{t('drawingInterfaces.citizen.actions.complete')}</span>
          </button>

          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
          </button>
        </div>
      )}

      {/* Real Estate Setup Dialog */}
      {showRealEstateSetup && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('drawingInterfaces.citizen.realEstateSetup.title')}
            </h4>
            <button
              onClick={() => setShowRealEstateSetup(false)}
              className="text-orange-600 hover:text-orange-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-900 mb-2">
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
                className="px-3 py-2 border border-orange-300 rounded-md text-sm"
              />
              <input
                type="number"
                placeholder={t('drawingInterfaces.common.to')}
                value={realEstateSettings.priceRange.max || ''}
                onChange={(e) => setRealEstateSettings(prev => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, max: Number(e.target.value) || undefined }
                }))}
                className="px-3 py-2 border border-orange-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-900 mb-2">
              {t('drawingInterfaces.citizen.realEstateSetup.propertyType')}
            </label>
            <select
              value={realEstateSettings.propertyTypes[0] || 'apartment'}
              onChange={(e) => setRealEstateSettings(prev => ({
                ...prev,
                propertyTypes: [e.target.value]
              }))}
              className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm"
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
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.drawArea')}</span>
            </button>

            <button
              onClick={() => setShowRealEstateSetup(false)}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">{t('drawingInterfaces.citizen.actions.cancel')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Clear All Button */}
      {polygons.length > 0 && !isDrawing && (
        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">{t('drawingInterfaces.citizen.actions.clearAll')} ({polygons.length})</span>
        </button>
      )}

      {/* Instructions */}
      {selectedTool && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            {selectedTool === 'point' && t('instructions.citizen.placePoint')}
            {selectedTool === 'polygon' && t('instructions.citizen.addPolygonPoints')}
            {selectedTool === 'freehand' && t('instructions.citizen.drawFreehand')}
            {selectedTool === 'real-estate' && t('drawingInterfaces.citizen.instructions.realEstate')}
          </p>
        </div>
      )}

      {/* Statistics */}
      {(stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md space-y-1">
          {stats.totalPolygons > 0 && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Περιοχές:</span> {stats.totalPolygons}
            </p>
          )}

          {realEstateStats.totalAlerts > 0 && (
            <div className="text-xs text-orange-700">
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