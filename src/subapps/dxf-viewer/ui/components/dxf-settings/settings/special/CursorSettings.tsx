'use client';

import React from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  getCursorPreviewBorderStyles,
  getCursorShapeButtonStyles,
  getCursorColorPreviewStyles,
  getCursorLinePreviewStyles,
  getCursorSizePreviewStyles,
  getCursorDimensionPreviewStyles
} from '../../../../DxfViewerComponents.styles';

export function CursorSettings() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
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
    <article className="p-4 space-y-4 max-h-96 overflow-y-auto">
      {/* 🏢 ENTERPRISE: Semantic header για section */}
      <header className={`text-lg font-medium ${colors.text.primary} ${getDirectionalBorder('muted', 'bottom')} pb-2`}>
        Ρυθμίσεις Κέρσορα
      </header>

      {/* Cursor Shape - 🏢 ENTERPRISE: Semantic section αντί nested divs */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Σχήμα Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Επιλογή μεταξύ κύκλου και τετραγώνου</p>
        <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCursorShapeChange('circle')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.shape === 'circle'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto ${radius.full} border`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className="block mt-1">Κύκλος</span>
              </button>
              <button
                onClick={() => handleCursorShapeChange('square')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.shape === 'square'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto border`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className="block mt-1">Τετράγωνο</span>
              </button>
            </div>
      </section>

      {/* Cursor Color - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.secondary}`}>Χρώμα Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Χρώμα περιγράμματος κέρσορα</p>
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
      </section>

      {/* Cursor Line Style - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Είδος Γραμμής</h4>
        <p className={`text-xs ${colors.text.muted}`}>Στυλ περιγράμματος κέρσορα</p>
        <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCursorLineStyleChange('solid')}
                className={`p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.line_style === 'solid'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
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
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
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
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
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
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dash-dot')}
                ></div>
                <span className="block mt-1">Παύλα-Τελεία</span>
              </button>
            </div>
      </section>

      {/* Cursor Line Width - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Πάχος Γραμμής Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Πάχος περιγράμματος σε pixels</p>
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
          <div className={`${iconSizes.xs} text-xs ${colors.bg.muted} ${colors.text.primary} ${radius.md} px-2 py-1 text-center`}>{settings.cursor.line_width || 1}px</div>
        </div>
        <div className="flex gap-1">
          {[1, 1.5, 2, 3, 4, 5].map(width => (
            <button
              key={width}
              onClick={() => handleCursorLineWidthChange(width)}
              className={`flex-1 p-1 ${radius.md} text-xs transition-colors ${
                (settings.cursor.line_width || 1) === width
                  ? `${colors.bg.primary} ${getStatusBorder('info')}`
                  : `${colors.bg.muted} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
              }`}
            >
              <div
                className="w-full mx-auto border"
                style={getCursorSizePreviewStyles(settings.cursor.color, settings.cursor.shape, width)}
              ></div>
              <span className="block mt-1 text-xs">{width}px</span>
            </button>
          ))}
        </div>
      </section>

      {/* Cursor Size - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Μέγεθος Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Διάμετρος/πλευρά σε pixels</p>
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
              <div className={`${iconSizes.xs} text-xs ${colors.bg.muted} ${colors.text.primary} ${radius.md} px-2 py-1 text-center`}>{settings.cursor.size}px</div>
            </div>
            <div className="flex gap-1">
              {[5, 10, 15, 25, 50].map(size => (
                <button
                  key={size}
                  onClick={() => handleCursorSizeChange(size)}
                  className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                    settings.cursor.size === size
                      ? `${getStatusBorder('info')} ${colors.bg.primary}`
                      : `${getStatusBorder('default')} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
                  }`}
                >
                  <div
                    className="mx-auto border"
                    style={getCursorDimensionPreviewStyles(settings.cursor.color, settings.cursor.shape, size)}
                  ></div>
                  <span className="block mt-1 text-xs">{size}px</span>
                </button>
              ))}
        </div>
      </section>

      {/* Cursor Opacity - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Διαφάνεια Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Επίπεδο διαφάνειας του κέρσορα</p>
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
              <div className={`${iconSizes.xs} text-xs ${colors.bg.muted} ${colors.text.primary} ${radius.md} px-2 py-1 text-center`}>{Math.round(settings.cursor.opacity * 100)}%</div>
        </div>
      </section>

      {/* Show/Hide Cursor - 🏢 ENTERPRISE: Semantic section */}
      <section className={`p-2 ${colors.bg.secondary} ${radius.lg} space-y-2`}>
        <h4 className={`font-medium text-sm ${colors.text.primary}`}>Εμφάνιση Κέρσορα</h4>
        <p className={`text-xs ${colors.text.muted}`}>Εμφάνιση/απόκρυψη κύκλου κέρσορα</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleCursorEnabledChange(true)}
                className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                  settings.cursor.enabled
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                Ενεργό
              </button>
              <button
                onClick={() => handleCursorEnabledChange(false)}
                className={`flex-1 p-2 ${quick.button} text-xs transition-colors ${
                  !settings.cursor.enabled
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                Απενεργοποιημένο
              </button>
        </div>
      </section>
    </article>
  );
}