import React, { useState } from 'react';

// Mock data και types για UI-only functionality
interface MockCursorColors {
  windowFillColor: string;
  windowFillOpacity: number;
  windowBorderColor: string;
  windowBorderOpacity: number;
  windowBorderWidth: number;
  windowBorderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
  crossingFillColor: string;
  crossingFillOpacity: number;
  crossingBorderColor: string;
  crossingBorderOpacity: number;
  crossingBorderWidth: number;
  crossingBorderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
}

export function SelectionSettings() {
  const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');

  // Mock state που μιμείται τα actual props από dxf-viewer-kalo
  const [cursorColors, setCursorColors] = useState<MockCursorColors>({
    windowFillColor: '#0080ff',
    windowFillOpacity: 0.2,
    windowBorderColor: '#0080ff',
    windowBorderOpacity: 0.9,
    windowBorderWidth: 2,
    windowBorderStyle: 'solid',
    crossingFillColor: '#00ff00',
    crossingFillOpacity: 0.2,
    crossingBorderColor: '#00ff00',
    crossingBorderOpacity: 0.9,
    crossingBorderWidth: 2,
    crossingBorderStyle: 'solid'
  });

  // Mock functions
  const handleCursorColorsChange = (colors: MockCursorColors) => {
    setCursorColors(colors);
  };

  const handleResetSelectionSettings = () => {
    setCursorColors({
      windowFillColor: '#0080ff',
      windowFillOpacity: 0.2,
      windowBorderColor: '#0080ff',
      windowBorderOpacity: 0.9,
      windowBorderWidth: 2,
      windowBorderStyle: 'solid',
      crossingFillColor: '#00ff00',
      crossingFillOpacity: 0.2,
      crossingBorderColor: '#00ff00',
      crossingBorderOpacity: 0.9,
      crossingBorderWidth: 2,
      crossingBorderStyle: 'solid'
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
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          🔵 Window Selection
        </button>
        <button
          onClick={() => setActiveSelectionTab('crossing')}
          className={`px-3 py-2 text-xs rounded-t transition-colors ${
            activeSelectionTab === 'crossing'
              ? 'bg-blue-600 text-white border-b-2 border-blue-400'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          🟢 Crossing Selection
        </button>
      </div>

      {/* TEMPORARY DEBUG BUTTON */}
      <div className="mb-4 p-2 bg-red-900 rounded">
        <button
          onClick={handleResetSelectionSettings}
          className="w-full px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
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
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Γεμίσματος</div>
              <div className="font-normal text-gray-400">Εσωτερικό χρώμα κουτιού</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-500"
                style={{ backgroundColor: cursorColors.windowFillColor }}
              />
              <input
                type="color"
                value={cursorColors.windowFillColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowFillColor: e.target.value })}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={cursorColors.windowFillColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowFillColor: e.target.value })}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                placeholder="#ffffff"
              />
            </div>
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
                value={cursorColors.windowFillOpacity}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowFillOpacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(cursorColors.windowFillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Window Border Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Περιγράμματος</div>
              <div className="font-normal text-gray-400">Εξωτερική γραμμή κουτιού</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-500"
                style={{ backgroundColor: cursorColors.windowBorderColor }}
              />
              <input
                type="color"
                value={cursorColors.windowBorderColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowBorderColor: e.target.value })}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={cursorColors.windowBorderColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowBorderColor: e.target.value })}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                placeholder="#ffffff"
              />
            </div>
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
                value={cursorColors.windowBorderOpacity}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowBorderOpacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(cursorColors.windowBorderOpacity * 100)}%
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
                value={cursorColors.windowBorderWidth || 2}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, windowBorderWidth: parseInt(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {cursorColors.windowBorderWidth || 2}px
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
                const isSelected = cursorColors.windowBorderStyle === style;
                const styleLabels = {
                  solid: 'Συνεχόμενη',
                  dashed: 'Διακεκομμένη',
                  dotted: 'Κουκίδες',
                  'dash-dot': 'Παύλα-Τελεία'
                };

                const getLinePreview = (style: string) => {
                  const color = cursorColors.windowBorderColor;
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
                    onClick={() => handleCursorColorsChange({ ...cursorColors, windowBorderStyle: style })}
                    className={`p-2 rounded text-xs border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
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
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Γεμίσματος</div>
              <div className="font-normal text-gray-400">Εσωτερικό χρώμα κουτιού</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-500"
                style={{ backgroundColor: cursorColors.crossingFillColor }}
              />
              <input
                type="color"
                value={cursorColors.crossingFillColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingFillColor: e.target.value })}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={cursorColors.crossingFillColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingFillColor: e.target.value })}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                placeholder="#ffffff"
              />
            </div>
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
                value={cursorColors.crossingFillOpacity}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingFillOpacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(cursorColors.crossingFillOpacity * 100)}%
              </div>
            </div>
          </div>

          {/* Crossing Border Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Περιγράμματος</div>
              <div className="font-normal text-gray-400">Εξωτερική γραμμή κουτιού</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-500"
                style={{ backgroundColor: cursorColors.crossingBorderColor }}
              />
              <input
                type="color"
                value={cursorColors.crossingBorderColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingBorderColor: e.target.value })}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={cursorColors.crossingBorderColor}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingBorderColor: e.target.value })}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                placeholder="#ffffff"
              />
            </div>
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
                value={cursorColors.crossingBorderOpacity}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingBorderOpacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(cursorColors.crossingBorderOpacity * 100)}%
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
                value={cursorColors.crossingBorderWidth || 2}
                onChange={(e) => handleCursorColorsChange({ ...cursorColors, crossingBorderWidth: parseInt(e.target.value) })}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {cursorColors.crossingBorderWidth || 2}px
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
                const isSelected = cursorColors.crossingBorderStyle === style;
                const styleLabels = {
                  solid: 'Συνεχόμενη',
                  dashed: 'Διακεκομμένη',
                  dotted: 'Κουκίδες',
                  'dash-dot': 'Παύλα-Τελεία'
                };

                const getLinePreview = (style: string) => {
                  const color = cursorColors.crossingBorderColor;
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
                    onClick={() => handleCursorColorsChange({ ...cursorColors, crossingBorderStyle: style })}
                    className={`p-2 rounded text-xs border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
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