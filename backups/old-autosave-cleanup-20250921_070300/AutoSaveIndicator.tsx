/**
 * AUTOSAVEINDICATOR COMPONENT
 * Εμφανίζει την κατάσταση auto-save για τις ρυθμίσεις DXF
 *
 * Χαρακτηριστικά:
 * - Εμφανίζει status (idle, saving, saved, error)
 * - Smooth animations
 * - Compact design για integration σε settings panels
 * - Ελληνικά μηνύματα
 */

import React from 'react';
import type { AutoSaveStatus } from '../../hooks/useAutoSaveSettings';

interface AutoSaveIndicatorProps {
  /** Auto-save status από το hook */
  status: AutoSaveStatus;
  /** Προαιρετικό label (default: "Αυτόματη Αποθήκευση") */
  label?: string;
  /** Μέγεθος (default: "small") */
  size?: 'small' | 'medium';
  /** Εμφάνιση timestamp τελευταίας αποθήκευσης */
  showTimestamp?: boolean;
  /** CSS classes */
  className?: string;
}

/**
 * Component για εμφάνιση auto-save status
 *
 * @example
 * ```tsx
 * const autoSave = useAutoSaveSettings({...});
 *
 * <AutoSaveIndicator
 *   status={autoSave}
 *   showTimestamp={true}
 * />
 * ```
 */
export const AutoSaveIndicator = React.memo<AutoSaveIndicatorProps>(function AutoSaveIndicator({
  status,
  label = "Αυτόματη Αποθήκευση",
  size = "small",
  showTimestamp = false,
  className = ""
}) {

  const getStatusIcon = () => {
    switch (status.status) {
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
          <div className="h-3 w-3 rounded-full bg-gray-400"></div>
        );
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'saving':
        return 'Αποθήκευση...';
      case 'saved':
        return 'Αποθηκεύτηκε';
      case 'error':
        return 'Σφάλμα';
      case 'idle':
      default:
        return 'Αναμονή';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'saving':
        return 'text-blue-400';
      case 'saved':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'idle':
      default:
        return 'text-gray-400';
    }
  };

  const formatTimestamp = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const sizeClasses = size === 'medium'
    ? 'px-3 py-2 text-sm'
    : 'px-2 py-1 text-xs';

  return (
    <div className={`
      flex items-center gap-2
      ${sizeClasses}
      bg-gray-800/50 rounded-md border border-gray-600/50
      transition-all duration-200
      ${className}
    `}>
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>

      {/* Status Text */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-300 font-medium">
            {label}:
          </span>
          <span className={`${getStatusColor()} transition-colors duration-200`}>
            {getStatusText()}
          </span>
        </div>

        {/* Timestamp */}
        {showTimestamp && status.lastSaved && (
          <div className="text-xs text-gray-500 mt-1">
            Τελευταία: {formatTimestamp(status.lastSaved)}
          </div>
        )}

        {/* Error Message */}
        {status.status === 'error' && status.error && (
          <div className="text-xs text-red-400 mt-1 truncate" title={status.error}>
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Compact version για integration σε headers/toolbars
 */
export const AutoSaveIndicatorCompact = React.memo<{
  status: AutoSaveStatus;
  className?: string;
}>(function AutoSaveIndicatorCompact({ status, className = "" }) {

  const getStatusIcon = () => {
    switch (status.status) {
      case 'saving':
        return <div className="animate-spin rounded-full h-2 w-2 border border-blue-500 border-t-transparent"></div>;
      case 'saved':
        return <div className="h-2 w-2 rounded-full bg-green-500"></div>;
      case 'error':
        return <div className="h-2 w-2 rounded-full bg-red-500"></div>;
      case 'idle':
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-500"></div>;
    }
  };

  const getTooltip = () => {
    switch (status.status) {
      case 'saving':
        return 'Αποθήκευση ρυθμίσεων...';
      case 'saved':
        return `Αποθηκεύτηκε${status.lastSaved ? ` στις ${status.lastSaved.toLocaleTimeString('el-GR')}` : ''}`;
      case 'error':
        return `Σφάλμα αποθήκευσης: ${status.error || 'Άγνωστο σφάλμα'}`;
      case 'idle':
      default:
        return 'Αναμονή αλλαγών...';
    }
  };

  return (
    <div
      className={`flex items-center justify-center w-4 h-4 ${className}`}
      title={getTooltip()}
    >
      {getStatusIcon()}
    </div>
  );
});