import React, { useState } from 'react';
import { useUnifiedTextPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineType } from '../../../../../settings-core/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Lucide icons replacing emojis
import { ClipboardList, Minus, Type } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized Checkbox component (Radix)
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';

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
  const { getStatusBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added radius
  const colors = useSemanticColors();
  const [showSettingsDetails, setShowSettingsDetails] = useState(false);

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

  // 🏢 ENTERPRISE: Component re-renders naturally when props change - no forced updates needed

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_MD} ${className}`}>
      {/* 🏢 ENTERPRISE: Centralized Radix Checkbox */}
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.SM} ${radius.lg} transition-colors ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK}`}>
        <Checkbox
          id="show-settings-details"
          checked={showSettingsDetails}
          onCheckedChange={(checked) => setShowSettingsDetails(checked === true)}
        />
        <label htmlFor="show-settings-details" className={`flex items-center ${PANEL_LAYOUT.GAP.SM} cursor-pointer`}>
          <ClipboardList className="w-4 h-4" />
          <span className={`text-sm font-medium ${colors.text.info}`}>Τρέχουσες Ρυθμίσεις</span>
        </label>
      </div>

      {showSettingsDetails && (
        <div className={`${colors.bg.primary} ${radius.lg} ${getStatusBorder('default')} ${PANEL_LAYOUT.SPACING.MD}`}>
          {activeTab === 'lines' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} font-medium ${colors.text.info} text-sm rounded-t-lg ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Minus className="w-4 h-4" />
                <span>Γραμμή</span>
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} text-xs`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Τύπος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineType}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Χρώμα:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {lineSettings.color}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${lineColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Πάχος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineWidth}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Διαφάνεια:</span>
                  <span className={`${colors.text.primary} font-mono`}>{Math.round(lineSettings.opacity * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Κλίμακα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.dashScale || 1.0}x</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Μετατόπιση:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.dashOffset || 0}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Άκρα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineCap || 'butt'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Συνδέσεις:</span>
                  <span className={`${colors.text.primary} font-mono`}>{lineSettings.lineJoin || 'miter'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} font-medium ${colors.text.success} text-sm rounded-t-lg ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Type className="w-4 h-4" />
                <span>Κείμενο</span>
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} text-xs`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Χρώμα:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {effectiveTextSettings.color}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${textColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Μέγεθος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.fontSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Γραμματοσειρά:</span>
                  <span className={`${colors.text.primary} font-mono truncate`}>{effectiveTextSettings.fontFamily}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Στυλ:</span>
                  <span className={`${colors.text.primary} font-mono`}>
                    {effectiveTextSettings.isBold && 'Β'}{effectiveTextSettings.isItalic && 'Ι'}{effectiveTextSettings.isUnderline && 'Υ'}
                    {!effectiveTextSettings.isBold && !effectiveTextSettings.isItalic && !effectiveTextSettings.isUnderline && 'Κανονικό'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Εκθέτης:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.isSuperscript ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Δείκτης:</span>
                  <span className={`${colors.text.primary} font-mono`}>{effectiveTextSettings.isSubscript ? 'Ναι' : 'Όχι'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grips' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} font-medium ${colors.text.warning} text-sm rounded-t-lg ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>
                🔺 Grips
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} text-xs`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Ενεργά:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.showGrips ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Μέγεθος:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.gripSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Σχήμα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.gripShape === 'square' ? 'Τετράγωνο' : 'Κύκλος'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Γέμισμα:</span>
                  <span className={`${colors.text.primary} font-mono`}>{gripSettings.showFill ? 'Ναι' : 'Όχι'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Χρώμα Cold:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {gripSettings.colors.cold}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${gripColdColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>Χρώμα Warm:</span>
                  <span className={`${colors.text.primary} font-mono flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {gripSettings.colors.warm}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${gripWarmColorBgClass}`}
                    ></div>
                  </span>
                </div>
              </div>
            </div>
          )}

          {!activeTab && (
            <div className={`text-center ${colors.text.muted} text-sm ${PANEL_LAYOUT.PADDING.TOP_LG} ${PANEL_LAYOUT.PADDING.BOTTOM_LG}`}>
              Επιλέξτε μια καρτέλα (Γραμμές, Κείμενο ή Grips) για να δείτε τις τρέχουσες ρυθμίσεις
            </div>
          )}
        </div>
      )}
    </div>
  );
}