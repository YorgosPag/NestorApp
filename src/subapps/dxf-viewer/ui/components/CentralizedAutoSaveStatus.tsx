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

import React, { useEffect, useState } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../../components/modal/ModalLoadingStates';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../../settings-provider';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { zIndex as enterpriseZIndex } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import {
  centralizedAutoSaveStatusStyles,
  getStatusColorStyles,
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
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const dxfSettings = useDxfSettingsSafe();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Detect if any modal is open by checking for modal overlays
  useEffect(() => {
    const checkForModals = () => {
      // Check for modal overlays with high z-index (z-50 or higher)
      const modalOverlays = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
      const hasOpenModal = Array.from(modalOverlays).some(overlay => {
        const computedStyle = window.getComputedStyle(overlay);
        const zIndex = parseInt(computedStyle.zIndex || '0');
        return zIndex >= 50 && computedStyle.display !== 'none';
      });
      setIsModalOpen(hasOpenModal);
    };

    // Check immediately
    checkForModals();

    // Set up observer for DOM changes (when modals open/close)
    const observer = new MutationObserver(checkForModals);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, []);

  if (!dxfSettings) return null;

  // ✅ ENTERPRISE FIX: Extract only existing properties from EnterpriseDxfSettingsContextType
  const { settings } = dxfSettings;
  // TODO: Add isAutoSaving and hasUnsavedChanges to context type in future
  const isAutoSaving = settings?.saveStatus === 'saving';
  const hasUnsavedChanges = settings?.saveStatus !== 'saved';

  const getStatusIcon = () => {
    if (isAutoSaving) {
      return <AnimatedSpinner size="small" className={iconSizes.xs} />;
    }

    if (settings.saveStatus === 'saved') {
      return (
        <svg className={`${iconSizes.xs} ${colors.text.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (settings.saveStatus === 'error') {
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

    if (settings.saveStatus === 'saved') {
      return t('autoSave.title');
    }

    if (settings.saveStatus === 'error') {
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

    if (settings.saveStatus === 'saved') {
      return `${colors.text.success} ${useBorderTokens().getStatusBorder('success')}`;
    }

    if (settings.saveStatus === 'error') {
      return `${colors.text.error} ${useBorderTokens().getStatusBorder('error')}`;
    }

    return `${colors.text.muted} ${getStatusBorder('muted')}`;
  };

  // ✅ ENTERPRISE: Dynamic z-index using centralized values
  // Lower (z-10) when modal is open, high (toast level: 1700) when no modal
  const getDynamicZIndex = () => {
    return isModalOpen ? 10 : enterpriseZIndex.toast;
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

        {settings.lastSaved && settings.saveStatus === 'saved' && (
          <time className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`} style={centralizedAutoSaveStatusStyles.statusMessage.secondary}>
            {t('autoSave.lastSaved')} {formatLastSaveTime(settings.lastSaved)}
          </time>
        )}
      </article>

      {/* Settings Indicator - Γενικά (Blue) + Ειδικά (Green) */}
      <aside className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        {/* 🔵 ΓΕΝΙΚΑ SETTINGS (Blue dots) */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('general')}>
          {getGeneralSettingsConfig(settings).map(({ key, isActive, label }) => (
            <div
              key={key}
              style={getGeneralSettingsDotStyle(isActive)}
              {...getSettingDotProps(isActive, label)}
            />
          ))}
        </div>

        {/* Separator */}
        <div style={getSeparatorStyle()} role="separator" aria-orientation="vertical" />

        {/* 🟢 ΕΙΔΙΚΑ SETTINGS (Green dots) */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`} style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('specific')}>
          {getSpecificSettingsConfig(settings).map(({ key, isActive, label }) => (
            <div
              key={key}
              style={getSpecificSettingsDotStyle(isActive)}
              {...getSettingDotProps(isActive, label)}
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
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  const dxfSettings = useDxfSettingsSafe();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Same modal detection logic as main component
  useEffect(() => {
    const checkForModals = () => {
      const modalOverlays = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
      const hasOpenModal = Array.from(modalOverlays).some(overlay => {
        const computedStyle = window.getComputedStyle(overlay);
        const zIndex = parseInt(computedStyle.zIndex || '0');
        return zIndex >= 50 && computedStyle.display !== 'none';
      });
      setIsModalOpen(hasOpenModal);
    };

    checkForModals();
    const observer = new MutationObserver(checkForModals);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, []);

  if (!dxfSettings) return null;

  const { isAutoSaving, settings } = dxfSettings;

  const getIcon = () => {
    if (isAutoSaving) {
      return <AnimatedSpinner size="small" className={iconSizes.xxs} />;
    }

    if (settings.saveStatus === 'error') {
      return <div className={`${iconSizes.xxs} ${radius.full} ${colors.bg.error}`}></div>;
    }

    return <div className={`${iconSizes.xxs} ${radius.full} ${colors.bg.success}`}></div>;
  };

  const getTooltip = () => {
    if (isAutoSaving) {
      return t('autoSave.savingAllSettings');
    }

    if (settings.saveStatus === 'error') {
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
      title={getCompactTooltipText(isAutoSaving, settings.saveStatus)}
      {...getStatusContainerProps()}
    >
      <div style={getCompactStatusStyle(isAutoSaving, settings.saveStatus)} />
    </div>
  );
}