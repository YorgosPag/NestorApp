'use client';

import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Layers, Palette, Globe, Building2, MapPin } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { AdminSearchResult } from '../types/administrative-types';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../config/color-config';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

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

  // 🏢 ENTERPRISE: Use centralized navigation entity icons
  const CommunityIcon = NAVIGATION_ENTITIES.unit.icon;

  const getBoundaryTypeIcon = (type: BoundaryLayer['type']) => {
    const iconProps = { className: iconSizes.sm };
    switch (type) {
      case 'region': return <Globe {...iconProps} />;
      case 'municipality': return <Building2 {...iconProps} />;
      case 'municipal_unit': return <Building2 {...iconProps} />;
      case 'community': return <CommunityIcon {...iconProps} />;
      default: return <MapPin {...iconProps} />;
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
    <div key={layer.id} className={`${quick.card} p-3 ${colors.bg.primary}`}>
      {/* Layer Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{getBoundaryTypeIcon(layer.type)}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
              {layer.name}
            </div>
            <div className={`text-xs ${colors.text.muted}`}>
              {getBoundaryTypeLabel(layer.type)}
            </div>
          </div>
        </div>

        {/* Visibility Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleVisibilityToggle(layer.id, !layer.visible)}
              className={`p-1 rounded transition-colors ${
                layer.visible
                  ? `${colors.text.info} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  : `${colors.text.muted} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
              }`}
            >
              {layer.visible ? <Eye className={iconSizes.sm} /> : <EyeOff className={iconSizes.sm} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{layer.visible ? 'Απόκρυψη' : 'Εμφάνιση'}</TooltipContent>
        </Tooltip>

        {/* Remove Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onLayerRemove(layer.id)}
              className={`p-1 rounded ${colors.text.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ml-1`}
            >
              ×
            </button>
          </TooltipTrigger>
          <TooltipContent>Αφαίρεση layer</TooltipContent>
        </Tooltip>
      </div>

      {/* Opacity Slider */}
      {layer.visible && (
        <div className="mb-3">
          <div className={`flex items-center justify-between text-xs ${colors.text.muted} mb-1`}>
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
            className={`w-full h-2 ${colors.bg.secondary} rounded-lg appearance-none slider`}
          />
        </div>
      )}

      {/* Style Controls */}
      {layer.visible && (
        <div className="space-y-2">
          <button
            onClick={() => setActiveStyleLayer(activeStyleLayer === layer.id ? null : layer.id)}
            className={`flex items-center gap-2 text-xs ${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER} transition-colors`}
          >
            <Palette className={iconSizes.xs} />
            <span>Προσαρμογή στυλ</span>
          </button>

          {/* Style Panel */}
          {activeStyleLayer === layer.id && (
            <div className={`${colors.bg.secondary} rounded p-3 space-y-2`}>
              {/* Stroke Color */}
              <div className="flex items-center gap-2">
                <label className={`text-xs ${colors.text.muted} w-16`}>Χρώμα:</label>
                <input
                  type="color"
                  value={layer.style.strokeColor}
                  onChange={(e) => handleStyleChange(layer.id, 'strokeColor', e.target.value)}
                  className={`w-8 h-6 ${quick.input}`}
                />
                <span className={`text-xs ${colors.text.muted} font-mono`}>
                  {layer.style.strokeColor}
                </span>
              </div>

              {/* Stroke Width */}
              <div className="flex items-center gap-2">
                <label className={`text-xs ${colors.text.muted} w-16`}>Πάχος:</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={layer.style.strokeWidth}
                  onChange={(e) => handleStyleChange(layer.id, 'strokeWidth', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className={`text-xs ${colors.text.muted} w-8`}>
                  {layer.style.strokeWidth}px
                </span>
              </div>

              {/* Fill Color */}
              <div className="flex items-center gap-2">
                <label className={`text-xs ${colors.text.muted} w-16`}>Γέμισμα:</label>
                <input
                  type="color"
                  value={layer.style.fillColor}
                  onChange={(e) => handleStyleChange(layer.id, 'fillColor', e.target.value)}
                  className={`w-8 h-6 ${quick.input}`}
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
                <span className={`text-xs ${colors.text.muted} w-8`}>
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
    <div className={`${colors.bg.primary} ${quick.card} shadow-lg ${className}`}>
      {/* Header */}
      <div className={`p-4 ${quick.separatorH}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className={`${iconSizes.md} ${colors.text.info}`} />
            <h3 className={`text-lg font-semibold ${colors.text.foreground}`}>
              Boundary Layers
            </h3>
            {layers.length > 0 && (
              <span className={`px-2 py-1 text-xs ${colors.bg.info} ${colors.text.info} rounded-full`}>
                {layers.length}
              </span>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER} transition-colors`}
              >
                {isExpanded ? '−' : '+'}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isExpanded ? 'Σύμπτυξη' : 'Επέκταση'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Add New Boundary Button */}
          <button
            onClick={onAddNewBoundary}
            className={`w-full mb-4 flex items-center justify-center gap-2 p-3 border border-dashed border-border ${quick.card} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}
          >
            <span className="text-lg">+</span>
            <span className="text-sm font-medium">Προσθήκη Boundary</span>
          </button>

          {/* Layers List */}
          <div className="space-y-3">
            {layers.length === 0 ? (
              <div className={`text-center py-8 ${colors.text.muted}`}>
                <Layers className={`${iconSizes.xl3} mx-auto mb-2 ${colors.text.muted}`} />
                <p className="text-sm">Δεν υπάρχουν boundary layers</p>
                <p className="text-xs">Κάντε κλικ "Προσθήκη Boundary" για να ξεκινήσετε</p>
              </div>
            ) : (
              layers.map(renderLayerItem)
            )}
          </div>

          {/* Global Controls */}
          {layers.length > 1 && (
            <div className={`mt-4 pt-4 ${quick.separatorH}`}>
              <div className="flex gap-2">
                <button
                  onClick={() => layers.forEach(layer => handleVisibilityToggle(layer.id, true))}
                  className={`flex-1 px-3 py-2 text-xs ${colors.bg.success} ${colors.text.success} ${quick.input} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors`}
                >
                  Εμφάνιση Όλων
                </button>
                <button
                  onClick={() => layers.forEach(layer => handleVisibilityToggle(layer.id, false))}
                  className={`flex-1 px-3 py-2 text-xs ${colors.bg.secondary} ${colors.text.muted} ${quick.input} ${HOVER_BACKGROUND_EFFECTS.LIGHT} transition-colors`}
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
          background: ${GEO_COLORS.MAP_LAYER.BOUNDARY_CONTROL_BG};
          cursor: pointer;
          border: 2px solid ${GEO_COLORS.MAP_LAYER.BOUNDARY_CONTROL_BORDER};
          box-shadow: 0 2px 4px ${GEO_COLORS.withOpacity(GEO_COLORS.BLACK, 0.1)};
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${GEO_COLORS.MAP_LAYER.BOUNDARY_CONTROL_BG};
          cursor: pointer;
          border: 2px solid ${GEO_COLORS.MAP_LAYER.BOUNDARY_CONTROL_BORDER};
          box-shadow: 0 2px 4px ${GEO_COLORS.withOpacity(GEO_COLORS.BLACK, 0.1)};
        }
      `}</style>
    </div>
  );
}

export default BoundaryLayerControlPanel;