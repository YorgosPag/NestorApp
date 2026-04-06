/**
 * ADMIN BOUNDARIES PERFORMANCE PANEL
 * Extracted from PerformanceComponents.tsx (ADR-065 SRP split)
 *
 * Real-time performance monitoring panel for Administrative Boundaries.
 * Displays metrics, alerts, and recommendations.
 */

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { Flame, AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTheme } from '@/subapps/geo-canvas/ui/design-system/theme/ThemeProvider';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../../../config/color-config';
import {
  getPerformanceMetricsContainerStyles,
  getSectionBorderStyles,
  getSectionTitleStyles,
  getAlertSeverityColor,
  getAlertItemStyles,
  getAlertTitleStyles,
  getAlertTimestampStyles,
  getDynamicHeaderStyles,
} from './PerformanceComponents.styles';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AdminBoundariesMetrics {
  search: {
    averageSearchTime: number;
    searchSuccessRate: number;
    cacheHitRate: number;
    totalSearches: number;
  };
  overpassApi: {
    averageResponseTime: number;
    totalRequests: number;
    failedRequests: number;
    dataSize: number;
  };
  boundaries: {
    averageProcessingTime: number;
    renderingTime: number;
    processedBoundaries: number;
    geometryComplexity: number;
  };
}

interface AdminBoundariesAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  timestamp: number;
}

// Temporary analytics stub for type compatibility
const adminBoundariesAnalytics = {
  startMonitoring: (_interval: number) => {},
  stopMonitoring: () => {},
  getLatestMetrics: (): AdminBoundariesMetrics | null => null,
  getAlerts: (): AdminBoundariesAlert[] => [],
};

// ============================================================================
// COMPONENT
// ============================================================================

export interface AdminBoundariesPerformancePanelProps {
  isVisible?: boolean;
  onClose?: () => void;
  className?: string;
  refreshInterval?: number;
}

export const AdminBoundariesPerformancePanel = memo(({
  isVisible = false,
  onClose,
  className = '',
  refreshInterval = 5000,
}: AdminBoundariesPerformancePanelProps) => {
  const { theme } = useTheme();
  const iconSizes = useIconSizes();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [metrics, setMetrics] = useState<AdminBoundariesMetrics | null>(null);
  const [alerts, setAlerts] = useState<AdminBoundariesAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible && !isMonitoring) {
      setIsMonitoring(true);
      adminBoundariesAnalytics.startMonitoring(refreshInterval);

      const updateMetrics = () => {
        const latestMetrics = adminBoundariesAnalytics.getLatestMetrics();
        const latestAlerts = adminBoundariesAnalytics.getAlerts();
        setMetrics(latestMetrics);
        setAlerts(latestAlerts);
      };

      updateMetrics();
      intervalRef.current = setInterval(updateMetrics, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, refreshInterval, isMonitoring]);

  useEffect(() => {
    if (!isVisible && isMonitoring) {
      setIsMonitoring(false);
      adminBoundariesAnalytics.stopMonitoring();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isVisible, isMonitoring]);

  const formatTime = useCallback((ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }, []);

  const getAlertColor = useCallback((severity: AdminBoundariesAlert['severity']) => {
    switch (severity) {
      case 'critical': return GEO_COLORS.OPTIMIZATION.CRITICAL_PRIORITY;
      case 'high': return GEO_COLORS.OPTIMIZATION.HIGH_PRIORITY;
      case 'medium': return GEO_COLORS.OPTIMIZATION.MEDIUM_PRIORITY;
      case 'low': return GEO_COLORS.OPTIMIZATION.LOW_PRIORITY;
      default: return colors.text.primary;
    }
  }, [colors.text.primary]);

  const getAlertIcon = useCallback((severity: AdminBoundariesAlert['severity']) => {
    const iconProps = { className: iconSizes.sm };
    switch (severity) {
      case 'critical': return <Flame {...iconProps} />;
      case 'high': return <AlertCircle {...iconProps} />;
      case 'medium': return <AlertTriangle {...iconProps} />;
      case 'low': return <FileText {...iconProps} />;
      default: return <span>•</span>;
    }
  }, [iconSizes.sm]);

  if (!isVisible) return null;

  return (
    <div
      className={`performance-monitor performance-monitor-container ${className}`}
      style={getPerformanceMetricsContainerStyles()}
    >
      {/* Header */}
      <div
        className={`performance-monitor-header ${getDirectionalBorder('muted', 'bottom')}`}
        style={getDynamicHeaderStyles()}
      >
        <h3 className={`performance-monitor-title ${getSectionTitleStyles()}`}>
          🏛️ Admin Boundaries Performance
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className={`performance-monitor-close-btn ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
          >
            ✕
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {metrics && (
          <div className="p-4 space-y-4">
            {/* Search Performance */}
            <div className="space-y-2">
              <h4 className="performance-section-title">🔍 Search Performance</h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Avg Time:</span>
                  <span className="performance-metric-value">{formatTime(metrics.search.averageSearchTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Success Rate:</span>
                  <span className="performance-metric-value">{metrics.search.searchSuccessRate}%</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Cache Hit:</span>
                  <span className="performance-metric-value">{metrics.search.cacheHitRate}%</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Total:</span>
                  <span className="performance-metric-value">{metrics.search.totalSearches}</span>
                </div>
              </div>
            </div>

            {/* API Performance */}
            <div className="space-y-2">
              <h4 className="performance-section-title">🌍 Overpass API</h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Response Time:</span>
                  <span className="performance-metric-value">{formatTime(metrics.overpassApi.averageResponseTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Requests:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.totalRequests}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Failed:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.failedRequests}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Data Size:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.dataSize}MB</span>
                </div>
              </div>
            </div>

            {/* Boundary Processing */}
            <div className="space-y-2">
              <h4 className="performance-section-title">🗺️ Boundary Processing</h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Processing:</span>
                  <span className="performance-metric-value">{formatTime(metrics.boundaries.averageProcessingTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Rendering:</span>
                  <span className="performance-metric-value">{formatTime(metrics.boundaries.renderingTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Processed:</span>
                  <span className="performance-metric-value">{metrics.boundaries.processedBoundaries}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Complexity:</span>
                  <span className="performance-metric-value">{Math.round(metrics.boundaries.geometryComplexity)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className={`performance-alerts-section ${getDirectionalBorder('muted', 'top')}`} style={getSectionBorderStyles()}>
            <div className="performance-alerts-container">
              <h4 className="performance-section-title">🚨 Active Alerts ({alerts.length})</h4>
              <div className="performance-alerts-list">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="performance-alert-item"
                    style={getAlertItemStyles(getAlertSeverityColor(alert.severity))}
                  >
                    <span>{getAlertIcon(alert.severity)}</span>
                    <div className="performance-alert-content">
                      <div className="performance-alert-title" style={getAlertTitleStyles(getAlertSeverityColor(alert.severity))}>
                        {alert.message}
                      </div>
                      {alert.suggestion && (
                        <div className="performance-alert-suggestion">💡 {alert.suggestion}</div>
                      )}
                      <div className="performance-alert-timestamp" style={getAlertTimestampStyles()}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {alerts.length > 5 && (
                <div className="performance-alerts-more">+{alerts.length - 5} more alerts</div>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        <div className={`performance-monitor-status ${getDirectionalBorder('muted', 'top')}`}>
          {isMonitoring ? (
            <span className="performance-monitor-status-active">
              <span className={`performance-status-indicator ${colors.bg.success}`} />
              Monitoring Active • Updates every {refreshInterval / 1000}s
            </span>
          ) : (
            <span className="performance-monitor-status-inactive">Monitoring Stopped</span>
          )}
        </div>
      </div>
    </div>
  );
});

AdminBoundariesPerformancePanel.displayName = 'AdminBoundariesPerformancePanel';
