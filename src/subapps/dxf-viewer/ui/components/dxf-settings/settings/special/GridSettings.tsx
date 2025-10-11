// GridSettings.tsx - Grid settings UI (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3a
// PURPOSE: Grid settings UI (Specific Settings → Grid → Grid tab with Major/Minor lines)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3a)   ║
 * ║  Parent: categories/GridCategory.tsx (Grid tab)                            ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ║  Hooks: useTabNavigation (Major/Minor lines sub-tabs)                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../systems/rulers-grid/RulersGridSystem';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { TabNavigation } from '../../shared/TabNavigation';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';

export interface GridSettingsProps {
  className?: string;
}

/**
 * GridSettings - Grid visual settings (visibility, size, style, major/minor lines)
 *
 * Purpose:
 * - Configure grid appearance (visibility, size, style)
 * - Major lines settings (color, weight)
 * - Minor lines settings (color, weight)
 * - Live updates to RulersGridSystem via useRulersGridContext
 *
 * Architecture:
 * - Uses useRulersGridContext() hook for grid system integration
 * - Uses useTabNavigation() for Major/Minor sub-tabs
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1216-1441
 */
export const GridSettings: React.FC<GridSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Grid & Rulers context (connected to real system)
  const {
    state: { grid: gridSettings },
    updateGridSettings,
    setGridVisibility
  } = useRulersGridContext();

  // Sub-tabs navigation (Major/Minor lines)
  type GridLinesTab = 'major' | 'minor';
  const { activeTab: activeGridLinesTab, setActiveTab: setActiveGridLinesTab } = useTabNavigation<GridLinesTab>('major');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleGridVisibilityChange = (enabled: boolean) => {
    setGridVisibility(enabled);
  };

  const handleGridSizeChange = (step: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, step }
    });
  };

  const handleGridStyleChange = (style: 'lines' | 'dots' | 'crosses') => {
    updateGridSettings({
      visual: { ...gridSettings.visual, style }
    });
  };

  const handleMajorGridColorChange = (color: string) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, majorGridColor: color }
    });
  };

  const handleMajorGridWeightChange = (weight: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, majorGridWeight: weight }
    });
  };

  const handleMinorGridColorChange = (color: string) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, minorGridColor: color }
    });
  };

  const handleMinorGridWeightChange = (weight: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, minorGridWeight: weight }
    });
  };

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const gridLinesTabs = [
    { id: 'major' as const, label: '📏 Κύριες Γραμμές' },
    { id: 'minor' as const, label: '📐 Δευτερεύουσες Γραμμές' }
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Grid Visibility Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Πλέγματος</div>
          <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη του πλέγματος</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleGridVisibilityChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              gridSettings.visual.enabled
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleGridVisibilityChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !gridSettings.visual.enabled
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ανενεργό
          </button>
        </div>
      </div>

      {/* Grid Size (ΚΟΙΝΟ για όλα) */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Μέγεθος Πλέγματος</div>
          <div className="font-normal text-gray-400">Απόσταση μεταξύ γραμμών πλέγματος (ΚΟΙΝΟ για όλες)</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.5"
            max="50"
            step="0.5"
            value={gridSettings.visual.step}
            onChange={(e) => handleGridSizeChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {gridSettings.visual.step}
          </div>
        </div>
      </div>

      {/* Grid Style Selector (ΚΟΙΝΟ για όλα) */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Στυλ Πλέγματος</div>
          <div className="font-normal text-gray-400">Τύπος εμφάνισης γραμμών πλέγματος</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleGridStyleChange('lines')}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              gridSettings.visual.style === 'lines'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            ─ Γραμμές
          </button>
          <button
            onClick={() => handleGridStyleChange('dots')}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              gridSettings.visual.style === 'dots'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            • Τελείες
          </button>
          <button
            onClick={() => handleGridStyleChange('crosses')}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              gridSettings.visual.style === 'crosses'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            + Σταυροί
          </button>
        </div>
      </div>

      {/* Grid Lines Sub-tabs (Κύριες/Δευτερεύουσες) */}
      <div className="border-t border-gray-600 pt-4">
        <TabNavigation
          tabs={gridLinesTabs}
          activeTab={activeGridLinesTab}
          onTabChange={setActiveGridLinesTab}
          className="mb-4"
        />

        {/* Major Lines Tab Content */}
        {activeGridLinesTab === 'major' ? (
          <div className="space-y-4">
            {/* Major Grid Color */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Κύριων Γραμμών</label>
              <div className="text-xs text-gray-400 mb-2">Χρώμα των κύριων γραμμών πλέγματος</div>
              <ColorDialogTrigger
                value={gridSettings.visual.majorGridColor}
                onChange={handleMajorGridColorChange}
                label={gridSettings.visual.majorGridColor}
                title="Επιλογή Χρώματος Κύριων Γραμμών"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Major Grid Line Weight */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white">
                <div className="font-medium">Πάχος Κύριων Γραμμών</div>
                <div className="font-normal text-gray-400">Πάχος των κύριων γραμμών πλέγματος</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={gridSettings.visual.majorGridWeight}
                  onChange={(e) => handleMajorGridWeightChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                  {gridSettings.visual.majorGridWeight}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Minor Lines Tab Content */
          <div className="space-y-4">
            {/* Minor Grid Color */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Δευτερευουσών Γραμμών</label>
              <div className="text-xs text-gray-400 mb-2">Χρώμα των δευτερευουσών γραμμών πλέγματος</div>
              <ColorDialogTrigger
                value={gridSettings.visual.minorGridColor}
                onChange={handleMinorGridColorChange}
                label={gridSettings.visual.minorGridColor}
                title="Επιλογή Χρώματος Δευτερευουσών Γραμμών"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Minor Grid Line Weight */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white">
                <div className="font-medium">Πάχος Δευτερευουσών Γραμμών</div>
                <div className="font-normal text-gray-400">Πάχος των δευτερευουσών γραμμών πλέγματος</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={gridSettings.visual.minorGridWeight}
                  onChange={(e) => handleMinorGridWeightChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                  {gridSettings.visual.minorGridWeight}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GridSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1216-1441
 * Original: Inline UI in 'grid' tab of grid category (226 lines)
 *
 * Changes:
 * - ✅ Extracted all grid UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Added useTabNavigation for Major/Minor sub-tabs
 * - ✅ Replaced inline tab UI with TabNavigation component
 * - ✅ Live updates to grid system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (GridSettings = Grid UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (GridCategory)
 */
