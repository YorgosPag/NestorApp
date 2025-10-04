/**
 * ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ AUTO-SAVE STATUS COMPONENT
 * Αντικαθιστά το διάσπαρτο DxfSettingsAutoSaveStatus με κεντρικό provider
 *
 * Χαρακτηριστικά:
 * - Single source of truth
 * - Χωρίς κυκλικά loops
 * - Καθαρό API
 * - Κεντρικοποιημένο status
 */

import React from 'react';
import { useDxfSettings } from '../../providers/DxfSettingsProvider';

/**
 * Κεντρικοποιημένο component για auto-save status
 */
// ===== SAFE HOOK WRAPPER =====
function useDxfSettingsSafe() {
  try {
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
      return 'Αποθήκευση ρυθμίσεων...';
    }

    if (settings.saveStatus === 'saved') {
      return 'Οι ρυθμίσεις αποθηκεύτηκαν αυτόματα';
    }

    if (settings.saveStatus === 'error') {
      return 'Σφάλμα αποθήκευσης ρυθμίσεων';
    }

    return hasUnsavedChanges
      ? 'Αναμονή αλλαγών...'
      : 'Αυτόματη αποθήκευση ενεργή';
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
    <div className={`
      flex items-center gap-2 px-3 py-2
      bg-gray-800/50 rounded-md border
      transition-all duration-200
      ${getStatusColor()}
    `}>
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>

      {/* Status Message */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${getStatusColor().split(' ')[0]}`}>
          {getStatusMessage()}
        </div>

        {settings.lastSaved && settings.saveStatus === 'saved' && (
          <div className="text-xs text-gray-500 mt-1">
            Τελευταία: {settings.lastSaved.toLocaleTimeString('el-GR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        )}
      </div>

      {/* Settings Indicator */}
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-blue-400 opacity-60" title="Γραμμές" />
        <div className="h-2 w-2 rounded-full bg-green-400 opacity-60" title="Κείμενο" />
        <div className="h-2 w-2 rounded-full bg-yellow-400 opacity-60" title="Grips" />
      </div>
    </div>
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
      return 'Αποθήκευση ρυθμίσεων DXF...';
    }

    if (settings.saveStatus === 'error') {
      return 'Σφάλμα αποθήκευσης ρυθμίσεων';
    }

    return 'Αυτόματη αποθήκευση ρυθμίσεων ενεργή';
  };

  return (
    <div
      className="flex items-center justify-center w-4 h-4"
      title={getTooltip()}
    >
      {getIcon()}
    </div>
  );
}