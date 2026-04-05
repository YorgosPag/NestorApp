/**
 * AUTOCAD-STYLE CURSOR SETTINGS PANEL
 *
 * 🏢 ADR-084: Refactored to use centralized FloatingPanel compound component
 * Eliminates 70+ lines of manual drag logic
 *
 * @version 2.0.0 - Enterprise FloatingPanel Integration
 * @since 2026-01-31
 */
import React, { useState, useEffect } from "react";
import { useTranslation } from '@/i18n';
import {
  getCursorSettings,
  updateCursorSettings,
  subscribeToCursorSettings,
  cursorConfig,
  type CursorSettings
} from "../systems/cursor/config";
import { INTERACTIVE_PATTERNS } from '../../../components/ui/effects';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '../../../hooks/useSemanticColors';
import { Checkbox } from '@/components/ui/checkbox';  // ✅ ENTERPRISE: Centralized Radix Checkbox
import { PANEL_LAYOUT, PanelPositionCalculator } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens
import { FloatingPanel } from '@/components/ui/floating';  // ✅ ADR-084: Centralized FloatingPanel
import { Settings } from 'lucide-react';  // ✅ ENTERPRISE: Icon for panel header
// 🏢 ADR-092: Centralized localStorage Service
import { storageRemove, STORAGE_KEYS } from '../utils/storage-utils';

// ============================================================================
// 🏢 ADR-084: PANEL DIMENSIONS - Centralized configuration
// ============================================================================

const CURSOR_PANEL_DIMENSIONS = {
  width: 500,
  height: 600,
} as const;

/**
 * 🏢 ENTERPRISE: Client-side position calculator
 * Position at BOTTOM-RIGHT corner of screen (above status bar)
 */
const getClientPosition = () => {
  return PanelPositionCalculator.getBottomRightPosition(
    CURSOR_PANEL_DIMENSIONS.width,
    CURSOR_PANEL_DIMENSIONS.height
  );
};

// SSR-safe fallback position
const SSR_FALLBACK_POSITION = { x: 100, y: 100 };

function SliderRow({
  label, value, min, max, step = 1, onChange, disabled = false, colors, quick
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  colors: ReturnType<typeof useSemanticColors>;
  quick: ReturnType<typeof useBorderTokens>['quick'];
}) {
  return (
    <div className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
      <div className={`flex justify-between items-center ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>
        <label className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.tertiary}`}>{label}</label>
        <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.FONT_FAMILY.CODE}`}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`${PANEL_LAYOUT.WIDTH.FULL} ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.hover} ${quick.input} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER} slider`}
      />
    </div>
  );
}

// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρησιμοποιεί το Enterprise Color System
// ColorPicker function αντικαταστάθηκε με SimpleColorPicker από το κεντρικό σύστημα

function CheckboxRow({
  label, checked, onChange, disabled = false, colors
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  colors: ReturnType<typeof useSemanticColors>;  // ✅ ENTERPRISE: Proper type instead of any
}) {
  return (
    <div className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
      <label className={`flex items-center ${PANEL_LAYOUT.CURSOR.POINTER}`}>
        <Checkbox
          checked={checked}
          onCheckedChange={(checkedState) => onChange(checkedState === true)}
          disabled={disabled}
          className={PANEL_LAYOUT.MARGIN.RIGHT_SM}
        />
        <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.tertiary}`}>{label}</span>
      </label>
    </div>
  );
}

interface CursorSettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function CursorSettingsPanel({ isVisible, onClose }: CursorSettingsPanelProps) {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { getStatusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());

  // 🏢 ENTERPRISE: Subscribe to cursor settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  const updateCrosshairSettings = (updates: Partial<CursorSettings['crosshair']>) => {
    updateCursorSettings({
      crosshair: { ...settings.crosshair, ...updates }
    });
  };

  const updateBehaviorSettings = (updates: Partial<CursorSettings['behavior']>) => {
    updateCursorSettings({
      behavior: { ...settings.behavior, ...updates }
    });
  };

  const updatePerformanceSettings = (updates: Partial<CursorSettings['performance']>) => {
    updateCursorSettings({
      performance: { ...settings.performance, ...updates }
    });
  };

  const resetSettings = () => {
    cursorConfig.resetToDefaults();
  };

  // 🏢 ADR-092: Using centralized storage-utils
  const clearAndReload = () => {
    storageRemove(STORAGE_KEYS.CURSOR_SETTINGS);
    window.location.reload();
  };

  // 🏢 ADR-084: Early return if not visible
  if (!isVisible) return null;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={CURSOR_PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      data-testid="cursor-settings-panel"
      className="w-[500px]"
      draggableOptions={{
        getClientPosition  // 🏢 ENTERPRISE: Client-side position calculation
      }}
    >
      <FloatingPanel.Header
        title={t('cursorSettings.panelTitle')}
        icon={<Settings />}
      />
      <FloatingPanel.Content>
        <div className="space-y-4">
          {/* Crosshair Settings - Simplified */}
          <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
            <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.BASE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>{t('cursorSettings.crosshairSection')}</h4>

            <CheckboxRow
              label={t('cursorSettings.enableCrosshair')}
              checked={settings.crosshair.enabled}
              onChange={(enabled) => updateCrosshairSettings({ enabled })}
              colors={colors}
            />

            <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.info} ${getStatusBorder('info')} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.info}`}>
              {t('cursorSettings.sizeColorThicknessHint')}
            </div>
          </section>

          {/* Behavior Settings */}
          <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
            <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.BASE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>{t('cursorSettings.behaviorSection')}</h4>
            <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.warningPanel} ${getStatusBorder('warning')} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warningLighter}`}>
              {t('cursorSettings.betaNote')}
            </div>

            <CheckboxRow
              label={t('cursorSettings.snapIndicator')}
              checked={settings.behavior.snap_indicator}
              onChange={(snap_indicator) => updateBehaviorSettings({ snap_indicator })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.snapIndicatorHint')}
            </div>

            <CheckboxRow
              label={t('cursorSettings.coordinateDisplay')}
              checked={settings.behavior.coordinate_display}
              onChange={(coordinate_display) => updateBehaviorSettings({ coordinate_display })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.coordinateDisplayHint')}
            </div>

            <CheckboxRow
              label={t('cursorSettings.dynamicInput')}
              checked={settings.behavior.dynamic_input}
              onChange={(dynamic_input) => updateBehaviorSettings({ dynamic_input })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.dynamicInputHint')}
            </div>

            <CheckboxRow
              label={t('cursorSettings.cursorTooltip')}
              checked={settings.behavior.cursor_tooltip}
              onChange={(cursor_tooltip) => updateBehaviorSettings({ cursor_tooltip })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.cursorTooltipHint')}
            </div>
          </section>

          {/* Performance Settings */}
          <section className={PANEL_LAYOUT.MARGIN.BOTTOM_XL}>
            <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.BASE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>{t('cursorSettings.performanceSection')}</h4>

            <CheckboxRow
              label={t('cursorSettings.useRaf')}
              checked={settings.performance.use_raf}
              onChange={(use_raf) => updatePerformanceSettings({ use_raf })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.useRafHint')}
            </div>

            <CheckboxRow
              label={t('cursorSettings.precisionMode')}
              checked={settings.performance.precision_mode}
              onChange={(precision_mode) => updatePerformanceSettings({ precision_mode })}
              colors={colors}
            />
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
              {t('cursorSettings.precisionModeHint')}
            </div>
            {settings.performance.precision_mode && (
              <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${PANEL_LAYOUT.MARGIN.LEFT_LG} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.info} ${getStatusBorder('info')} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.info} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <div className={`${iconSizes.xs} ${colors.bg.info} ${quick.button} ${PANEL_LAYOUT.ANIMATE.PULSE}`} />
                <span>{t('cursorSettings.precisionModeActive')}</span>
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`}>
            <button
              className={`flex-1 ${PANEL_LAYOUT.BUTTON.PADDING} rounded ${colors.bg.warning} ${INTERACTIVE_PATTERNS.WARNING_HOVER} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS}`}
              onClick={resetSettings}
            >
              {t('cursorSettings.resetDefaults')}
            </button>
            <button
              className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} rounded ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS}`}
              onClick={clearAndReload}
            >
              {t('cursorSettings.clearReload')}
            </button>
          </nav>
        </div>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
