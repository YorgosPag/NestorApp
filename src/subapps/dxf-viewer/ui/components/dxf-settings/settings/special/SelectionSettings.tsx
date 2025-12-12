import React, { useState } from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

export function SelectionSettings() {
  const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');

  // 🔺 REAL CURSOR SYSTEM INTEGRATION - Αντικατάσταση mock state με πραγματικές ρυθμίσεις
  const { settings, updateSettings } = useCursorSettings();

  // Real handlers που συνδέονται με το CursorSystem
  const handleWindowSelectionChange = (field: string, value: any) => {
    updateSettings({
      selection: {
        ...settings.selection,
        window: { ...settings.selection.window, [field]: value }
      }
    });
  };

  const handleCrossingSelectionChange = (field: string, value: any) => {
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
          fillColor: '#0080ff',
          fillOpacity: 0.2,
          borderColor: '#0080ff',
          borderOpacity: 1.0,
          borderStyle: 'solid' as const,
          borderWidth: 2
        },
        crossing: {
          fillColor: '#00ff80',
          fillOpacity: 0.2,
          borderColor: '#00ff80',
          borderOpacity: 1.0,
          borderStyle: 'dashed' as const,
          borderWidth: 2
        }
      }
    });
  };

  return (
    <div className="p-4">
      {/* Sub-navigation tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
        <button
          onClick={() => setActiveSelectionTab('window')}
          className={`px-3 py-2 text-xs rounded-t transition-colors ${
            activeSelectionTab === 'window'
              ? 'bg-blue-600 text-white border-b-2 border-blue-400'
              : 'bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-gray-200'
          }`}
        >
          🔵 Window Selection
        </button>
        <button
          onClick={() => setActiveSelectionTab('crossing')}
          className={`px-3 py-2 text-xs rounded-t transition-colors ${
            activeSelectionTab === 'crossing'
              ? 'bg-blue-600 text-white border-b-2 border-blue-400'
              : 'bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-gray-200'
          }`}
        >
          🟢 Crossing Selection
        </button>
      </div>

      {/* TEMPORARY DEBUG BUTTON */}
      <div className="mb-4 p-2 bg-red-900 rounded">
        <button
          onClick={handleResetSelectionSettings}
          className="w-full px-3 py-2 text-xs bg-red-600 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} text-white rounded"
        >
          🔄 Reset Selection Settings (DEBUG)
        </button>
        <div className="text-xs text-gray-300 mt-1">
          Κάνει reset όλες τις ρυθμίσεις για να λειτουργήσουν τα νέα borderStyle
        </div>
      </div>

      {/* Tab Content */}
      {activeSelectionTab === 'window' ? (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-white mb-3">🔵 Window Selection Settings</h4>
          <div className="text-xs text-gray-400 mb-4">
            Ρυθμίσεις για το μπλε κουτί επιλογής (αριστερά προς δεξιά)
          </div>

          {/* Window Fill Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium text-gray-200">Χρώμα Γεμίσματος</label>
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
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Γεμίσματος</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του γεμίσματος</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(settings.selection.window.fillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Window Border Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium text-gray-200">Χρώμα Περιγράμματος</label>
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
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Περιγράμματος</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του περιγράμματος</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(settings.selection.window.borderOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Window Border Width */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Πάχος Γραμμής</div>
              <div className="font-normal text-gray-400">Πάχος περιγράμματος σε pixels</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {settings.selection.window.borderWidth}px
              </div>
            </div>
          </div>

          {/* Window Border Style */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Είδος Περιγράμματος</div>
              <div className="font-normal text-gray-400">Τύπος γραμμής περιγράμματος</div>
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
                    className={`p-2 rounded text-xs border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                    }`}
                  >
                    <div
                      className="w-full mb-1"
                      style={{
                        height: '2px',
                        background: getLinePreview(style)
                      }}
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
          <h4 className="text-sm font-medium text-white mb-3">🟢 Crossing Selection Settings</h4>
          <div className="text-xs text-gray-400 mb-4">
            Ρυθμίσεις για το πράσινο κουτί επιλογής (δεξιά προς αριστερά)
          </div>

          {/* Crossing Fill Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium text-gray-200">Χρώμα Γεμίσματος</label>
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
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Γεμίσματος</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του γεμίσματος</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(settings.selection.crossing.fillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Crossing Border Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium text-gray-200">Χρώμα Περιγράμματος</label>
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
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Περιγράμματος</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του περιγράμματος</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(settings.selection.crossing.borderOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Crossing Border Width */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Πάχος Γραμμής</div>
              <div className="font-normal text-gray-400">Πάχος περιγράμματος σε pixels</div>
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
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {settings.selection.crossing.borderWidth}px
              </div>
            </div>
          </div>

          {/* Crossing Border Style */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Είδος Περιγράμματος</div>
              <div className="font-normal text-gray-400">Τύπος γραμμής περιγράμματος</div>
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
                    className={`p-2 rounded text-xs border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                    }`}
                  >
                    <div
                      className="w-full mb-1"
                      style={{
                        height: '2px',
                        background: getLinePreview(style)
                      }}
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