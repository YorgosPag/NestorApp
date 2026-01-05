/**
 * 🏢 ENTERPRISE SWATCHES PALETTE
 *
 * @version 1.0.0
 * @description Color swatches grid for brand palettes and recent colors
 *
 * Features:
 * - Multiple palettes display
 * - Recent colors (LRU)
 * - Keyboard navigation (Arrow keys, Tab)
 * - ARIA compliant
 * - Tooltip with color name
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

'use client';

import React, { useCallback } from 'react';
import { COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getPalettesByIds } from './BrandPalettes';
import { useRecentColors } from './RecentColorsStore';
import type { ColorSwatch } from './types';
import { layoutUtilities } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface SwatchesPaletteProps {
  /** Palette IDs to display */
  paletteIds?: string[];

  /** Show recent colors */
  showRecent?: boolean;

  /** Current selected color */
  value?: string;

  /** Change callback */
  onChange: (color: string) => void;

  /** Swatch size (default: 32) */
  swatchSize?: number;

  /** Columns (default: 8) */
  columns?: number;

  /** Additional CSS class */
  className?: string;
}

/**
 * Swatches Palette Component
 */
export function SwatchesPalette({
  paletteIds = ['brand', 'semantic', 'dxf'],
  showRecent = true,
  value,
  onChange,
  swatchSize = 32,
  columns = 8,
  className = '',
}: SwatchesPaletteProps) {
  const { colors: recentColors } = useRecentColors();
  const colors = useSemanticColors();

  // Get palettes
  const palettes = getPalettesByIds(paletteIds);

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* Recent Colors */}
      {showRecent && recentColors.length > 0 && (
        <div>
          <h4 className={`text-sm font-medium ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Recent</h4>
          <SwatchGrid
            swatches={recentColors.map((color) => ({
              color,
              name: color,
            }))}
            value={value}
            onChange={onChange}
            swatchSize={swatchSize}
            columns={columns}
          />
        </div>
      )}

      {/* Brand Palettes */}
      {palettes.map((palette) => (
        <div key={palette.id}>
          <h4 className={`text-sm font-medium ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
            {palette.name}
          </h4>
          <SwatchGrid
            swatches={palette.colors}
            value={value}
            onChange={onChange}
            swatchSize={swatchSize}
            columns={columns}
          />
        </div>
      ))}
    </div>
  );
}

// ===== SWATCH GRID =====

interface SwatchGridProps {
  swatches: (ColorSwatch | string)[];
  value?: string;
  onChange: (color: string) => void;
  swatchSize: number;
  columns: number;
}

function SwatchGrid({
  swatches,
  value,
  onChange,
  swatchSize,
  columns,
}: SwatchGridProps) {
  return (
    <div
      className={`grid ${PANEL_LAYOUT.GAP.SM}`}
      style={layoutUtilities.dxf.grid.swatchGrid(columns, swatchSize)}
    >
      {swatches.map((swatch, index) => {
        const color = typeof swatch === 'string' ? swatch : swatch.color;
        const name = typeof swatch === 'string' ? swatch : swatch.name;

        return (
          <ColorSwatchButton
            key={`${color}-${index}`}
            color={color}
            name={name}
            isSelected={value?.toLowerCase() === color.toLowerCase()}
            onChange={onChange}
            size={swatchSize}
          />
        );
      })}
    </div>
  );
}

// ===== COLOR SWATCH BUTTON =====

interface ColorSwatchButtonProps {
  color: string;
  name: string;
  isSelected: boolean;
  onChange: (color: string) => void;
  size: number;
}

function ColorSwatchButton({
  color,
  name,
  isSelected,
  onChange,
  size,
}: ColorSwatchButtonProps) {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors(); // 🔧 FIX: Missing colors definition

  const handleClick = useCallback(() => {
    onChange(color);
  }, [color, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(color);
      }
    },
    [color, onChange]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        rounded border transition-all
        ${COMPLEX_HOVER_EFFECTS.SCALE_AND_SHADOW}
        focus:outline-none ${colors.interactive.focus.ring} focus:ring-offset-2 ring-offset-background
        ${isSelected ? `${getStatusBorder('info')} ring-2 ${colors.ring.info}` : getStatusBorder('muted')}
      `}
      style={layoutUtilities.dxf.swatch.square(size, color)}
      title={name}
      aria-label={`Select color ${name}`}
    />
  );
}
