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
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../../settings-provider';
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
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) return null;

  const { settings, isAutoSaving, hasUnsavedChanges } = dxfSettings;

  const getStatusIcon = () => {
    if (isAutoSaving) {
      return (
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
      );
    }

    if (settings.saveStatus === 'saved') {
      return (
        <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (settings.saveStatus === 'error') {
      return (
        <svg className="h-3 w-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    return (
      <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    );
  };

  const getStatusMessage = () => {
    if (isAutoSaving) {
      return `Αποθήκευση...`;
    }

    if (settings.saveStatus === 'saved') {
      return `Αυτόματη αποθήκευση`;
    }

    if (settings.saveStatus === 'error') {
      return `Σφάλμα αποθήκευσης`;
    }

    return hasUnsavedChanges
      ? `Αναμονή αλλαγών...`
      : `Αυτόματη αποθήκευση`;
  };

  const getStatusColor = () => {
    if (isAutoSaving) {
      return 'text-blue-400 border-blue-500/30';
    }

    if (settings.saveStatus === 'saved') {
      return 'text-green-400 border-green-500/30';
    }

    if (settings.saveStatus === 'error') {
      return 'text-red-400 border-red-500/30';
    }

    return 'text-gray-400 border-gray-500/30';
  };

  return (
    <section
      className={`
        flex items-center gap-2 px-3 py-2
        bg-gray-800/50 rounded-md border
        transition-all duration-200 relative z-[9999]
        ${getStatusColor()}
      `}
      style={centralizedAutoSaveStatusStyles.container}
      {...getStatusContainerProps()}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0" style={centralizedAutoSaveStatusStyles.statusIcon.base}>
        {getStatusIcon()}
      </div>

      {/* Status Message */}
      <article className="flex-1 min-w-0">
        <h3 className={`text-sm font-medium ${getStatusColor().split(' ')[0]}`} style={centralizedAutoSaveStatusStyles.statusMessage.primary}>
          {getStatusMessage()}
        </h3>

        {settings.lastSaved && settings.saveStatus === 'saved' && (
          <time className="text-xs text-gray-500 mt-1" style={centralizedAutoSaveStatusStyles.statusMessage.secondary}>
            Τελευταία: {formatLastSaveTime(settings.lastSaved)}
          </time>
        )}
      </article>

      {/* Settings Indicator - Γενικά (Blue) + Ειδικά (Green) */}
      <aside className="flex items-center gap-2">
        {/* 🔵 ΓΕΝΙΚΑ SETTINGS (Blue dots) */}
        <div className="flex items-center gap-1" style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('general')}>
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
        <div className="flex items-center gap-1" style={centralizedAutoSaveStatusStyles.settingsDots.container} {...getSettingsIndicatorProps('specific')}>
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
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) return null;

  const { isAutoSaving, settings } = dxfSettings;

  const getIcon = () => {
    if (isAutoSaving) {
      return <div className="animate-spin rounded-full h-2 w-2 border border-blue-500 border-t-transparent"></div>;
    }

    if (settings.saveStatus === 'error') {
      return <div className="h-2 w-2 rounded-full bg-red-500"></div>;
    }

    return <div className="h-2 w-2 rounded-full bg-green-500"></div>;
  };

  const getTooltip = () => {
    if (isAutoSaving) {
      return 'Αποθήκευση όλων των ρυθμίσεων DXF...';
    }

    if (settings.saveStatus === 'error') {
      return 'Σφάλμα αποθήκευσης ρυθμίσεων';
    }

    // Δείχνουμε λίστα με όλα τα ενεργά συστήματα
    const systems = ['Γραμμές', 'Κείμενο', 'Grips', 'Κέρσορας', 'Grid', 'Χάρακες'];
    return `Αυτόματη αποθήκευση ενεργή για: ${systems.join(', ')}`;
  };

  return (
    <div
      className="flex items-center justify-center w-4 h-4"
      style={centralizedAutoSaveStatusStyles.compactContainer}
      title={getCompactTooltipText(isAutoSaving, settings.saveStatus)}
      {...getStatusContainerProps()}
    >
      <div style={getCompactStatusStyle(isAutoSaving, settings.saveStatus)} />
    </div>
  );
}