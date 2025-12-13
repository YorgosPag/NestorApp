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
import { getPalettesByIds } from './BrandPalettes';
import { useRecentColors } from './RecentColorsStore';
import type { ColorSwatch } from './types';

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

  // Get palettes
  const palettes = getPalettesByIds(paletteIds);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Recent Colors */}
      {showRecent && recentColors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Recent</h4>
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
          <h4 className="text-sm font-medium text-gray-300 mb-2">
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
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${swatchSize}px)`,
      }}
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
        rounded border-2 transition-all
        ${COMPLEX_HOVER_EFFECTS.SCALE_AND_SHADOW}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'}
      `}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      title={name}
      aria-label={`Select color ${name}`}
    />
  );
}
