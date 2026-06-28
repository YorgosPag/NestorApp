/**
 * ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ AUTO-SAVE STATUS COMPONENT
 * Αντικαθιστά το διάσπαρτο DxfSettingsAutoSaveStatus με κεντρικό provider
 *
 * Χαρακτηριστικά:
 * - Single source of truth
 * - Χωρίς κυκλικά loops
 * - Καθαρό API
 * - Κεντρικοποιημένο status
 *
 * 🔄 MIGRATED (2025-10-09): Phase 3.1 - Enterprise Adapter
 */

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../../components/modal/ModalLoadingStates';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings, useSettingsSaveStatusOptional } from '../../settings-provider';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🚀 ADR-040 cursor-lag Φ6: modal presence via SSoT store (replaces the
// per-component body-wide MutationObserver that re-scanned the DOM on every
// crosshair move). See systems/modal/ModalPresenceStore.
import { useModalPresence } from '../../systems/modal/useModalPresence';
import { zIndex as enterpriseZIndex } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
import {
  centralizedAutoSaveStatusStyles,
  getGeneralSettingsDotStyle,
  getSpecificSettingsDotStyle,
  getSeparatorStyle,
  getCompactStatusStyle,
  getStatusContainerProps,
  getSettingsIndicatorProps,
  getSettingDotProps,
  getCompactTooltipText,
  formatLastSaveTime,
  getGeneralSettingsConfig,
  getSpecificSettingsConfig
} from './CentralizedAutoSaveStatus.styles';

/**
 * Κεντρικοποιημένο component για auto-save status
 */
// ===== SAFE HOOK WRAPPER =====
function useDxfSettingsSafe() {
  try {
    // 🔄 MIGRATED: Direct Enterprise (no adapter)
    return useDxfSettings();
  } catch (error) {
    return null;
  }
}

export function CentralizedAutoSaveStatus() {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const iconSizes = useIconSizes();
  const { radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const dxfSettings = useDxfSettingsSafe();
  // ADR-341 perf (2026-06-28) — save-status now lives in its own context, so this
  // widget re-renders on a save cycle WITHOUT dragging the whole settings tree.
  const saveStatusCtx = useSettingsSaveStatusOptional();
  // 🚀 ADR-040 cursor-lag Φ6: subscribe to the modal-presence SSoT instead of a
  // body-wide MutationObserver — re-renders only on real modal open/close.
  const isModalOpen = useModalPresence();

  if (!dxfSettings || !saveStatusCtx) return null;

  // ✅ ENTERPRISE FIX: settings content (line/text/grip) from the main context,
  // volatile save-status from the dedicated context.
  const { settings } = dxfSettings;
  const { saveStatus, lastSaved, isAutoSaving, hasUnsavedChanges } = saveStatusCtx;

  const getStatusIcon = () => {
    if (isAutoSaving) {
      return <AnimatedSpinner size="small" className={iconSizes.xs} />;
    }

    if (saveStatus === 'saved') {
      return (
        <svg className={`${iconSizes.xs} ${colors.text.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (saveStatus === 'error') {
      return (
        <svg className={`${iconSizes.xs} ${colors.text.error}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    return (
      <svg className={`${iconSizes.xs} ${colors.text.muted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    );
  };

  const getStatusMessage = () => {
    if (isAutoSaving) {
      return t('autoSave.saving');
    }

    if (saveStatus === 'saved') {
      return t('autoSave.title');
    }

    if (saveStatus === 'error') {
      return t('autoSave.error');
    }

    return hasUnsavedChanges
      ? t('autoSave.waiting')
      : t('autoSave.title');
  };

  const getStatusColor = () => {
    if (isAutoSaving) {
      return `${colors.text.info} ${useBorderTokens().getStatusBorder('info')}`;
    }

    if (saveStatus === 'saved') {
      return `${colors.text.success} ${useBorderTokens().getStatusBorder('success')}`;
    }

    if (saveStatus === 'error') {
      return `${colors.text.error} ${useBorderTokens().getStatusBorder('error')}`;
    }

    return `${colors.text.muted} ${getStatusBorder('muted')}`;
  };

  // ✅ ENTERPRISE: Dynamic z-index using centralized values
  // Lower (z-10) when modal is open, high (toast level: 1700) when no modal
  const getDynamicZIndex = () => {
    return isModalOpen ? 10 : enterpriseZIndex.toast;
  };

  const hasOverrides = (value: Record<string, unknown> | undefined): boolean =>
    !!value && Object.keys(value).length > 0;

  const generalSettingsFlags = {
    line: !!settings.line,
    text: !!settings.text,
    grip: !!settings.grip,
    cursor: undefined,
    grid: undefined,
    ruler: undefined
  };

  const specificSettingsFlags = {
    ...generalSettingsFlags,
    specific: {
      line: {
        draft: hasOverrides(settings.line?.specific?.draft),
        hover: hasOverrides(settings.line?.specific?.hover),
        selection: hasOverrides(settings.line?.specific?.selection),
        completion: hasOverrides(settings.line?.specific?.completion)
      },
      text: {
        draft: hasOverrides(settings.text?.specific?.draft)
      }
    }
  };

  return (
    <section
      className={`
        flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.STANDARD}
        ${colors.bg.card} ${PANEL_LAYOUT.ROUNDED.MD} border
        ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['200']} relative
        ${getStatusColor()}
      `}
      style={{ ...centralizedAutoSaveStatusStyles.container, zIndex: getDynamicZIndex() }}
      {...getStatusContainerProps()}
    >
      {/* Status Icon */}
      <div className={PANEL_LAYOUT.FLEX_SHRINK.NONE} style={centralizedAutoSaveStatusStyles.statusIcon}>
        {getStatusIcon()}
      </div>

      {/* Status Message */}
      <article className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${getStatusColor().split(' ')[0]}`} style={centralizedAutoSaveStatusStyles.statusMessage.primary}>
          {getStatusMessage()}
        </h3>

        {lastSaved && saveStatus === 'saved' && (
          <time className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`} style={centralizedAutoSaveStatusStyles.statusMessage.secondary}>
            {t('autoSave.lastSaved')} {formatLastSaveTime(lastSaved)}
          </time>
        )}
      </article>

      {/* Settings Indicator - Γενικά (Blue) + Ειδικά (Green) */}
      <aside className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        {/* 🔵 ΓΕΝΙΚΑ SETTINGS (Blue dots) */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('general')}>
          {getGeneralSettingsConfig(generalSettingsFlags).map(({ key, isActive, label }) => (
            <div
              key={key}
              style={getGeneralSettingsDotStyle(Boolean(isActive))}
              {...getSettingDotProps(Boolean(isActive), label)}
            />
          ))}
        </div>

        {/* Separator */}
        <div style={getSeparatorStyle()} role="separator" aria-orientation="vertical" />

        {/* 🟢 ΕΙΔΙΚΑ SETTINGS (Green dots) */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('specific')}>
          {getSpecificSettingsConfig(specificSettingsFlags).map(({ key, isActive, label }) => (
            <div
              key={key}
              style={getSpecificSettingsDotStyle(Boolean(isActive))}
              {...getSettingDotProps(Boolean(isActive), label)}
            />
          ))}
        </div>
      </aside>
    </section>
  );
}

/**
 * Compact version
 */
export function CentralizedAutoSaveStatusCompact() {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  const dxfSettings = useDxfSettingsSafe();
  // ADR-341 perf — volatile save-status from its own context (see main variant).
  const saveStatusCtx = useSettingsSaveStatusOptional();
  // 🚀 ADR-040 cursor-lag Φ6: same modal detection as the main component, now via
  // the shared SSoT store (no per-component body observer).
  const isModalOpen = useModalPresence();

  if (!dxfSettings || !saveStatusCtx) return null;

  const { isAutoSaving, saveStatus } = saveStatusCtx;

  const getIcon = () => {
    if (isAutoSaving) {
      return <AnimatedSpinner size="small" className={iconSizes.xxs} />;
    }

    if (saveStatus === 'error') {
      return <div className={`${iconSizes.xxs} ${radius.full} ${colors.bg.error}`} />;
    }

    return <div className={`${iconSizes.xxs} ${radius.full} ${colors.bg.success}`} />;
  };

  const getTooltip = () => {
    if (isAutoSaving) {
      return t('autoSave.savingAllSettings');
    }

    if (saveStatus === 'error') {
      return t('autoSave.errorSavingSettings');
    }

    // Δείχνουμε λίστα με όλα τα ενεργά συστήματα
    const systems = ['Γραμμές', 'Κείμενο', 'Grips', 'Κέρσορας', 'Grid', 'Χάρακες'];
    return `${t('autoSave.activeFor')} ${systems.join(', ')}`;
  };

  // ✅ ENTERPRISE: Dynamic z-index for compact version using centralized values
  const getCompactDynamicZIndex = () => {
    return isModalOpen ? 10 : enterpriseZIndex.toast;
  };

  return (
    <div
      className={`flex items-center justify-center ${iconSizes.sm} relative`}
      style={{ ...centralizedAutoSaveStatusStyles.compactContainer, zIndex: getCompactDynamicZIndex() }}
      title={getCompactTooltipText(isAutoSaving, saveStatus)}
      {...getStatusContainerProps()}
    >
      <div style={getCompactStatusStyle(isAutoSaving, saveStatus)} />
    </div>
  );
}

