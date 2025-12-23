'use client';

// RulerUnitsSettings.tsx - Ruler units settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b4
// PURPOSE: Ruler units settings UI (units type, visibility, font size, color)

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b4)  ║
 * ║  Parent: settings/special/RulersSettings.tsx (Units tab)                   ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';

export interface RulerUnitsSettingsProps {
  className?: string;
}

/**
 * RulerUnitsSettings - Ruler units appearance settings
 *
 * Purpose:
 * - Units type selection (mm, cm, m)
 * - Units visibility toggle
 * - Units font size control
 * - Units color control
 *
 * State Management:
 * - Uses useRulersGridContext() hook for ruler system integration
 * - Local unitsVisible state synced with ruler settings
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1992-2098
 */
export const RulerUnitsSettings: React.FC<RulerUnitsSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const iconSizes = useIconSizes();

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [unitsVisible, setUnitsVisible] = useState<boolean>(
    rulerSettings?.horizontal?.showUnits ?? true
  );

  // Sync local state with ruler settings
  useEffect(() => {
    setUnitsVisible(rulerSettings?.horizontal?.showUnits ?? true);
  }, [rulerSettings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRulerUnitsChange = (units: 'mm' | 'cm' | 'm') => {
    updateRulerSettings({ units });
  };

  const handleUnitsVisibilityChange = (visible: boolean) => {
    setUnitsVisible(visible);
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showUnits: visible },
      vertical: { ...rulerSettings.vertical, showUnits: visible }
    });
  };

  const handleRulerUnitsFontSizeChange = (size: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsFontSize: size },
      vertical: { ...rulerSettings.vertical, unitsFontSize: size }
    });
  };

  const handleUnitsColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsColor: color },
      vertical: { ...rulerSettings.vertical, unitsColor: color }
    });
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Helper function to get color for preview icon (handles rgba)
  const getPreviewColor = (color: string): string => {
    if (color.includes('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return color;
  };

  // Helper function to get preview background for divs (preserves rgba)
  const getPreviewBackground = (color: string): string => {
    return color;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Ruler Units */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Μονάδες Μέτρησης</div>
          <div className="font-normal text-gray-400">Μονάδα μέτρησης στους χάρακες</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['mm', 'cm', 'm'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => handleRulerUnitsChange(unit)}
              className={`p-2 rounded text-xs border transition-colors ${
                rulerSettings.units === unit
                  ? 'bg-blue-600 border-blue-500'
                  : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      {/* Units Visibility Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Μονάδων</div>
          <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη μονάδων μέτρησης στους χάρακες</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleUnitsVisibilityChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              unitsVisible
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleUnitsVisibilityChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !unitsVisible
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ανενεργό
          </button>
        </div>
      </div>

      {/* Units Font Size */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Μέγεθος Μονάδων</div>
          <div className="font-normal text-gray-400">Μέγεθος των μονάδων μέτρησης στους χάρακες</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="8"
            max="25"
            step="1"
            value={rulerSettings.horizontal.unitsFontSize || 10}
            onChange={(e) => handleRulerUnitsFontSizeChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {rulerSettings.horizontal.unitsFontSize || 10}px
          </div>
        </div>
      </div>

      {/* Units Color */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Χρώμα Μονάδων</div>
          <div className="font-normal text-gray-400">Χρώμα των μονάδων μέτρησης στους χάρακες</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`${iconSizes.lg} rounded border-2`}
            style={{
              backgroundColor: getPreviewBackground(
                rulerSettings.horizontal.unitsColor ||
                rulerSettings.horizontal.textColor ||
                '#ffffff'
              ),
              borderColor: getPreviewColor(
                rulerSettings.horizontal.unitsColor ||
                rulerSettings.horizontal.textColor ||
                '#ffffff'
              )
            }}
          />
          <input
            type="color"
            value={getPreviewColor(
              rulerSettings.horizontal.unitsColor ||
              rulerSettings.horizontal.textColor ||
              '#ffffff'
            )}
            onChange={(e) => handleUnitsColorChange(e.target.value)}
            className={`${iconSizes.xl} h-6 rounded border-0 cursor-pointer`}
          />
          <input
            type="text"
            value={
              rulerSettings.horizontal.unitsColor ||
              rulerSettings.horizontal.textColor ||
              '#ffffff'
            }
            onChange={(e) => handleUnitsColorChange(e.target.value)}
            className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
            placeholder="#ffffff"
          />
        </div>
      </div>
    </div>
  );
};

export default RulerUnitsSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1992-2098
 * Original: Inline UI in 'units' tab of rulers category (107 lines)
 *
 * Changes:
 * - ✅ Extracted all ruler units UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Local unitsVisible state with sync logic
 * - ✅ Helper functions for rgba color handling
 * - ✅ Live updates to ruler system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (RulerUnitsSettings = Units UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (RulersSettings)
 */
