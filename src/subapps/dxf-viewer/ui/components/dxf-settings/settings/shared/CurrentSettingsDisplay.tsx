import React, { useState } from 'react';
import { useUnifiedTextPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineType } from '../../../../../settings-core/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Lucide icons replacing emojis
import { ClipboardList, Minus, Type, Grid } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized Checkbox component (Radix)
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('dxf-viewer');
  const { getStatusBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added radius
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();  // ✅ ENTERPRISE: Centralized icon sizes
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
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.SM} ${radius.lg} ${PANEL_LAYOUT.TRANSITION.COLORS} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK}`}>
        <Checkbox
          id="show-settings-details"
          checked={showSettingsDetails}
          onCheckedChange={(checked) => setShowSettingsDetails(checked === true)}
        />
        <label htmlFor="show-settings-details" className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.CURSOR.POINTER}`}>
          <ClipboardList className={iconSizes.sm} />
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info}`}>{t('currentSettings.title')}</span>
        </label>
      </div>

      {showSettingsDetails && (
        <div className={`${colors.bg.primary} ${radius.lg} ${getStatusBorder('default')} ${PANEL_LAYOUT.SPACING.MD}`}>
          {activeTab === 'lines' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.ROUNDED.TOP_LG} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Minus className={iconSizes.sm} />
                <span>{t('currentSettings.line')}</span>
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.type')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.lineType}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.color')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {lineSettings.color}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${lineColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.width')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.lineWidth}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.opacity')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{Math.round(lineSettings.opacity * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.scale')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.dashScale || 1.0}x</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.offset')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.dashOffset || 0}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.lineCap')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.lineCap || 'butt'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.lineJoin')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{lineSettings.lineJoin || 'miter'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.ROUNDED.TOP_LG} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Type className={iconSizes.sm} />
                <span>{t('currentSettings.text')}</span>
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.color')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {effectiveTextSettings.color}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${textColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.fontSize')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{effectiveTextSettings.fontSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.fontFamily')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>{effectiveTextSettings.fontFamily}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.style')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>
                    {effectiveTextSettings.isBold && 'B'}{effectiveTextSettings.isItalic && 'I'}{effectiveTextSettings.isUnderline && 'U'}
                    {!effectiveTextSettings.isBold && !effectiveTextSettings.isItalic && !effectiveTextSettings.isUnderline && t('currentSettings.labels.normal')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.superscript')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{effectiveTextSettings.isSuperscript ? t('currentSettings.labels.yes') : t('currentSettings.labels.no')}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.subscript')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{effectiveTextSettings.isSubscript ? t('currentSettings.labels.yes') : t('currentSettings.labels.no')}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grips' && (
            <div>
              <div className={`${PANEL_LAYOUT.SPACING.STANDARD} ${colors.bg.secondary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.warning} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.ROUNDED.TOP_LG} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Grid className={iconSizes.sm} />
                <span>{t('currentSettings.grips')}</span>
              </div>
              <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.visible')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{gripSettings.showGrips ? t('currentSettings.labels.yes') : t('currentSettings.labels.no')}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.size')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{gripSettings.gripSize}px</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.shape')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{gripSettings.gripShape}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.fill')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{gripSettings.showFill ? t('currentSettings.labels.yes') : t('currentSettings.labels.no')}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.coldColor')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {gripSettings.colors.cold}
                    <div
                      className={`${PANEL_LAYOUT.ICON.SMALL} rounded ${getStatusBorder('muted')} ${gripColdColorBgClass}`}
                    ></div>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`${colors.text.muted}`}>{t('currentSettings.labels.warmColor')}</span>
                  <span className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_FAMILY.CODE} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
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
            <div className={`text-center ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.PADDING.TOP_LG} ${PANEL_LAYOUT.PADDING.BOTTOM_LG}`}>
              {t('currentSettings.selectTab')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}