'use client';

import React, { useState, useCallback } from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X } from 'lucide-react';
import { usePolygonSystem } from '@geo-alert/core/polygon-system';
import type { PolygonType } from '@geo-alert/core/polygon-system';

interface CitizenDrawingInterfaceProps {
  mapRef: React.RefObject<any>;
  onPolygonComplete?: (polygon: any) => void;
}

/**
 * 🏢 GEO-ALERT Phase 2.2.2: Citizen Drawing Interface
 *
 * Simple interface για πολίτες με βασικά εργαλεία:
 * - Point Alert (πινέζα στο χάρτη)
 * - Simple Polygon (χειροκίνητο περίγραμμα)
 * - Freehand Drawing (ελεύθερο σχέδιο)
 *
 * Mobile-first design με μεγάλα touch-friendly buttons
 */
export function CitizenDrawingInterface({
  mapRef,
  onPolygonComplete
}: CitizenDrawingInterfaceProps) {
  const [selectedTool, setSelectedTool] = useState<'point' | 'polygon' | 'freehand' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use the polygon system from @geo-alert/core
  const polygonSystem = usePolygonSystem({
    autoInit: false,
    debug: true,
    enableSnapping: true,
    snapTolerance: 15 // Larger tolerance για mobile/touch
  });

  // Tool selection handler
  const handleToolSelect = useCallback((tool: 'point' | 'polygon' | 'freehand') => {
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
    }
  }, [isDrawing, polygonSystem]);

  // Complete drawing
  const handleComplete = useCallback(() => {
    const polygon = polygonSystem.finishDrawing();
    if (polygon && onPolygonComplete) {
      onPolygonComplete(polygon);
      console.log('✅ Citizen: Drawing completed', polygon);
    }
    setIsDrawing(false);
    setSelectedTool(null);
  }, [polygonSystem, onPolygonComplete]);

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
      <div className="grid grid-cols-3 gap-3 mb-4">
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
          </p>
        </div>
      )}

      {/* Statistics */}
      {polygonSystem.stats.totalPolygons > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Περιοχές:</span> {polygonSystem.stats.totalPolygons}
          </p>
        </div>
      )}
    </div>
  );
}