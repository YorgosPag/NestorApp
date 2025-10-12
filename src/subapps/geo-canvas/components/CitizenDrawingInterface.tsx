'use client';

import React, { useState, useCallback } from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X, Bell, Home } from 'lucide-react';
import { usePolygonSystem } from '@geo-alert/core/polygon-system';
import type { PolygonType, RealEstatePolygon } from '@geo-alert/core/polygon-system';
import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';

interface CitizenDrawingInterfaceProps {
  mapRef: React.RefObject<any>;
  onPolygonComplete?: (polygon: any) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
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
  onRealEstateAlertCreated
}: CitizenDrawingInterfaceProps) {
  const [selectedTool, setSelectedTool] = useState<'point' | 'polygon' | 'freehand' | 'real-estate' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 🏠 Phase 2.5.3: Real Estate Integration
  const [showRealEstateSetup, setShowRealEstateSetup] = useState(false);
  const [realEstateSettings, setRealEstateSettings] = useState({
    priceRange: { min: 50000, max: 500000 },
    propertyTypes: ['apartment'] as string[],
    includeExclude: 'include' as 'include' | 'exclude'
  });

  // Real Estate Monitoring Integration
  const {
    addRealEstatePolygon,
    getRealEstateAlerts,
    statistics: realEstateStats
  } = useRealEstateMatching();

  // Use the polygon system from @geo-alert/core
  const polygonSystem = usePolygonSystem({
    autoInit: false,
    debug: true,
    enableSnapping: true,
    snapTolerance: 15 // Larger tolerance για mobile/touch
  });

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

  // Tool selection handler
  const handleToolSelect = useCallback((tool: 'point' | 'polygon' | 'freehand' | 'real-estate') => {
    if (isDrawing) {
      // Cancel current drawing
      polygonSystem.cancelDrawing();
      setIsDrawing(false);
    }

    setSelectedTool(tool);

    // Start appropriate drawing mode
    switch (tool) {
      case 'point':
        // Point mode - θα προσθέσουμε μόνο ένα σημείο
        console.log('🎯 Citizen: Point mode selected');
        break;

      case 'polygon':
        // Simple polygon mode
        polygonSystem.startDrawing('simple', {
          fillColor: 'rgba(59, 130, 246, 0.3)', // Blue fill
          strokeColor: '#3b82f6',
          strokeWidth: 2
        });
        setIsDrawing(true);
        console.log('🔷 Citizen: Polygon mode started');
        break;

      case 'freehand':
        // Freehand drawing mode
        polygonSystem.startDrawing('freehand', {
          fillColor: 'rgba(16, 185, 129, 0.3)', // Green fill
          strokeColor: '#10b981',
          strokeWidth: 2
        });
        setIsDrawing(true);
        console.log('✏️ Citizen: Freehand mode started');
        break;

      case 'real-estate':
        // Real estate alert mode - show setup dialog
        setShowRealEstateSetup(true);
        console.log('🏠 Citizen: Real estate alert setup opened');
        break;
    }
  }, [isDrawing, polygonSystem]);

  // Complete drawing
  const handleComplete = useCallback(() => {
    const polygon = polygonSystem.finishDrawing();
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
    setIsDrawing(false);
    setSelectedTool(null);
  }, [polygonSystem, selectedTool, onPolygonComplete, handleRealEstateAlertComplete]);

  // Cancel drawing
  const handleCancel = useCallback(() => {
    polygonSystem.cancelDrawing();
    setIsDrawing(false);
    setSelectedTool(null);
    console.log('❌ Citizen: Drawing cancelled');
  }, [polygonSystem]);

  // Clear all
  const handleClearAll = useCallback(() => {
    polygonSystem.clearAll();
    console.log('🗑️ Citizen: All polygons cleared');
  }, [polygonSystem]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🏘️ Εργαλεία Πολίτη
        </h3>
        <p className="text-sm text-gray-600">
          Απλά εργαλεία για επιλογή περιοχής ενδιαφέροντος
        </p>
      </div>

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
          <span className="text-sm font-medium">Σημείο</span>
          <span className="text-xs text-gray-500">Πινέζα</span>
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
          <span className="text-sm font-medium">Πολύγωνο</span>
          <span className="text-xs text-gray-500">Περίγραμμα</span>
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
          <span className="text-sm font-medium">Ελεύθερο</span>
          <span className="text-xs text-gray-500">Σχέδιο</span>
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
          <span className="text-sm font-medium">Ακίνητα</span>
          <span className="text-xs text-gray-500">Ειδοποιήσεις</span>
        </button>
      </div>

      {/* Action Buttons */}
      {isDrawing && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">Ολοκλήρωση</span>
          </button>

          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="font-medium">Ακύρωση</span>
          </button>
        </div>
      )}

      {/* Real Estate Setup Dialog */}
      {showRealEstateSetup && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Ειδοποίηση Ακινήτων
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
              Εύρος Τιμής (€)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Από"
                value={realEstateSettings.priceRange.min || ''}
                onChange={(e) => setRealEstateSettings(prev => ({
                  ...prev,
                  priceRange: { ...prev.priceRange, min: Number(e.target.value) || undefined }
                }))}
                className="px-3 py-2 border border-orange-300 rounded-md text-sm"
              />
              <input
                type="number"
                placeholder="Έως"
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
              Τύπος Ακινήτου
            </label>
            <select
              value={realEstateSettings.propertyTypes[0] || 'apartment'}
              onChange={(e) => setRealEstateSettings(prev => ({
                ...prev,
                propertyTypes: [e.target.value]
              }))}
              className="w-full px-3 py-2 border border-orange-300 rounded-md text-sm"
            >
              <option value="apartment">Διαμέρισμα</option>
              <option value="house">Μονοκατοικία</option>
              <option value="land">Οικόπεδο</option>
              <option value="commercial">Επαγγελματικό</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Start polygon drawing for real estate alert
                polygonSystem.startDrawing('simple', {
                  fillColor: 'rgba(255, 165, 0, 0.3)', // Orange fill
                  strokeColor: '#ff8c00',
                  strokeWidth: 2
                });
                setIsDrawing(true);
                setSelectedTool('real-estate');
                setShowRealEstateSetup(false);
                console.log('🏠 Citizen: Real estate polygon drawing started');
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Σχεδίασε Περιοχή</span>
            </button>

            <button
              onClick={() => setShowRealEstateSetup(false)}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">Ακύρωση</span>
            </button>
          </div>
        </div>
      )}

      {/* Clear All Button */}
      {polygonSystem.polygons.length > 0 && !isDrawing && (
        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">Καθαρισμός όλων ({polygonSystem.polygons.length})</span>
        </button>
      )}

      {/* Instructions */}
      {selectedTool && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            {selectedTool === 'point' && '📍 Κάντε κλικ στο χάρτη για να τοποθετήσετε ένα σημείο ειδοποίησης'}
            {selectedTool === 'polygon' && '🔷 Κάντε κλικ για να προσθέσετε σημεία στο πολύγωνο. Διπλό κλικ για ολοκλήρωση'}
            {selectedTool === 'freehand' && '✏️ Κρατήστε πατημένο και σύρετε για να σχεδιάσετε ελεύθερα'}
            {selectedTool === 'real-estate' && '🏠 Σχεδιάστε την περιοχή ενδιαφέροντος για ειδοποιήσεις ακινήτων. Διπλό κλικ για ολοκλήρωση'}
          </p>
        </div>
      )}

      {/* Statistics */}
      {(polygonSystem.stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md space-y-1">
          {polygonSystem.stats.totalPolygons > 0 && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Περιοχές:</span> {polygonSystem.stats.totalPolygons}
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
    </div>
  );
}