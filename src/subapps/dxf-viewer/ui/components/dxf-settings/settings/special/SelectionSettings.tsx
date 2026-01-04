import React, { useState } from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { UI_COLORS } from '../../../../../config/color-config';
import { RotateCcw, Square, SquareDashed } from 'lucide-react';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';

export function SelectionSettings() {
  const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');

  // 🔺 REAL CURSOR SYSTEM INTEGRATION - Αντικατάσταση mock state με πραγματικές ρυθμίσεις
  const { settings, updateSettings } = useCursorSettings();
  const { getStatusBorder, getElementBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Type-safe selection field value type
  type SelectionFieldValue = string | number | 'solid' | 'dashed' | 'dotted' | 'dash-dot';

  // Real handlers που συνδέονται με το CursorSystem
  const handleWindowSelectionChange = (field: string, value: SelectionFieldValue) => {
    updateSettings({
      selection: {
        ...settings.selection,
        window: { ...settings.selection.window, [field]: value }
      }
    });
  };

  const handleCrossingSelectionChange = (field: string, value: SelectionFieldValue) => {
    updateSettings({
      selection: {
        ...settings.selection,
        crossing: { ...settings.selection.crossing, [field]: value }
      }
    });
  };

  const handleResetSelectionSettings = () => {
    updateSettings({
      selection: {
        window: {
          fillColor: UI_COLORS.GRID_BLUE,
          fillOpacity: 0.2,
          borderColor: UI_COLORS.GRID_BLUE,
          borderOpacity: 1.0,
          borderStyle: 'solid' as const,
          borderWidth: 2
        },
        crossing: {
          fillColor: UI_COLORS.DRAWING_PREVIEW,
          fillOpacity: 0.2,
          borderColor: UI_COLORS.DRAWING_PREVIEW,
          borderOpacity: 1.0,
          borderStyle: 'dashed' as const,
          borderWidth: 2
        }
      }
    });
  };

  // 🏢 ENTERPRISE: Selection tab type
  type SelectionTab = 'window' | 'crossing';

  // 🏢 ENTERPRISE: Tabs definition using centralized TabDefinition interface
  const selectionTabs: TabDefinition[] = [
    {
      id: 'window',
      label: 'Window Selection',
      icon: Square,
      content: null, // Content rendered separately below
    },
    {
      id: 'crossing',
      label: 'Crossing Selection',
      icon: SquareDashed,
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to SelectionTab
  const handleTabChange = (tabId: string) => {
    setActiveSelectionTab(tabId as SelectionTab);
  };

  return (
    <div className={`p-4 ${colors.bg.primary} ${colors.text.primary}`}>
      {/* 🏢 ENTERPRISE: Selection Tabs - Using centralized TabsOnlyTriggers */}
      <div className="mb-4">
        <TabsOnlyTriggers
          tabs={selectionTabs}
          value={activeSelectionTab}
          onTabChange={handleTabChange}
          theme="dark"
          alwaysShowLabels={true}
        />
      </div>

      {/* TEMPORARY DEBUG BUTTON */}
      {/* ✅ ENTERPRISE: Κεντρικοποιημένα colors και Lucide icon */}
      <div className={`mb-4 p-3 ${colors.bg.secondary} ${getStatusBorder('warning')} rounded`}>
        <button
          onClick={handleResetSelectionSettings}
          className={`w-full px-3 py-2 text-xs flex items-center justify-center gap-2 ${colors.bg.card} ${colors.text.primary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${getStatusBorder('default')} rounded transition-colors`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Selection Settings (DEBUG)</span>
        </button>
        <div className={`text-xs ${colors.text.muted} mt-2`}>
          Κάνει reset όλες τις ρυθμίσεις για να λειτουργήσουν τα νέα borderStyle
        </div>
      </div>

      {/* Tab Content */}
      {activeSelectionTab === 'window' ? (
        <div className="space-y-4">
          <h4 className={`text-sm font-medium ${colors.text.primary} mb-3 flex items-center gap-2`}>
            <Square className="w-4 h-4 text-blue-500" />
            <span>Window Selection Settings</span>
          </h4>
          <div className={`text-xs ${colors.text.muted} mb-4`}>
            Ρυθμίσεις για το μπλε κουτί επιλογής (αριστερά προς δεξιά)
          </div>

          {/* Window Fill Color */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Γεμίσματος</label>
            <ColorDialogTrigger
              value={settings.selection.window.fillColor}
              onChange={(color) => handleWindowSelectionChange('fillColor', color)}
              label={settings.selection.window.fillColor}
              title="Επιλογή Χρώματος Γεμίσματος Window"
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Window Fill Opacity */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Διαφάνεια Γεμίσματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας του γεμίσματος</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.window.fillOpacity}
                onChange={(e) => handleWindowSelectionChange('fillOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {Math.round(settings.selection.window.fillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Window Border Color */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Περιγράμματος</label>
            <ColorDialogTrigger
              value={settings.selection.window.borderColor}
              onChange={(color) => handleWindowSelectionChange('borderColor', color)}
              label={settings.selection.window.borderColor}
              title="Επιλογή Χρώματος Περιγράμματος Window"
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Window Border Opacity */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Διαφάνεια Περιγράμματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας του περιγράμματος</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.window.borderOpacity}
                onChange={(e) => handleWindowSelectionChange('borderOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {Math.round(settings.selection.window.borderOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Window Border Width */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Πάχος Γραμμής</div>
              <div className={`font-normal ${colors.text.muted}`}>Πάχος περιγράμματος σε pixels</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.selection.window.borderWidth}
                onChange={(e) => handleWindowSelectionChange('borderWidth', parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {settings.selection.window.borderWidth}px
              </div>
            </div>
          </div>

          {/* Window Border Style */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Είδος Περιγράμματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Τύπος γραμμής περιγράμματος</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
                const isSelected = settings.selection.window.borderStyle === style;
                const styleLabels = {
                  solid: 'Συνεχόμενη',
                  dashed: 'Διακεκομμένη',
                  dotted: 'Κουκίδες',
                  'dash-dot': 'Παύλα-Τελεία'
                };

                const getLinePreview = (style: string) => {
                  const color = settings.selection.window.borderColor;
                  switch (style) {
                    case 'dashed':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
                    case 'dotted':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
                    case 'dash-dot':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
                    default:
                      return color;
                  }
                };

                return (
                  <button
                    key={style}
                    onClick={() => handleWindowSelectionChange('borderStyle', style)}
                    className={`p-2 rounded text-xs transition-colors ${
                      isSelected
                        ? `${colors.bg.primary} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getElementBorder('button', 'default')}`
                    }`}
                  >
                    <div
                      className="w-full mb-1 h-0.5"
                      style={{ background: getLinePreview(style) }}
                    />
                    <span className="block text-xs">{styleLabels[style]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className={`text-sm font-medium ${colors.text.primary} mb-3 flex items-center gap-2`}>
            <SquareDashed className="w-4 h-4 text-green-500" />
            <span>Crossing Selection Settings</span>
          </h4>
          <div className={`text-xs ${colors.text.muted} mb-4`}>
            Ρυθμίσεις για το πράσινο κουτί επιλογής (δεξιά προς αριστερά)
          </div>

          {/* Crossing Fill Color */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Γεμίσματος</label>
            <ColorDialogTrigger
              value={settings.selection.crossing.fillColor}
              onChange={(color) => handleCrossingSelectionChange('fillColor', color)}
              label={settings.selection.crossing.fillColor}
              title="Επιλογή Χρώματος Γεμίσματος Crossing"
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Crossing Fill Opacity */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Διαφάνεια Γεμίσματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας του γεμίσματος</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.crossing.fillOpacity}
                onChange={(e) => handleCrossingSelectionChange('fillOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {Math.round(settings.selection.crossing.fillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Crossing Border Color */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Περιγράμματος</label>
            <ColorDialogTrigger
              value={settings.selection.crossing.borderColor}
              onChange={(color) => handleCrossingSelectionChange('borderColor', color)}
              label={settings.selection.crossing.borderColor}
              title="Επιλογή Χρώματος Περιγράμματος Crossing"
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Crossing Border Opacity */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Διαφάνεια Περιγράμματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας του περιγράμματος</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.crossing.borderOpacity}
                onChange={(e) => handleCrossingSelectionChange('borderOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {Math.round(settings.selection.crossing.borderOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Crossing Border Width */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Πάχος Γραμμής</div>
              <div className={`font-normal ${colors.text.muted}`}>Πάχος περιγράμματος σε pixels</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.selection.crossing.borderWidth}
                onChange={(e) => handleCrossingSelectionChange('borderWidth', parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                {settings.selection.crossing.borderWidth}px
              </div>
            </div>
          </div>

          {/* Crossing Border Style */}
          <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
            <div className={`text-sm ${colors.text.primary}`}>
              <div className="font-medium">Είδος Περιγράμματος</div>
              <div className={`font-normal ${colors.text.muted}`}>Τύπος γραμμής περιγράμματος</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
                const isSelected = settings.selection.crossing.borderStyle === style;
                const styleLabels = {
                  solid: 'Συνεχόμενη',
                  dashed: 'Διακεκομμένη',
                  dotted: 'Κουκίδες',
                  'dash-dot': 'Παύλα-Τελεία'
                };

                const getLinePreview = (style: string) => {
                  const color = settings.selection.crossing.borderColor;
                  switch (style) {
                    case 'dashed':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
                    case 'dotted':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
                    case 'dash-dot':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
                    default:
                      return color;
                  }
                };

                return (
                  <button
                    key={style}
                    onClick={() => handleCrossingSelectionChange('borderStyle', style)}
                    className={`p-2 rounded text-xs transition-colors ${
                      isSelected
                        ? `${colors.bg.primary} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getElementBorder('button', 'default')}`
                    }`}
                  >
                    <div
                      className="w-full mb-1 h-0.5"
                      style={{ background: getLinePreview(style) }}
                    />
                    <span className="block text-xs">{styleLabels[style]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}