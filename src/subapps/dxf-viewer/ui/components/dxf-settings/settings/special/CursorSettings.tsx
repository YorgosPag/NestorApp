'use client';

import React, { useState } from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import {
  getCursorPreviewBorderStyles,
  getCursorShapeButtonStyles,
  getCursorColorPreviewStyles,
  getCursorLinePreviewStyles,
  getCursorSizePreviewStyles,
  getCursorDimensionPreviewStyles
} from '../../../../DxfViewerComponents.styles';

// Type definitions for cursor and crosshair settings
type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export function CursorSettings() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  // Αφαιρείται το tab state - όλες οι ρυθμίσεις θα εμφανίζονται μαζί

  // 🔺 REAL CURSOR SYSTEM INTEGRATION - Αντικατάσταση mock state
  const { settings, updateSettings } = useCursorSettings();

  // Real handlers που συνδέονται με το CursorSystem

  const handleCursorShapeChange = (shape: 'circle' | 'square') => {
    updateSettings({
      cursor: { ...settings.cursor, shape }
    });
  };

  const handleCursorSizeChange = (size: number) => {
    updateSettings({
      cursor: { ...settings.cursor, size }
    });
  };

  const handleCursorColorChange = (color: string) => {
    updateSettings({
      cursor: { ...settings.cursor, color }
    });
  };

  const handleCursorLineStyleChange = (lineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot') => {
    updateSettings({
      cursor: { ...settings.cursor, line_style: lineStyle }
    });
  };

  const handleCursorOpacityChange = (opacity: number) => {
    updateSettings({
      cursor: { ...settings.cursor, opacity }
    });
  };

  const handleCursorEnabledChange = (enabled: boolean) => {
    updateSettings({
      cursor: { ...settings.cursor, enabled }
    });
  };

  const handleCursorLineWidthChange = (lineWidth: number) => {
    updateSettings({
      cursor: { ...settings.cursor, line_width: lineWidth }
    });
  };

  return (
    <div className="p-4 space-y-6 max-h-96 overflow-y-auto">

      {/* CURSOR SETTINGS SECTION */}
      <div className="space-y-4">
        <div className="text-lg font-medium text-white border-b border-gray-600 pb-2">
          Ρυθμίσεις Κέρσορα
        </div>
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
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.shape === 'circle'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto rounded-full border-2`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className="block mt-1">Κύκλος</span>
              </button>
              <button
                onClick={() => handleCursorShapeChange('square')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.shape === 'square'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto border-2`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className="block mt-1">Τετράγωνο</span>
              </button>
            </div>
          </div>

          {/* Cursor Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium text-gray-200">Χρώμα Κέρσορα</label>
            <div className="text-xs text-gray-400 mb-2">Χρώμα περιγράμματος κέρσορα</div>
            <ColorDialogTrigger
              value={settings.cursor.color}
              onChange={handleCursorColorChange}
              label={settings.cursor.color}
              title="Επιλογή Χρώματος Κέρσορα"
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
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
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.line_style === 'solid'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'solid')}
                ></div>
                <span className="block mt-1">Συνεχόμενη</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dashed')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.line_style === 'dashed'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dashed')}
                ></div>
                <span className="block mt-1">Διακεκομμένη</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => handleCursorLineStyleChange('dotted')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.line_style === 'dotted'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dotted')}
                ></div>
                <span className="block mt-1">Τελείες</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dash-dot')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.line_style === 'dash-dot'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dash-dot')}
                ></div>
                <span className="block mt-1">Παύλα-Τελεία</span>
              </button>
            </div>
          </div>

          {/* Cursor Line Width */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Πάχος Γραμμής Κέρσορα</div>
              <div className="font-normal text-gray-400">Πάχος περιγράμματος σε pixels</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={settings.cursor.line_width || 1}
                onChange={(e) => handleCursorLineWidthChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${iconSizes.xs} text-xs bg-gray-600 text-white rounded px-2 py-1 text-center`}>{settings.cursor.line_width || 1}px</div>
            </div>
            <div className="flex gap-1">
              {[1, 1.5, 2, 3, 4, 5].map(width => (
                <button
                  key={width}
                  onClick={() => handleCursorLineWidthChange(width)}
                  className={`flex-1 p-1 rounded text-xs transition-colors ${
                    (settings.cursor.line_width || 1) === width
                      ? 'bg-blue-600 border border-blue-500'
                      : `bg-gray-600 border border-gray-500 ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
                  }`}
                >
                  <div
                    className="w-full mx-auto border-2"
                    style={getCursorSizePreviewStyles(settings.cursor.color, settings.cursor.shape, width)}
                  ></div>
                  <span className="block mt-1 text-xs">{width}px</span>
                </button>
              ))}
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
                value={settings.cursor.size}
                onChange={(e) => handleCursorSizeChange(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`${iconSizes.xs} text-xs bg-gray-600 text-white rounded px-2 py-1 text-center`}>{settings.cursor.size}px</div>
            </div>
            <div className="flex gap-1">
              {[5, 10, 15, 25, 50].map(size => (
                <button
                  key={size}
                  onClick={() => handleCursorSizeChange(size)}
                  className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                    settings.cursor.size === size
                      ? 'border-blue-500 bg-blue-600'
                      : `border-gray-500 bg-gray-600 ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
                  }`}
                >
                  <div
                    className="mx-auto border-2"
                    style={getCursorDimensionPreviewStyles(settings.cursor.color, settings.cursor.shape, size)}
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
                value={settings.cursor.opacity}
                onChange={(e) => handleCursorOpacityChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${iconSizes.xs} text-xs bg-gray-600 text-white rounded px-2 py-1 text-center`}>{Math.round(settings.cursor.opacity * 100)}%</div>
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
                className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.enabled
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                Ενεργό
              </button>
              <button
                onClick={() => handleCursorEnabledChange(false)}
                className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                  !settings.cursor.enabled
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500'
                }`}
              >
                Απενεργοποιημένο
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}