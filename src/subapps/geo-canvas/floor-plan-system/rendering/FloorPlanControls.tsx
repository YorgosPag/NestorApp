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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// Cross-subapp by design (ADR-682): a design system spans the product, not one
// subapp. Precedent already exists — geo-canvas imports dxf-viewer icons and
// modal primitives.
import { SliderInput } from '@/subapps/dxf-viewer/ui/components/shared/SliderInput';
import { SLIDER_VALUE_UNITS } from '@/subapps/dxf-viewer/ui/components/shared/slider-value-units';

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
          <h3 className="font-semibold text-foreground text-sm">
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
                  ? `${colors.bg.success} text-[hsl(var(--text-success))] ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  : `${colors.bg.muted} text-muted-foreground ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mb-3 text-xs text-muted-foreground truncate">
              📁 {fileName}
            </div>
          </TooltipTrigger>
          <TooltipContent>{fileName}</TooltipContent>
        </Tooltip>
      )}

      {/*
        Opacity — ADR-682. This was the last raw native range input that was a
        genuine migration rather than a redesign: a plain scalar parameter in
        a settings panel, i.e. exactly what SliderInput is for. It now inherits
        the design tokens (it used to render browser-chrome grey with an inline
        `accentColor`, breaking in dark mode), the Radix keyboard/ARIA contract,
        and — via `unit` — a value the user can TYPE instead of hunting for by
        drag. `percent01` is the right unit: the model is 0..1 while the display
        and input space is 0..100%, which is precisely the round-trip a
        display-only formatter cannot express.
      */}
      <div className="space-y-2">
        <SliderInput
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={onOpacityChange}
          disabled={!visible}
          showValue
          unit={SLIDER_VALUE_UNITS.percent01}
        />

        <div className="flex justify-between text-xs text-muted-foreground">
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
