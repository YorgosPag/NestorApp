'use client';

import React, { useState } from 'react';

export function CursorSettings() {
  // Mock state that matches the structure from dxf-viewer-kalo
  const [activeCursorTab, setActiveCursorTab] = useState<'crosshair' | 'cursor'>('crosshair');

  // Mock crosshair settings
  const [crosshairSettings, setCrosshairSettings] = useState({
    line_style: 'solid' as 'solid' | 'dashed' | 'dotted' | 'dash-dot',
    line_width: 2,
    size_percent: 8,
    opacity: 0.9,
    use_cursor_gap: false
  });

  // Mock cursor settings
  const [cursorSettings, setCursorSettings] = useState({
    shape: 'circle' as 'circle' | 'square',
    size: 15,
    color: '#00ff00',
    lineStyle: 'solid' as 'solid' | 'dashed' | 'dotted' | 'dash-dot',
    opacity: 1,
    enabled: true
  });

  // Mock cursor colors
  const [cursorColors, setCursorColors] = useState({
    crosshairColor: '#00ff00'
  });

  // Mock handlers
  const updateCrosshairSettings = (updates: any) => {
    setCrosshairSettings(prev => ({ ...prev, ...updates.crosshair }));
  };

  const handleCursorColorsChange = (colors: any) => {
    setCursorColors(colors);
  };

  const handleCursorShapeChange = (shape: 'circle' | 'square') => {
    setCursorSettings(prev => ({ ...prev, shape }));
  };

  const handleCursorSizeChange = (size: number) => {
    setCursorSettings(prev => ({ ...prev, size }));
  };

  const handleCursorColorChange = (color: string) => {
    setCursorSettings(prev => ({ ...prev, color }));
  };

  const handleCursorLineStyleChange = (lineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot') => {
    setCursorSettings(prev => ({ ...prev, lineStyle }));
  };

  const handleCursorOpacityChange = (opacity: number) => {
    setCursorSettings(prev => ({ ...prev, opacity }));
  };

  const handleCursorEnabledChange = (enabled: boolean) => {
    setCursorSettings(prev => ({ ...prev, enabled }));
  };

  return (
    <div className="p-4">
      {/* Sub-navigation tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
        <button
          onClick={() => setActiveCursorTab('crosshair')}
          className={`px-3 py-2 text-xs rounded-t transition-colors ${
            activeCursorTab === 'crosshair'
              ? 'bg-blue-600 text-white border-b-2 border-blue-400'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          Ρυθμίσεις Σταυρονήματος
        </button>
        <button
          onClick={() => setActiveCursorTab('cursor')}
          className={`px-3 py-2 text-xs rounded-t transition-colors ${
            activeCursorTab === 'cursor'
              ? 'bg-blue-600 text-white border-b-2 border-blue-400'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          Ρυθμίσεις Κέρσορα
        </button>
      </div>

      {/* Tab content */}
      {activeCursorTab === 'crosshair' ? (
        <div className="space-y-4">
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_style: 'solid' } })}
              className={`p-2 rounded text-xs border transition-colors ${
                crosshairSettings.line_style === 'solid'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div
                className="w-full"
                style={{
                  height: `${crosshairSettings.line_width}px`,
                  backgroundColor: cursorColors.crosshairColor
                }}
              ></div>
              <span className="block mt-1">Συνεχόμενη</span>
            </button>
            <button
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_style: 'dashed' } })}
              className={`p-2 rounded text-xs border transition-colors ${
                crosshairSettings.line_style === 'dashed'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div
                className="w-full"
                style={{
                  height: `${crosshairSettings.line_width}px`,
                  background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${crosshairSettings.line_width * 6}px, transparent ${crosshairSettings.line_width * 6}px, transparent ${crosshairSettings.line_width * 12}px)`
                }}
              ></div>
              <span className="block mt-1">Διακεκομμένη</span>
            </button>
            <button
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_style: 'dotted' } })}
              className={`p-2 rounded text-xs border transition-colors ${
                crosshairSettings.line_style === 'dotted'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div
                className="w-full"
                style={{
                  height: `${crosshairSettings.line_width}px`,
                  background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${crosshairSettings.line_width}px, transparent ${crosshairSettings.line_width}px, transparent ${crosshairSettings.line_width * 8}px)`
                }}
              ></div>
              <span className="block mt-1">Τελείες</span>
            </button>
            <button
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_style: 'dash-dot' } })}
              className={`p-2 rounded text-xs border transition-colors ${
                crosshairSettings.line_style === 'dash-dot'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div
                className="w-full"
                style={{
                  height: `${crosshairSettings.line_width}px`,
                  background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${crosshairSettings.line_width * 8}px, transparent ${crosshairSettings.line_width * 8}px, transparent ${crosshairSettings.line_width * 12}px, ${cursorColors.crosshairColor} ${crosshairSettings.line_width * 12}px, ${cursorColors.crosshairColor} ${crosshairSettings.line_width * 14}px, transparent ${crosshairSettings.line_width * 14}px, transparent ${crosshairSettings.line_width * 22}px)`
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
              value={crosshairSettings.line_width}
              onChange={(e) => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_width: parseFloat(e.target.value) } })}
              className="flex-1"
            />
            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">{crosshairSettings.line_width}px</div>
          </div>
          <div className="flex gap-1">
            {[1, 1.5, 2, 3, 4, 5].map(width => (
              <button
                key={width}
                onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, line_width: width } })}
                className={`flex-1 p-1 rounded text-xs transition-colors ${
                  crosshairSettings.line_width === width
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, size_percent: 0 } })}
              className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                crosshairSettings.size_percent === 0
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, size_percent: 5 } })}
              className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                crosshairSettings.size_percent === 5
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <div
                  className="absolute top-1/2 left-1/2 w-3 transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    backgroundColor: cursorColors.crosshairColor,
                    height: '1px'
                  }}
                ></div>
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, size_percent: 8 } })}
              className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                crosshairSettings.size_percent === 8
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <div
                  className="absolute top-1/2 left-1/2 w-4 transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    backgroundColor: cursorColors.crosshairColor,
                    height: '1px'
                  }}
                ></div>
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, size_percent: 15 } })}
              className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                crosshairSettings.size_percent === 15
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <div
                  className="absolute top-1/2 left-1/2 w-5 transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    backgroundColor: cursorColors.crosshairColor,
                    height: '1px'
                  }}
                ></div>
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, size_percent: 100 } })}
              className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                crosshairSettings.size_percent === 100
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <div
                  className="absolute inset-0 border"
                  style={{ borderColor: cursorColors.crosshairColor }}
                ></div>
                <div
                  className="absolute top-1/2 left-0 w-full transform -translate-y-1/2"
                  style={{
                    backgroundColor: cursorColors.crosshairColor,
                    height: '1px'
                  }}
                ></div>
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
              value={crosshairSettings.opacity}
              onChange={(e) => updateCrosshairSettings({ crosshair: { ...crosshairSettings, opacity: parseFloat(e.target.value) } })}
              className="flex-1"
            />
            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
              {Math.round(crosshairSettings.opacity * 100)}%
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
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, use_cursor_gap: false } })}
              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                !crosshairSettings.use_cursor_gap
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              Ανενεργό
            </button>
            <button
              onClick={() => updateCrosshairSettings({ crosshair: { ...crosshairSettings, use_cursor_gap: true } })}
              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                crosshairSettings.use_cursor_gap
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
              }`}
            >
              Ενεργό
            </button>
          </div>
        </div>
        </div>
      ) : (
        // Cursor Settings Tab
        <div className="space-y-4">
          {/* Cursor Shape */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Σχήμα Κέρσορα</div>
              <div className="font-normal text-gray-400">Επιλογή μεταξύ κύκλου και τετραγώνου</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCursorShapeChange('circle')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.shape === 'circle'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-4 h-4 mx-auto rounded-full border-2"
                  style={{ borderColor: cursorSettings.color }}
                ></div>
                <span className="block mt-1">Κύκλος</span>
              </button>
              <button
                onClick={() => handleCursorShapeChange('square')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.shape === 'square'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-4 h-4 mx-auto border-2"
                  style={{ borderColor: cursorSettings.color }}
                ></div>
                <span className="block mt-1">Τετράγωνο</span>
              </button>
            </div>
          </div>

          {/* Cursor Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Κέρσορα</div>
              <div className="font-normal text-gray-400">Χρώμα περιγράμματος κέρσορα</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-500"
                style={{ backgroundColor: cursorSettings.color }}
              />
              <input
                type="color"
                value={cursorSettings.color}
                onChange={(e) => handleCursorColorChange(e.target.value)}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={cursorSettings.color}
                onChange={(e) => handleCursorColorChange(e.target.value)}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
              />
            </div>
          </div>

          {/* Cursor Line Style */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Είδος Γραμμής</div>
              <div className="font-normal text-gray-400">Στυλ περιγράμματος κέρσορα</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCursorLineStyleChange('solid')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.lineStyle === 'solid'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={{
                    height: '2px',
                    backgroundColor: cursorSettings.color
                  }}
                ></div>
                <span className="block mt-1">Συνεχόμενη</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dashed')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.lineStyle === 'dashed'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={{
                    height: '2px',
                    background: `repeating-linear-gradient(to right, ${cursorSettings.color} 0, ${cursorSettings.color} 4px, transparent 4px, transparent 8px)`
                  }}
                ></div>
                <span className="block mt-1">Διακεκομμένη</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dotted')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.lineStyle === 'dotted'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={{
                    height: '2px',
                    background: `repeating-linear-gradient(to right, ${cursorSettings.color} 0, ${cursorSettings.color} 1px, transparent 1px, transparent 8px)`
                  }}
                ></div>
                <span className="block mt-1">Τελείες</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dash-dot')}
                className={`p-2 rounded text-xs border transition-colors ${
                  cursorSettings.lineStyle === 'dash-dot'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={{
                    height: '2px',
                    background: `repeating-linear-gradient(to right, ${cursorSettings.color} 0, ${cursorSettings.color} 8px, transparent 8px, transparent 12px, ${cursorSettings.color} 12px, ${cursorSettings.color} 14px, transparent 14px, transparent 22px)`
                  }}
                ></div>
                <span className="block mt-1">Παύλα-Τελεία</span>
              </button>
            </div>
          </div>

          {/* Cursor Size */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Μέγεθος Κέρσορα</div>
              <div className="font-normal text-gray-400">Διάμετρος/πλευρά σε pixels</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="3"
                max="50"
                step="1"
                value={cursorSettings.size}
                onChange={(e) => handleCursorSizeChange(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">{cursorSettings.size}px</div>
            </div>
            <div className="flex gap-1">
              {[5, 10, 15, 25, 50].map(size => (
                <button
                  key={size}
                  onClick={() => handleCursorSizeChange(size)}
                  className={`flex-1 p-2 rounded text-xs transition-colors border ${
                    cursorSettings.size === size
                      ? 'border-blue-500 bg-blue-600'
                      : 'border-gray-500 bg-gray-600 hover:bg-blue-600'
                  }`}
                >
                  <div
                    className={`mx-auto border-2 ${cursorSettings.shape === 'circle' ? 'rounded-full' : 'rounded-none'}`}
                    style={{
                      borderColor: cursorSettings.color,
                      width: `${Math.min(size, 16)}px`,
                      height: `${Math.min(size, 16)}px`
                    }}
                  ></div>
                  <span className="block mt-1 text-xs">{size}px</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cursor Opacity */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Κέρσορα</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του κέρσορα</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={cursorSettings.opacity}
                onChange={(e) => handleCursorOpacityChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">{Math.round(cursorSettings.opacity * 100)}%</div>
            </div>
          </div>

          {/* Show/Hide Cursor */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Εμφάνιση Κέρσορα</div>
              <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη κύκλου κέρσορα</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCursorEnabledChange(true)}
                className={`flex-1 p-2 rounded text-xs border transition-colors ${
                  cursorSettings.enabled
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                Ενεργό
              </button>
              <button
                onClick={() => handleCursorEnabledChange(false)}
                className={`flex-1 p-2 rounded text-xs border transition-colors ${
                  !cursorSettings.enabled
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                Απενεργοποιημένο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}