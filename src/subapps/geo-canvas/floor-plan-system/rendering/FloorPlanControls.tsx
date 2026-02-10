/**
 * 🎛️ FLOOR PLAN CONTROLS
 *
 * UI controls για floor plan layer management
 *
 * @module floor-plan-system/rendering/FloorPlanControls
 *
 * Features:
 * - Opacity slider (0-100%)
 * - Show/hide toggle
 * - Layer name display
 * - Compact design
 */

'use client';

import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { canvasUtilities } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../../config/color-config';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Component props
 */
export interface FloorPlanControlsProps {
  /** Layer visibility */
  visible: boolean;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Floor plan file name */
  fileName?: string;
  /** On visibility toggle */
  onVisibilityChange: (visible: boolean) => void;
  /** On opacity change */
  onOpacityChange: (opacity: number) => void;
  /** Container className */
  className?: string;
}

/**
 * FloorPlanControls Component
 *
 * Provides UI controls για layer visibility και opacity
 *
 * @example
 * ```tsx
 * <FloorPlanControls
 *   visible={isVisible}
 *   opacity={0.8}
 *   fileName="floor-plan.dxf"
 *   onVisibilityChange={setVisible}
 *   onOpacityChange={setOpacity}
 * />
 * ```
 */
export function FloorPlanControls({
  visible,
  opacity,
  fileName,
  onVisibilityChange,
  onOpacityChange,
  className = ''
}: FloorPlanControlsProps) {
  const colors = useSemanticColors();
  return (
    <div
      className={`floor-plan-controls ${className}`}
      style={canvasUtilities.geoInteractive.floorPlanControls.container}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <h3 className="font-semibold text-gray-900 text-sm">
            Floor Plan Layer
          </h3>
        </div>

        {/* Visibility Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onVisibilityChange(!visible)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                visible
                  ? `${colors.bg.success} text-green-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  : `${colors.bg.muted} text-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
              }`}
            >
              {visible ? '👁️ Visible' : '🚫 Hidden'}
            </button>
          </TooltipTrigger>
          <TooltipContent>{visible ? 'Hide layer' : 'Show layer'}</TooltipContent>
        </Tooltip>
      </div>

      {/* File Name */}
      {fileName && (
        <div className="mb-3 text-xs text-gray-600 truncate" title={fileName}>
          📁 {fileName}
        </div>
      )}

      {/* Opacity Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="floor-plan-opacity" className="text-gray-700 font-medium">
            Opacity
          </label>
          <span className="text-gray-900 font-semibold">
            {Math.round(opacity * 100)}%
          </span>
        </div>

        <input
          id="floor-plan-opacity"
          type="range"
          min="0"
          max="100"
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(parseInt(e.target.value) / 100)}
          disabled={!visible}
          className={`w-full h-2 ${colors.bg.hover} rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
            accentColor: GEO_COLORS.POLYGON.DRAFT
          }}
        />

        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>Transparent</span>
          <span>Opaque</span>
          <span>100%</span>
        </div>
      </div>

      {/* Quick Preset Buttons */}
      <div className="mt-3 flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onOpacityChange(0.3)}
              disabled={!visible}
              className={`flex-1 px-2 py-1 text-xs ${colors.bg.muted} disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
            >
              30%
            </button>
          </TooltipTrigger>
          <TooltipContent>Set opacity to 30%</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onOpacityChange(0.5)}
              disabled={!visible}
              className={`flex-1 px-2 py-1 text-xs ${colors.bg.muted} disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
            >
              50%
            </button>
          </TooltipTrigger>
          <TooltipContent>Set opacity to 50%</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onOpacityChange(0.8)}
              disabled={!visible}
              className={`flex-1 px-2 py-1 text-xs ${colors.bg.muted} disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
            >
              80%
            </button>
          </TooltipTrigger>
          <TooltipContent>Set opacity to 80%</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onOpacityChange(1.0)}
              disabled={!visible}
              className={`flex-1 px-2 py-1 text-xs ${colors.bg.muted} disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
            >
              100%
            </button>
          </TooltipTrigger>
          <TooltipContent>Set opacity to 100%</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Export for convenience
 */
export default FloorPlanControls;
