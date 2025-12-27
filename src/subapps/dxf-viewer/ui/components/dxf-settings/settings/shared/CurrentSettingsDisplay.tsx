import React, { useState, useEffect } from 'react';
import { useUnifiedTextPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineType } from '../../../../../settings-core/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface LineSettings {
  lineType: LineType;
  color: string;
  lineWidth: number;
  opacity: number;
  dashScale?: number;
  dashOffset?: number;
  lineCap?: string;
  lineJoin?: string;
}

interface TextSettings {
  color: string;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
}

interface GripSettings {
  showGrips: boolean;
  gripSize: number;
  gripShape: 'square' | 'circle';
  showFill: boolean;
  colors: {
    cold: string;
    warm: string;
    hot: string;
  };
}

interface CurrentSettingsDisplayProps {
  activeTab: string | null; // 'lines' | 'text' | 'grips' | null
  lineSettings: LineSettings;
  textSettings: TextSettings;
  gripSettings: GripSettings;
  className?: string;
}

export function CurrentSettingsDisplay({
  activeTab,
  lineSettings,
  textSettings,
  gripSettings,
  className = ''
}: CurrentSettingsDisplayProps) {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [showSettingsDetails, setShowSettingsDetails] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  // 🔥 ΔΙΟΡΘΩΣΗ: Χρήση του πραγματικού hook για text settings
  const { settings: { textSettings: liveTextSettings } } = useUnifiedTextPreview();

  // 🔥 ΤΕΛΙΚΗ ΔΙΟΡΘΩΣΗ: Πάντα χρησιμοποιούμε τα live settings για 'text'
  const effectiveTextSettings = activeTab === 'text' ? liveTextSettings : textSettings;

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  const lineColorBgClass = useDynamicBackgroundClass(lineSettings.color);
  const textColorBgClass = useDynamicBackgroundClass(effectiveTextSettings.color);
  const gripColdColorBgClass = useDynamicBackgroundClass(gripSettings.colors.cold);
  const gripWarmColorBgClass = useDynamicBackgroundClass(gripSettings.colors.warm);
  const gripHotColorBgClass = useDynamicBackgroundClass(gripSettings.colors.hot);

  // 🔥 ΔΙΟΡΘΩΣΗ: Force re-render όταν αλλάζουν τα settings
  useEffect(() => {

    setForceUpdate(prev => prev + 1);
  }, [effectiveTextSettings, lineSettings, gripSettings, activeTab]);

  return (
    <div className={`space-y-3 ${className}`}>
      <label className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-colors ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK}`}>
        <input
          type="checkbox"
          checked={showSettingsDetails}
          onChange={(e) => setShowSettingsDetails(e.target.checked)}
          className={`rounded ${getStatusBorder('default')} ${colors.text.info} focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary`}
        />
        <div className="flex items-center gap-2">
          <span>📋</span>
          <span className={`text-sm font-medium ${colors.text.info}`}>Τρέχουσες Ρυθμίσεις</span>
        </div>
      </label>

      {showSettingsDetails && (
        <div className={`${colors.bg.primary} rounded-lg ${getStatusBorder('default')} p-3`}>
          {activeTab === 'lines' && (
            <div>
              <div className={`px-3 py-2 ${colors.bg.secondary} font-medium ${colors.text.info} text-sm rounded-t-lg mb-3`}>
                📏 Γραμμή
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Τύπος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Χρώμα:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center gap-2`}>
                    {lineSettings.color}
                    <div
                      className={`w-3 h-3 rounded ${getStatusBorder('secondary')} ${lineColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Πάχος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineWidth}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Διαφάνεια:</span>
                  <span className={`${colors.text.primary} font-mono`}>{Math.round(lineSettings.opacity * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Κλίμακα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.dashScale || 1.0}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Μετατόπιση:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.dashOffset || 0}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Άκρα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineCap || 'butt'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Συνδέσεις:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineJoin || 'miter'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div>
              <div className={`px-3 py-2 ${colors.bg.secondary} font-medium text-green-400 text-sm rounded-t-lg mb-3`}>
                📝 Κείμενο
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Χρώμα:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center gap-2`}>
                    {effectiveTextSettings.color}
                    <div
                      className={`w-3 h-3 rounded ${getStatusBorder('secondary')} ${textColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Μέγεθος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.fontSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Γραμματοσειρά:</span>
                  <span className="text-white font-mono truncate">{effectiveTextSettings.fontFamily}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Στυλ:</span>
                  <span className={`${colors.text.primary} font-mono`}>
                    {effectiveTextSettings.isBold && 'Β'}{effectiveTextSettings.isItalic && 'Ι'}{effectiveTextSettings.isUnderline && 'Υ'}
                    {!effectiveTextSettings.isBold && !effectiveTextSettings.isItalic && !effectiveTextSettings.isUnderline && 'Κανονικό'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Εκθέτης:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.isSuperscript ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Δείκτης:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.isSubscript ? 'Ναι' : 'Όχι'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grips' && (
            <div>
              <div className={`px-3 py-2 ${colors.bg.secondary} font-medium text-yellow-400 text-sm rounded-t-lg mb-3`}>
                🔺 Grips
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Ενεργά:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.showGrips ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Μέγεθος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.gripSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Σχήμα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.gripShape === 'square' ? 'Τετράγωνο' : 'Κύκλος'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Γέμισμα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.showFill ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Χρώμα Cold:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center gap-2`}>
                    {gripSettings.colors.cold}
                    <div
                      className={`w-3 h-3 rounded ${getStatusBorder('secondary')} ${gripColdColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="${colors.text.muted}">Χρώμα Warm:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center gap-2`}>
                    {gripSettings.colors.warm}
                    <div
                      className={`w-3 h-3 rounded ${getStatusBorder('secondary')} ${gripWarmColorBgClass}`}
                    ></div>
                  </span>
                </div>
              </div>
            </div>
          )}

          {!activeTab && (
            <div className={`text-center ${colors.text.muted} text-sm py-4`}>
              Επιλέξτε μια καρτέλα (Γραμμές, Κείμενο ή Grips) για να δείτε τις τρέχουσες ρυθμίσεις
            </div>
          )}
        </div>
      )}
    </div>
  );
}