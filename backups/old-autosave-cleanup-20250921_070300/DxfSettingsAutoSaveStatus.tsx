/**
 * DXF SETTINGS AUTO-SAVE STATUS COMPONENT
 * Εμφανίζει την κατάσταση αυτόματης αποθήκευσης των γενικών ρυθμίσεων DXF
 *
 * Ενσωματώνει όλα τα auto-save contexts (Line, Text, Grip Settings)
 * και εμφανίζει συγκεντρωτικό status στο UI
 */

import React, { useState, useEffect } from 'react';
import { useLineSettings } from '../../contexts/LineSettingsContext';
import { useTextSettings } from '../../contexts/TextSettingsContext';
import { useGripSettings } from '../../hooks/grips/useGripSettings';
import { AutoSaveIndicatorCompact } from './shared/AutoSaveIndicator';

interface SettingsAutoSaveState {
  line: 'idle' | 'saving' | 'saved' | 'error';
  text: 'idle' | 'saving' | 'saved' | 'error';
  grip: 'idle' | 'saving' | 'saved' | 'error';
}

/**
 * Component που εμφανίζει το συγκεντρωτικό auto-save status
 * για όλες τις γενικές ρυθμίσεις DXF
 */
export function DxfSettingsAutoSaveStatus() {
  const [autoSaveState, setAutoSaveState] = useState<SettingsAutoSaveState>({
    line: 'idle',
    text: 'idle',
    grip: 'idle'
  });

  // Hooks από τα contexts που έχουν auto-save
  const lineSettings = useLineSettings();
  const textSettings = useTextSettings();
  const gripSettings = useGripSettings();

  // Συλλέγουμε τα auto-save statuses αν υπάρχουν
  const lineAutoSave = (lineSettings as any).autoSaveStatus;
  const textAutoSave = (textSettings as any).autoSaveStatus;
  const gripAutoSave = gripSettings.autoSaveStatus;

  // Listen για αλλαγές στα auto-save statuses
  useEffect(() => {
    const handleAutoSaveStatusChange = (event: CustomEvent) => {
      const { storageKey, status } = event.detail;

      if (storageKey === 'dxf-line-general-settings') {
        setAutoSaveState(prev => ({ ...prev, line: status }));
      } else if (storageKey === 'dxf-text-general-settings') {
        setAutoSaveState(prev => ({ ...prev, text: status }));
      } else if (storageKey === 'dxf-grip-general-settings') {
        setAutoSaveState(prev => ({ ...prev, grip: status }));
      }
    };

    window.addEventListener('autosave-status-change', handleAutoSaveStatusChange as EventListener);

    return () => {
      window.removeEventListener('autosave-status-change', handleAutoSaveStatusChange as EventListener);
    };
  }, []);

  // Update state από τα actual auto-save statuses
  useEffect(() => {
    setAutoSaveState({
      line: lineAutoSave?.status || 'idle',
      text: textAutoSave?.status || 'idle',
      grip: gripAutoSave?.status || 'idle'
    });
  }, [lineAutoSave?.status, textAutoSave?.status, gripAutoSave?.status]);

  // Υπολογισμός συγκεντρωτικού status
  const overallStatus = (() => {
    const statuses = Object.values(autoSaveState);

    if (statuses.includes('error')) return 'error';
    if (statuses.includes('saving')) return 'saving';
    if (statuses.includes('saved')) return 'saved';
    return 'idle';
  })();

  // Υπολογισμός τελευταίας αποθήκευσης
  const lastSaved = (() => {
    const dates = [
      lineAutoSave?.lastSaved,
      textAutoSave?.lastSaved,
      gripAutoSave?.lastSaved
    ].filter(Boolean);

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map(d => d!.getTime())));
  })();

  const getStatusMessage = () => {
    switch (overallStatus) {
      case 'saving':
        return 'Αποθήκευση ρυθμίσεων...';
      case 'saved':
        return 'Οι ρυθμίσεις αποθηκεύτηκαν αυτόματα';
      case 'error':
        return 'Σφάλμα αποθήκευσης ρυθμίσεων';
      case 'idle':
      default:
        return 'Αυτόματη αποθήκευση ενεργή';
    }
  };

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'saving':
        return (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
        );
      case 'saved':
        return (
          <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-3 w-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'idle':
      default:
        return (
          <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        );
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'saving':
        return 'text-blue-400 border-blue-500/30';
      case 'saved':
        return 'text-green-400 border-green-500/30';
      case 'error':
        return 'text-red-400 border-red-500/30';
      case 'idle':
      default:
        return 'text-gray-400 border-gray-500/30';
    }
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

        {lastSaved && overallStatus === 'saved' && (
          <div className="text-xs text-gray-500 mt-1">
            Τελευταία: {lastSaved.toLocaleTimeString('el-GR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        )}
      </div>

      {/* Individual Status Indicators */}
      <div className="flex items-center gap-1">
        <AutoSaveIndicatorCompact
          status={{
            status: autoSaveState.line,
            lastSaved: lineAutoSave?.lastSaved || null,
            error: lineAutoSave?.error || null
          }}
          className="opacity-60"
        />
        <AutoSaveIndicatorCompact
          status={{
            status: autoSaveState.text,
            lastSaved: textAutoSave?.lastSaved || null,
            error: textAutoSave?.error || null
          }}
          className="opacity-60"
        />
        <AutoSaveIndicatorCompact
          status={{
            status: autoSaveState.grip,
            lastSaved: gripAutoSave?.lastSaved || null,
            error: gripAutoSave?.error || null
          }}
          className="opacity-60"
        />
      </div>
    </div>
  );
}

/**
 * Compact version για χρήση σε headers ή toolbars
 */
export function DxfSettingsAutoSaveStatusCompact() {
  const lineSettings = useLineSettings();
  const textSettings = useTextSettings();
  const gripSettings = useGripSettings();

  const lineAutoSave = (lineSettings as any).autoSaveStatus;
  const textAutoSave = (textSettings as any).autoSaveStatus;
  const gripAutoSave = gripSettings.autoSaveStatus;

  const hasAnySaving = [
    lineAutoSave?.status,
    textAutoSave?.status,
    gripAutoSave?.status
  ].includes('saving');

  const hasAnyError = [
    lineAutoSave?.status,
    textAutoSave?.status,
    gripAutoSave?.status
  ].includes('error');

  const overallStatus = hasAnyError ? 'error' : hasAnySaving ? 'saving' : 'idle';

  const getIcon = () => {
    switch (overallStatus) {
      case 'saving':
        return <div className="animate-spin rounded-full h-2 w-2 border border-blue-500 border-t-transparent"></div>;
      case 'error':
        return <div className="h-2 w-2 rounded-full bg-red-500"></div>;
      default:
        return <div className="h-2 w-2 rounded-full bg-green-500"></div>;
    }
  };

  const getTooltip = () => {
    switch (overallStatus) {
      case 'saving':
        return 'Αποθήκευση ρυθμίσεων DXF...';
      case 'error':
        return 'Σφάλμα αποθήκευσης ρυθμίσεων';
      default:
        return 'Αυτόματη αποθήκευση ρυθμίσεων ενεργή';
    }
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