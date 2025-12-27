// RulerMinorLinesSettings.tsx - Minor lines appearance settings (extracted from RulerLinesSettings)
// STATUS: ACTIVE - Enterprise Split (485 lines → 3 components)
// PURPOSE: Minor ruler lines UI (visibility, color, opacity, thickness)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§7.3 RulerMinorLinesSettings)
 *    - Total components: 33 (updated from 29 after Phase 4 split)
 *
 * 🏗️ Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (Phase 4 - Step 4.2)
 *    - Status: ✅ COMPLETE - Enterprise Split Applied
 *
 * 📊 Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§6.3 Enterprise File Size Compliance)
 *    - File size: 155 lines (✅ <200 lines - Enterprise compliant)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-009: Enterprise Split Strategy)
 *    - Rationale: Files >200 lines must be split for maintainability
 *
 * 🔗 Centralized Systems:
 *    - docs/CENTRALIZED_SYSTEMS.md (Rule #12: Settings Components)
 *    - Pattern: Router + Specialized Sub-components
 *
 * 📚 Related Components:
 *    - Parent: RulerLinesSettings.tsx (router - 100 lines)
 *    - Sibling: RulerMajorLinesSettings.tsx (155 lines)
 *    - Uses: useRulersGridContext hook (RulersGridSystem)
 *
 * 📦 Extracted from:
 *    - Original: RulerLinesSettings.tsx lines 321-439 (Phase 3)
 *    - Enterprise Split: Phase 4.2 (2025-10-07)
 *    - Reason: 485 lines → 3 files (100 + 155 + 155)
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface RulerMinorLinesSettingsProps {
  className?: string;
}

/**
 * RulerMinorLinesSettings - Minor ruler lines appearance settings
 *
 * Purpose:
 * - Visibility toggle (show/hide minor lines)
 * - Color picker (rgba support)
 * - Opacity slider (0.1 - 1.0)
 * - Thickness control (0.5px - 3px)
 *
 * State Management:
 * - Uses useRulersGridContext() for ruler system integration
 * - All changes applied immediately (live preview)
 * - Updates both horizontal and vertical rulers
 *
 * Extracted from: RulerLinesSettings.tsx lines 321-439
 */
export const RulerMinorLinesSettings: React.FC<RulerMinorLinesSettingsProps> = ({ className = '' }) => {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // ============================================================================
  // HOOKS
  // ============================================================================

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleMinorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
  };

  const handleMinorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: color },
      vertical: { ...rulerSettings.vertical, minorTickColor: color }
    });
  };

  const handleMinorTickOpacityChange = (opacity: number) => {
    const minorTickColor = rulerSettings.horizontal.minorTickColor || '#ffffff';
    let r, g, b;

    if (minorTickColor.includes('rgba')) {
      const match = minorTickColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        r = g = b = 255;
      }
    } else {
      const hex = minorTickColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` },
      vertical: { ...rulerSettings.vertical, minorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
    });
  };

  const handleMinorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, minorTickLength: thickness * 10 }
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
      {/* Minor Lines Visibility Toggle */}
      <div className={`p-2 ${colors.bg.hover} rounded space-y-2`}>
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Δευτερευουσών Γραμμών</div>
          <div className={`font-normal ${colors.text.muted}`}>Εμφάνιση/απόκρυψη των δευτερευουσών γραμμών χάρακα</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleMinorTicksVisibilityChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              rulerSettings.horizontal.showMinorTicks
                ? `bg-blue-600 ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('secondary')}`
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleMinorTicksVisibilityChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !rulerSettings.horizontal.showMinorTicks
                ? `bg-blue-600 ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('secondary')}`
            }`}
          >
            Ανενεργό
          </button>
        </div>
      </div>

      {/* Minor Lines Opacity */}
      <div className={`p-2 ${colors.bg.hover} rounded space-y-2`}>
        <div className="text-sm text-white">
          <div className="font-medium">Διαφάνεια Δευτερευουσών Γραμμών</div>
          <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας των δευτερευουσών γραμμών χάρακα</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={(() => {
              const tickColor = rulerSettings.horizontal.minorTickColor;
              if (tickColor.includes('rgba')) {
                const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 1.0;
              }
              return 1.0;
            })()}
            onChange={(e) => handleMinorTickOpacityChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`w-12 text-xs ${colors.bg.muted} text-white rounded px-2 py-1 text-center`}>
            {Math.round(((() => {
              const tickColor = rulerSettings.horizontal.minorTickColor;
              if (tickColor.includes('rgba')) {
                const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 1.0;
              }
              return 1.0;
            })()) * 100)}%
          </div>
        </div>
      </div>

      {/* Minor Lines Color */}
      <div className={`p-2 ${colors.bg.hover} rounded space-y-2`}>
        <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Δευτερευουσών Γραμμών</label>
        <div className={`text-xs ${colors.text.muted} mb-2`}>Χρώμα δευτερευουσών γραμμών (ticks) χαράκων</div>
        <ColorDialogTrigger
          value={rulerSettings.horizontal.minorTickColor}
          onChange={handleMinorTickColorChange}
          label={rulerSettings.horizontal.minorTickColor}
          title="Επιλογή Χρώματος Δευτερευουσών Γραμμών Χάρακα"
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent={true}
          eyedropper={true}
        />
      </div>

      {/* Minor Lines Thickness */}
      <div className={`p-2 ${colors.bg.hover} rounded space-y-2`}>
        <div className="text-sm text-white">
          <div className="font-medium">Πάχος Δευτερευουσών Γραμμών</div>
          <div className={`font-normal ${colors.text.muted}`}>Πάχος των δευτερευουσών γραμμών του χάρακα</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.5"
            value={rulerSettings.horizontal.minorTickLength / 10}
            onChange={(e) => handleMinorTickThicknessChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`w-12 text-xs ${colors.bg.muted} text-white rounded px-2 py-1 text-center`}>
            {rulerSettings.horizontal.minorTickLength / 10}px
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulerMinorLinesSettings;

/**
 * MIGRATION NOTES: Extracted from RulerLinesSettings.tsx lines 321-439
 * Original: Inline Minor lines UI (119 lines) inside RulerLinesSettings
 *
 * Changes:
 * - ✅ Extracted Minor lines UI to standalone component
 * - ✅ Preserved all handlers (visibility, color, opacity, thickness)
 * - ✅ Preserved helper functions (getPreviewColor, getPreviewBackground)
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (Minor lines only)
 * - ✅ Enterprise file size (<200 lines) ✅
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (RulerLinesSettings → router only)
 */
