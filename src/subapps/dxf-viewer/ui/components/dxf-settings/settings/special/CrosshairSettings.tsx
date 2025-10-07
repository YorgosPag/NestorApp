// CrosshairSettings.tsx - Crosshair settings UI (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.2
// PURPOSE: Crosshair settings UI (Specific Settings → Cursor → Crosshair tab)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.2)    ║
 * ║  Parent: categories/CursorCategory.tsx (Crosshair tab)                     ║
 * ║  Uses: useCursorSettings hook, CursorColors type                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { DEFAULT_CURSOR_SETTINGS } from '../../../../../systems/cursor/config';
import type { CursorColors } from '../../../palettes/CursorColorPalette';

export interface CrosshairSettingsProps {
  className?: string;
}

/**
 * CrosshairSettings - Crosshair appearance settings (color, style, size, opacity)
 *
 * Purpose:
 * - Configure crosshair visual appearance
 * - Live updates to cursor system via useCursorSettings hook
 *
 * State Management:
 * - Uses useCursorSettings() hook for cursor system integration
 * - Local cursorColors state synced with cursor settings
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 830-1177
 */
export const CrosshairSettings: React.FC<CrosshairSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Use cursor settings hook για live connection
  let cursorHookResult;
  try {
    cursorHookResult = useCursorSettings();
  } catch (error) {
    console.error('❌ CursorSystem context not available:', error);
    // Fallback to default
    cursorHookResult = {
      settings: DEFAULT_CURSOR_SETTINGS,
      updateSettings: (updates: Partial<typeof DEFAULT_CURSOR_SETTINGS>) => {
        console.log('🔧 Mock updateSettings:', updates);
      }
    };
  }

  const { settings, updateSettings } = cursorHookResult;

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  // State για cursor χρώματα - sync με cursor settings
  const [cursorColors, setCursorColors] = useState<CursorColors>({
    crosshairColor: settings.crosshair.color,

    // Window Selection από settings
    windowFillColor: settings.selection.window.fillColor,
    windowFillOpacity: settings.selection.window.fillOpacity,
    windowBorderColor: settings.selection.window.borderColor,
    windowBorderOpacity: settings.selection.window.borderOpacity,
    windowBorderStyle: settings.selection.window.borderStyle,
    windowBorderWidth: settings.selection.window.borderWidth,

    // Crossing Selection από settings
    crossingFillColor: settings.selection.crossing.fillColor,
    crossingFillOpacity: settings.selection.crossing.fillOpacity,
    crossingBorderColor: settings.selection.crossing.borderColor,
    crossingBorderOpacity: settings.selection.crossing.borderOpacity,
    crossingBorderStyle: settings.selection.crossing.borderStyle,
    crossingBorderWidth: settings.selection.crossing.borderWidth
  });

  // Sync local state όταν αλλάζουν τα cursor settings
  useEffect(() => {
    setCursorColors({
      crosshairColor: settings.crosshair.color,
      windowFillColor: settings.selection.window.fillColor,
      windowFillOpacity: settings.selection.window.fillOpacity,
      windowBorderColor: settings.selection.window.borderColor,
      windowBorderOpacity: settings.selection.window.borderOpacity,
      windowBorderStyle: settings.selection.window.borderStyle,
      windowBorderWidth: settings.selection.window.borderWidth,
      crossingFillColor: settings.selection.crossing.fillColor,
      crossingFillOpacity: settings.selection.crossing.fillOpacity,
      crossingBorderColor: settings.selection.crossing.borderColor,
      crossingBorderOpacity: settings.selection.crossing.borderOpacity,
      crossingBorderStyle: settings.selection.crossing.borderStyle,
      crossingBorderWidth: settings.selection.crossing.borderWidth
    });
  }, [settings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCursorColorsChange = (colors: CursorColors) => {
    setCursorColors(colors);

    // 🔥 LIVE UPDATE - Apply changes στο πραγματικό cursor system
    updateSettings({
      crosshair: {
        ...settings.crosshair,
        color: colors.crosshairColor
      },
      selection: {
        window: {
          fillColor: colors.windowFillColor,
          fillOpacity: colors.windowFillOpacity,
          borderColor: colors.windowBorderColor,
          borderOpacity: colors.windowBorderOpacity,
          borderStyle: colors.windowBorderStyle,
          borderWidth: colors.windowBorderWidth
        },
        crossing: {
          fillColor: colors.crossingFillColor,
          fillOpacity: colors.crossingFillOpacity,
          borderColor: colors.crossingBorderColor,
          borderOpacity: colors.crossingBorderOpacity,
          borderStyle: colors.crossingBorderStyle,
          borderWidth: colors.crossingBorderWidth
        }
      }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Crosshair Color */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Χρώμα</div>
          <div className="font-normal text-gray-400">Χρώμα γραμμών σταυρώνυματος</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border border-gray-500"
            style={{ backgroundColor: cursorColors.crosshairColor }}
          />
          <input
            type="color"
            value={cursorColors.crosshairColor}
            onChange={(e) => handleCursorColorsChange({ ...cursorColors, crosshairColor: e.target.value })}
            className="w-8 h-6 rounded border-0 cursor-pointer"
          />
          <input
            type="text"
            value={cursorColors.crosshairColor}
            onChange={(e) => handleCursorColorsChange({ ...cursorColors, crosshairColor: e.target.value })}
            className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
          />
        </div>
      </div>

      {/* Line Style */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Τύπος Γραμμής</div>
          <div className="font-normal text-gray-400">Στυλ απόδοσης γραμμών</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              updateSettings({ crosshair: { ...settings.crosshair, line_style: 'solid' } });
            }}
            className={`p-2 rounded text-xs border transition-colors ${
              (settings.crosshair.line_style || 'solid') === 'solid'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div
              className="w-full"
              style={{
                height: `${settings.crosshair.line_width}px`,
                backgroundColor: cursorColors.crosshairColor
              }}
            ></div>
            <span className="block mt-1">Συνεχόμενη</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dashed' } })}
            className={`p-2 rounded text-xs border transition-colors ${
              (settings.crosshair.line_style || 'solid') === 'dashed'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div
              className="w-full"
              style={{
                height: `${settings.crosshair.line_width}px`,
                background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 6}px, transparent ${settings.crosshair.line_width * 6}px, transparent ${settings.crosshair.line_width * 12}px)`
              }}
            ></div>
            <span className="block mt-1">Διακεκομμένη</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dotted' } })}
            className={`p-2 rounded text-xs border transition-colors ${
              (settings.crosshair.line_style || 'solid') === 'dotted'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div
              className="w-full"
              style={{
                height: `${settings.crosshair.line_width}px`,
                background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width}px, transparent ${settings.crosshair.line_width}px, transparent ${settings.crosshair.line_width * 8}px)`
              }}
            ></div>
            <span className="block mt-1">Τελείες</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dash-dot' } })}
            className={`p-2 rounded text-xs border transition-colors ${
              (settings.crosshair.line_style || 'solid') === 'dash-dot'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div
              className="w-full"
              style={{
                height: `${settings.crosshair.line_width}px`,
                background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 8}px, transparent ${settings.crosshair.line_width * 8}px, transparent ${settings.crosshair.line_width * 12}px, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 12}px, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 14}px, transparent ${settings.crosshair.line_width * 14}px, transparent ${settings.crosshair.line_width * 22}px)`
              }}
            ></div>
            <span className="block mt-1">Παύλα-Τελεία</span>
          </button>
        </div>
      </div>

      {/* Line Width */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Πάχος Γραμμής</div>
          <div className="font-normal text-gray-400">Πάχος σε pixels</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={settings.crosshair.line_width}
            onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, line_width: parseFloat(e.target.value) } })}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">{settings.crosshair.line_width}px</div>
        </div>
        <div className="flex gap-1">
          {[1, 1.5, 2, 3, 4, 5].map(width => (
            <button
              key={width}
              onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_width: width } })}
              className={`flex-1 p-1 rounded text-xs transition-colors ${
                settings.crosshair.line_width === width
                  ? 'bg-blue-600 border border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border border-gray-500'
              }`}
            >
              <div
                className="w-full mx-auto"
                style={{
                  height: `${width}px`,
                  backgroundColor: cursorColors.crosshairColor
                }}
              ></div>
              <span className="block mt-1 text-xs">{width}px</span>
            </button>
          ))}
        </div>
      </div>

      {/* Size/Type */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Μέγεθος Σταυρονήματος</div>
          <div className="font-normal text-gray-400">Επέκταση από το κέντρο</div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => {
              updateSettings({ crosshair: { ...settings.crosshair, size_percent: 0 } });
            }}
            className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 0
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: cursorColors.crosshairColor }}
              ></div>
            </div>
            <span className="text-xs mt-1">0%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 5 } })}
            className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 5
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center relative">
              {/* Οριζόντια γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 w-3 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  height: '1px'
                }}
              ></div>
              {/* Κάθετη γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 h-3 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  width: '1px'
                }}
              ></div>
            </div>
            <span className="text-xs mt-1">5%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 8 } })}
            className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 8
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center relative">
              {/* Οριζόντια γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 w-4 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  height: '1px'
                }}
              ></div>
              {/* Κάθετη γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 h-4 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  width: '1px'
                }}
              ></div>
            </div>
            <span className="text-xs mt-1">8%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 15 } })}
            className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 15
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center relative">
              {/* Οριζόντια γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 w-5 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  height: '1px'
                }}
              ></div>
              {/* Κάθετη γραμμή */}
              <div
                className="absolute top-1/2 left-1/2 h-5 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  width: '1px'
                }}
              ></div>
            </div>
            <span className="text-xs mt-1">15%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 100 } })}
            className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 100
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center relative">
              {/* Εξωτερικό πλαίσιο */}
              <div
                className="absolute inset-0 border"
                style={{ borderColor: cursorColors.crosshairColor }}
              ></div>
              {/* Οριζόντια γραμμή που φτάνει τα άκρα του πλαισίου */}
              <div
                className="absolute top-1/2 left-0 w-full transform -translate-y-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  height: '1px'
                }}
              ></div>
              {/* Κάθετη γραμμή που φτάνει τα άκρα του πλαισίου */}
              <div
                className="absolute left-1/2 top-0 h-full transform -translate-x-1/2"
                style={{
                  backgroundColor: cursorColors.crosshairColor,
                  width: '1px'
                }}
              ></div>
            </div>
            <span className="text-xs mt-1">Full</span>
          </button>
        </div>
      </div>

      {/* Crosshair Opacity */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Διαφάνεια Σταυρονήματος</div>
          <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του σταυρονήματος</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.crosshair.opacity || 0.9}
            onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, opacity: parseFloat(e.target.value) } })}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {Math.round((settings.crosshair.opacity || 0.9) * 100)}%
          </div>
        </div>
      </div>

      {/* Cursor Gap Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Cursor Gap</div>
          <div className="font-normal text-gray-400">Οι γραμμές ξεκινάνε έξω από τον κέρσορα</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: false } })}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !settings.crosshair.use_cursor_gap
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ανενεργό
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: true } })}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              settings.crosshair.use_cursor_gap
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ενεργό
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrosshairSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 830-1177
 * Original: Inline UI in 'crosshair' tab of cursor category
 *
 * Changes:
 * - ✅ Extracted all crosshair UI to standalone component
 * - ✅ Integrated useCursorSettings hook
 * - ✅ Local cursorColors state with sync logic
 * - ✅ Live updates to cursor system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (CrosshairSettings = Crosshair UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (CursorCategory)
 */
