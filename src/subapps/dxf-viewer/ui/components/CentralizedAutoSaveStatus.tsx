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
    // ✅ Phase 9: Enhanced debug info με Γενικά + Ειδικά settings
    const generalInfo = `L:${!!settings.line} T:${!!settings.text} G:${!!settings.grip} C:${!!settings.cursor} GR:${!!settings.grid} R:${!!settings.ruler}`;
    const specificInfo = `LD:${!!settings.specific?.line?.draft} LH:${!!settings.specific?.line?.hover} LS:${!!settings.specific?.line?.selection} LC:${!!settings.specific?.line?.completion} TP:${!!settings.specific?.text?.draft}`;
    const debugInfo = `${generalInfo} | ${specificInfo}`.replace(/\s+/g, ' ');

    if (isAutoSaving) {
      return `Αποθήκευση... [${debugInfo}]`;
    }

    if (settings.saveStatus === 'saved') {
      // Count active settings (Γενικά + Ειδικά)
      const generalCount = [settings.line, settings.text, settings.grip, settings.cursor, settings.grid, settings.ruler].filter(Boolean).length;
      const specificCount = [
        settings.specific?.line?.draft,
        settings.specific?.line?.hover,
        settings.specific?.line?.selection,
        settings.specific?.line?.completion,
        settings.specific?.text?.draft
      ].filter(Boolean).length;
      return `Ρυθμίσεις OK (Γ:${generalCount}/6 Ε:${specificCount}/5) [${debugInfo}]`;
    }

    if (settings.saveStatus === 'error') {
      return `Σφάλμα [${debugInfo}]`;
    }

    return hasUnsavedChanges
      ? `Αναμονή αλλαγών... [${debugInfo}]`
      : `Αυτόματη αποθήκευση [${debugInfo}]`;
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
      transition-all duration-200 relative z-[9999]
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

      {/* Settings Indicator - Γενικά (Blue) + Ειδικά (Green) */}
      <div className="flex items-center gap-2">
        {/* 🔵 ΓΕΝΙΚΑ SETTINGS (Blue dots) */}
        <div className="flex items-center gap-1" title="Γενικές Ρυθμίσεις">
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.line ? '#60a5fa' : '#4b5563'}} title="Γραμμές (Γενικά)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.text ? '#60a5fa' : '#4b5563'}} title="Κείμενο (Γενικά)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.grip ? '#60a5fa' : '#4b5563'}} title="Grips (Γενικά)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.cursor ? '#60a5fa' : '#4b5563'}} title="Κέρσορας"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.grid ? '#60a5fa' : '#4b5563'}} title="Grid"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.ruler ? '#60a5fa' : '#4b5563'}} title="Χάρακες"></div>
        </div>

        {/* Separator */}
        <div style={{width: '1px', height: '16px', backgroundColor: '#6b7280'}}></div>

        {/* 🟢 ΕΙΔΙΚΑ SETTINGS (Green dots) */}
        <div className="flex items-center gap-1" title="Ειδικές Ρυθμίσεις">
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.specific?.line?.draft ? '#4ade80' : '#4b5563'}} title="Line Draft (Προσχεδίαση)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.specific?.line?.hover ? '#4ade80' : '#4b5563'}} title="Line Hover"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.specific?.line?.selection ? '#4ade80' : '#4b5563'}} title="Line Selection (Επιλογή)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.specific?.line?.completion ? '#4ade80' : '#4b5563'}} title="Line Completion (Ολοκλήρωση)"></div>
          <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: settings.specific?.text?.draft ? '#4ade80' : '#4b5563'}} title="Text Preview"></div>
        </div>
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
      title={getTooltip()}
    >
      {getIcon()}
    </div>
  );
}