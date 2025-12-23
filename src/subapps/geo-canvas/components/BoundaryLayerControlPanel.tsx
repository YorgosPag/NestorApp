'use client';

import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Settings, Layers, Palette, Sliders } from 'lucide-react';
import type { AdminSearchResult } from '../types/administrative-types';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

export interface BoundaryLayer {
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
  boundary?: {
    feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
    result: AdminSearchResult;
  };
}

export interface BoundaryLayerControlPanelProps {
  layers: BoundaryLayer[];
  onLayerToggle: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerStyleChange: (layerId: string, style: Partial<BoundaryLayer['style']>) => void;
  onLayerRemove: (layerId: string) => void;
  onAddNewBoundary: () => void;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🏛️ BOUNDARY LAYER CONTROL PANEL - Phase 5
 *
 * Advanced control panel για administrative boundary layers:
 * - Layer visibility toggles
 * - Opacity controls με sliders
 * - Style customization
 * - Multiple boundary management
 * - Add/Remove functionality
 */
export function BoundaryLayerControlPanel({
  layers,
  onLayerToggle,
  onLayerOpacityChange,
  onLayerStyleChange,
  onLayerRemove,
  onAddNewBoundary,
  className = ''
}: BoundaryLayerControlPanelProps) {
  const iconSizes = useIconSizes();

  // State
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeStyleLayer, setActiveStyleLayer] = useState<string | null>(null);

  // ============================================================================
  // LAYER MANAGEMENT
  // ============================================================================

  const handleVisibilityToggle = useCallback((layerId: string, visible: boolean) => {
    onLayerToggle(layerId, visible);
  }, [onLayerToggle]);

  const handleOpacityChange = useCallback((layerId: string, opacity: number) => {
    onLayerOpacityChange(layerId, opacity);
  }, [onLayerOpacityChange]);

  const handleStyleChange = useCallback((layerId: string, property: keyof BoundaryLayer['style'], value: string | number) => {
    onLayerStyleChange(layerId, { [property]: value });
  }, [onLayerStyleChange]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getBoundaryTypeIcon = (type: BoundaryLayer['type']) => {
    switch (type) {
      case 'region': return '🌍';
      case 'municipality': return '🏛️';
      case 'municipal_unit': return '🏘️';
      case 'community': return '🏡';
      default: return '📍';
    }
  };

  const getBoundaryTypeLabel = (type: BoundaryLayer['type']) => {
    switch (type) {
      case 'region': return 'Περιφέρεια';
      case 'municipality': return 'Δήμος';
      case 'municipal_unit': return 'Δημοτική Ενότητα';
      case 'community': return 'Κοινότητα';
      default: return 'Άγνωστο';
    }
  };

  const renderLayerItem = (layer: BoundaryLayer) => (
    <div key={layer.id} className="border border-gray-200 rounded-lg p-3 bg-white">
      {/* Layer Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{getBoundaryTypeIcon(layer.type)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {layer.name}
            </div>
            <div className="text-xs text-gray-500">
              {getBoundaryTypeLabel(layer.type)}
            </div>
          </div>
        </div>

        {/* Visibility Toggle */}
        <button
          onClick={() => handleVisibilityToggle(layer.id, !layer.visible)}
          className={`p-1 rounded transition-colors ${
            layer.visible
              ? 'text-blue-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}'
              : 'text-gray-400 ${HOVER_BACKGROUND_EFFECTS.LIGHT}'
          }`}
          title={layer.visible ? 'Απόκρυψη' : 'Εμφάνιση'}
        >
          {layer.visible ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
        </button>

        {/* Remove Button */}
        <button
          onClick={() => onLayerRemove(layer.id)}
          className="p-1 rounded text-red-500 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ml-1"
          title="Αφαίρεση layer"
        >
          ×
        </button>
      </div>

      {/* Opacity Slider */}
      {layer.visible && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Διαφάνεια</span>
            <span>{Math.round(layer.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={layer.opacity}
            onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none slider"
          />
        </div>
      )}

      {/* Style Controls */}
      {layer.visible && (
        <div className="space-y-2">
          <button
            onClick={() => setActiveStyleLayer(activeStyleLayer === layer.id ? null : layer.id)}
            className="flex items-center gap-2 text-xs text-gray-600 ${HOVER_TEXT_EFFECTS.DARKER} transition-colors"
          >
            <Palette className={iconSizes.xs} />
            <span>Προσαρμογή στυλ</span>
          </button>

          {/* Style Panel */}
          {activeStyleLayer === layer.id && (
            <div className="bg-gray-50 rounded p-3 space-y-2">
              {/* Stroke Color */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16">Χρώμα:</label>
                <input
                  type="color"
                  value={layer.style.strokeColor}
                  onChange={(e) => handleStyleChange(layer.id, 'strokeColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300"
                />
                <span className="text-xs text-gray-500 font-mono">
                  {layer.style.strokeColor}
                </span>
              </div>

              {/* Stroke Width */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16">Πάχος:</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={layer.style.strokeWidth}
                  onChange={(e) => handleStyleChange(layer.id, 'strokeWidth', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8">
                  {layer.style.strokeWidth}px
                </span>
              </div>

              {/* Fill Color */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16">Γέμισμα:</label>
                <input
                  type="color"
                  value={layer.style.fillColor}
                  onChange={(e) => handleStyleChange(layer.id, 'fillColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300"
                />
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={layer.style.fillOpacity}
                  onChange={(e) => handleStyleChange(layer.id, 'fillOpacity', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8">
                  {Math.round(layer.style.fillOpacity * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className={`${iconSizes.md} text-blue-600`} />
            <h3 className="text-lg font-semibold text-gray-900">
              Boundary Layers
            </h3>
            {layers.length > 0 && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                {layers.length}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 ${HOVER_TEXT_EFFECTS.DARKER} transition-colors"
            title={isExpanded ? 'Σύμπτυξη' : 'Επέκταση'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Add New Boundary Button */}
          <button
            onClick={onAddNewBoundary}
            className={`w-full mb-4 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}
          >
            <span className="text-lg">+</span>
            <span className="text-sm font-medium">Προσθήκη Boundary</span>
          </button>

          {/* Layers List */}
          <div className="space-y-3">
            {layers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Layers className={`${iconSizes.xl3} mx-auto mb-2 text-gray-300`} />
                <p className="text-sm">Δεν υπάρχουν boundary layers</p>
                <p className="text-xs">Κάντε κλικ "Προσθήκη Boundary" για να ξεκινήσετε</p>
              </div>
            ) : (
              layers.map(renderLayerItem)
            )}
          </div>

          {/* Global Controls */}
          {layers.length > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => layers.forEach(layer => handleVisibilityToggle(layer.id, true))}
                  className={`flex-1 px-3 py-2 text-xs bg-green-50 text-green-700 rounded ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors`}
                >
                  Εμφάνιση Όλων
                </button>
                <button
                  onClick={() => layers.forEach(layer => handleVisibilityToggle(layer.id, false))}
                  className={`flex-1 px-3 py-2 text-xs bg-gray-50 text-gray-700 rounded ${HOVER_BACKGROUND_EFFECTS.LIGHT} transition-colors`}
                >
                  Απόκρυψη Όλων
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS για custom slider styling */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}

export default BoundaryLayerControlPanel;