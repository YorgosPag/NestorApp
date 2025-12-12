/**
 * 🛠️ ERROR REPORTING DASHBOARD
 *
 * Development-only dashboard για error tracking monitoring
 * Εμφανίζεται μόνο σε development environment
 *
 * Features:
 * - Real-time error statistics
 * - Error details viewer
 * - Error filtering και search
 * - Performance metrics
 * - Configuration viewer
 */

'use client';

import React, { useState, useEffect } from 'react';
import { errorTracker } from '@/services/ErrorTracker';
import type { ErrorReport } from '@/services/ErrorTracker';
import { HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';

interface ErrorReportingDashboardProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  minimized?: boolean;
}

export function ErrorReportingDashboard({
  position = 'bottom-right',
  minimized = true
}: ErrorReportingDashboardProps) {
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [stats, setStats] = useState(errorTracker.getStats());
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);
  const [filter, setFilter] = useState<string>('');

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Update stats και errors every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(errorTracker.getStats());
      setErrors(errorTracker.getErrors());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Filter errors based on search
  const filteredErrors = errors.filter(error =>
    error.message.toLowerCase().includes(filter.toLowerCase()) ||
    error.category.toLowerCase().includes(filter.toLowerCase()) ||
    error.context.component?.toLowerCase().includes(filter.toLowerCase())
  );

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const clearAllErrors = () => {
    errorTracker.clearErrors();
    setStats(errorTracker.getStats());
    setErrors([]);
    setSelectedError(null);
  };

  const getStatusColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'error': return 'text-orange-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-[9999]`}>
      {/* Minimized View */}
      {isMinimized && (
        <div
          className={`bg-gray-900 text-white rounded-lg p-3 cursor-pointer shadow-lg border border-gray-700 ${HOVER_BACKGROUND_EFFECTS.GRAY_800} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-mono">
              🛡️ Errors: {stats.totalErrors}
            </span>
          </div>
          {stats.totalErrors > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              <span className={getStatusColor('critical')}>●</span> {stats.errorsBySeverity.critical || 0}
              <span className="ml-2">
                <span className={getStatusColor('error')}>●</span> {stats.errorsBySeverity.error || 0}
              </span>
              <span className="ml-2">
                <span className={getStatusColor('warning')}>●</span> {stats.errorsBySeverity.warning || 0}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Expanded View */}
      {!isMinimized && (
        <div className="bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 w-96 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold">🛡️ Error Tracking</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearAllErrors}
                className={`text-xs bg-red-600 px-2 py-1 rounded ${HOVER_BACKGROUND_EFFECTS.RED_DARKER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                title="Clear All Errors"
              >
                Clear
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className={`text-gray-400 ${HOVER_TEXT_EFFECTS.WHITE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Session</div>
                <div className="font-mono text-xs">{stats.sessionId.substring(0, 8)}</div>
              </div>
              <div>
                <div className="text-gray-400">Total Errors</div>
                <div className="font-bold">{stats.totalErrors}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className={getStatusColor('critical')}>●</div>
                <div>{stats.errorsBySeverity.critical || 0}</div>
              </div>
              <div className="text-center">
                <div className={getStatusColor('error')}>●</div>
                <div>{stats.errorsBySeverity.error || 0}</div>
              </div>
              <div className="text-center">
                <div className={getStatusColor('warning')}>●</div>
                <div>{stats.errorsBySeverity.warning || 0}</div>
              </div>
              <div className="text-center">
                <div className={getStatusColor('info')}>●</div>
                <div>{stats.errorsBySeverity.info || 0}</div>
              </div>
            </div>
          </div>

          {/* Search Filter */}
          <div className="p-3 border-b border-gray-700">
            <input
              type="text"
              placeholder="Filter errors..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Error List */}
          <div className="flex-1 overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {filter ? 'No errors match filter' : 'No errors captured'}
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredErrors.slice(0, 10).map((error) => (
                  <div
                    key={error.id}
                    className={`p-3 cursor-pointer ${HOVER_BACKGROUND_EFFECTS.GRAY_800} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    onClick={() => setSelectedError(error)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs ${getStatusColor(error.severity)}`}>
                            ●
                          </span>
                          <span className="text-xs text-gray-400">
                            {error.category}
                          </span>
                          {error.count > 1 && (
                            <span className="text-xs bg-gray-700 px-1 rounded">
                              {error.count}x
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium truncate mt-1">
                          {error.message}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {error.context.component} • {new Date(error.lastSeen).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-gray-900 text-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold">Error Details</h3>
              <button
                onClick={() => setSelectedError(null)}
                className={`text-gray-400 ${HOVER_TEXT_EFFECTS.WHITE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Error Summary */}
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="bg-gray-800 p-3 rounded text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400">Error ID</div>
                      <div className="font-mono text-xs">{selectedError.id}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Severity</div>
                      <div className={getStatusColor(selectedError.severity)}>
                        {selectedError.severity.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Category</div>
                      <div>{selectedError.category}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Occurrences</div>
                      <div>{selectedError.count}x</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <div>
                <h4 className="font-medium mb-2">Message</h4>
                <div className="bg-gray-800 p-3 rounded text-sm">
                  {selectedError.message}
                </div>
              </div>

              {/* Context */}
              <div>
                <h4 className="font-medium mb-2">Context</h4>
                <div className="bg-gray-800 p-3 rounded text-sm">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Stack Trace */}
              {selectedError.stack && (
                <div>
                  <h4 className="font-medium mb-2">Stack Trace</h4>
                  <div className="bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {selectedError.stack}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ErrorReportingDashboard;