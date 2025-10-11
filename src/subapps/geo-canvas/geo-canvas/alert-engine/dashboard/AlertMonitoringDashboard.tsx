/**
 * REAL-TIME ALERT MONITORING DASHBOARD
 * Geo-Alert System - Phase 5: Enterprise Dashboard με Real-time Monitoring
 *
 * Comprehensive real-time monitoring interface για το alert engine system.
 * Implements enterprise dashboard patterns με live data updates.
 */

import React, { useState, useCallback } from 'react';
import {
  Alert,
  AlertSeverity,
  AlertStatus
} from '../detection/AlertDetectionSystem';
import { useDashboard } from './useDashboard';
import { DashboardMetrics, RealTimeEvent } from './DashboardService';

// ============================================================================
// TYPES και INTERFACES (imported από DashboardService)
// ============================================================================

// ============================================================================
// DASHBOARD COMPONENTS
// ============================================================================

const MetricsCard: React.FC<{
  title: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'success' | 'warning' | 'error';
  subtitle?: string;
  icon?: string;
}> = ({ title, value, trend, status, subtitle, icon }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '';
    }
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
          {title}
        </h3>
        {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: getStatusColor()
        }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: '14px', color: '#6B7280' }}>
            {getTrendIcon()}
          </span>
        )}
      </div>
      {subtitle && (
        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

const AlertsList: React.FC<{
  alerts: Alert[];
  onAlertClick: (alert: Alert) => void;
  maxItems?: number;
}> = ({ alerts, onAlertClick, maxItems = 10 }) => {
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'high': return '#EA580C';
      case 'medium': return '#D97706';
      case 'low': return '#059669';
      case 'info': return '#0284C7';
      default: return '#6B7280';
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    const colors = {
      'active': '#DC2626',
      'acknowledged': '#D97706',
      'resolved': '#059669',
      'suppressed': '#6B7280'
    };

    return (
      <span style={{
        background: colors[status] + '20',
        color: colors[status],
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '10px',
        fontWeight: '500',
        textTransform: 'uppercase'
      }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        Πρόσφατα Alerts ({alerts.length})
      </h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {alerts.slice(0, maxItems).map((alert) => (
          <div
            key={alert.id}
            onClick={() => onAlertClick(alert)}
            style={{
              padding: '12px',
              borderBottom: '1px solid #F3F4F6',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
              ':hover': { background: '#F9FAFB' }
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getSeverityColor(alert.severity)
                  }}
                />
                <span style={{ fontWeight: '500', fontSize: '14px' }}>
                  {alert.title}
                </span>
                {getStatusBadge(alert.status)}
              </div>
              <p style={{ margin: '0 0 4px 16px', fontSize: '12px', color: '#6B7280' }}>
                {alert.description}
              </p>
              <span style={{ marginLeft: '16px', fontSize: '10px', color: '#9CA3AF' }}>
                {new Date(alert.timestamp).toLocaleString('el-GR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RealTimeEventLog: React.FC<{
  events: RealTimeEvent[];
  maxItems?: number;
}> = ({ events, maxItems = 20 }) => {
  const getEventIcon = (type: RealTimeEvent['type']) => {
    switch (type) {
      case 'alert': return '🚨';
      case 'rule': return '📜';
      case 'notification': return '📧';
      case 'system': return '⚙️';
      default: return '📋';
    }
  };

  const getSeverityColor = (severity: RealTimeEvent['severity']) => {
    switch (severity) {
      case 'error': return '#DC2626';
      case 'warning': return '#D97706';
      case 'info': return '#059669';
      default: return '#6B7280';
    }
  };

  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        Real-time Events ({events.length})
      </h3>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {events.slice(0, maxItems).map((event) => (
          <div
            key={event.id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '14px' }}>{getEventIcon(event.type)}</span>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: '12px',
                  color: getSeverityColor(event.severity),
                  fontWeight: '500'
                }}
              >
                {event.message}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
              {new Date(event.timestamp).toLocaleTimeString('el-GR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemStatusIndicator: React.FC<{
  status: DashboardMetrics['system']['status'];
  uptime: number;
  lastUpdate: Date;
}> = ({ status, uptime, lastUpdate }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return { color: '#10B981', icon: '✅', text: 'Υγιές Σύστημα' };
      case 'degraded':
        return { color: '#F59E0B', icon: '⚠️', text: 'Υποβαθμισμένο' };
      case 'critical':
        return { color: '#EF4444', icon: '🔴', text: 'Κρίσιμο' };
      default:
        return { color: '#6B7280', icon: '❓', text: 'Άγνωστο' };
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ώ ${minutes}λ`;
  };

  const config = getStatusConfig();

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px' }}>{config.icon}</span>
        <h3 style={{ margin: 0, fontSize: '16px', color: config.color, fontWeight: '600' }}>
          {config.text}
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          <strong>Uptime:</strong> {formatUptime(uptime)}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          <strong>Τελευταία ενημέρωση:</strong> {lastUpdate.toLocaleTimeString('el-GR')}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const AlertMonitoringDashboard: React.FC = () => {
  // ========================================================================
  // DASHBOARD HOOK INTEGRATION
  // ========================================================================

  const {
    metrics,
    events: realtimeEvents,
    recentAlerts,
    isLoading,
    isRefreshing,
    error,
    refresh,
    clearEvents,
    toggleAutoRefresh,
    updateConfig,
    autoRefresh: isAutoRefresh,
    lastUpdated,
    performanceMetrics
  } = useDashboard({
    autoRefresh: true,
    refreshInterval: 5000,
    maxEvents: 50,
    enableRealTimeUpdates: true,
    onError: (error) => console.error('Dashboard error:', error),
    onMetricsUpdate: (metrics) => console.log('Metrics updated:', metrics.system.status),
    onNewEvent: (event) => console.log('New event:', event.message)
  });

  // ========================================================================
  // LOCAL STATE
  // ========================================================================

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // ========================================================================
  // LOCAL CONFIGURATION
  // ========================================================================

  const handleConfigChange = useCallback((newConfig: any) => {
    updateConfig(newConfig);
  }, [updateConfig]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleAlertClick = useCallback((alert: Alert) => {
    setSelectedAlert(alert);
  }, []);

  const handleRefreshClick = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleToggleAutoRefresh = useCallback(() => {
    toggleAutoRefresh();
  }, [toggleAutoRefresh]);

  const handleClearEvents = useCallback(() => {
    clearEvents();
  }, [clearEvents]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (isLoading || !metrics) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
          <div style={{ color: '#6B7280' }}>Φόρτωση dashboard...</div>
          {error && (
            <div style={{ color: '#EF4444', marginTop: '8px', fontSize: '12px' }}>
              Error: {error.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#F9FAFB',
      minHeight: '100vh',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold' }}>
            🚨 Alert Monitoring Dashboard
          </h1>
          <p style={{ margin: 0, color: '#6B7280' }}>
            Real-time παρακολούθηση του Geo-Alert System
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleToggleAutoRefresh}
            style={{
              padding: '8px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: isAutoRefresh ? '#10B981' : 'white',
              color: isAutoRefresh ? 'white' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              opacity: isRefreshing ? 0.7 : 1
            }}
            disabled={isRefreshing}
          >
            {isAutoRefresh ? '⏸️ Παύση' : '▶️ Auto'}
          </button>
          <button
            onClick={handleRefreshClick}
            style={{
              padding: '8px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              opacity: isRefreshing ? 0.7 : 1
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? '🔄 Ενημέρωση...' : '🔄 Ανανέωση'}
          </button>
          <button
            onClick={handleClearEvents}
            style={{
              padding: '8px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🗑️ Clear Events
          </button>
          {lastUpdated && (
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              Τελευταία: {lastUpdated.toLocaleTimeString('el-GR')}
            </span>
          )}
        </div>
      </div>

      {/* System Status */}
      <div style={{ marginBottom: '24px' }}>
        <SystemStatusIndicator
          status={metrics.system.status}
          uptime={metrics.system.uptime}
          lastUpdate={metrics.system.lastUpdate}
        />
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricsCard
          title="Συνολικά Alerts"
          value={metrics.alerts.total}
          status={metrics.alerts.active > 0 ? 'warning' : 'success'}
          subtitle={`${metrics.alerts.active} ενεργά`}
          icon="🚨"
        />
        <MetricsCard
          title="Alerts 24ώρου"
          value={metrics.alerts.last24Hours}
          trend={metrics.alerts.last24Hours > 10 ? 'up' : 'stable'}
          icon="📈"
        />
        <MetricsCard
          title="Κανόνες Ενεργοί"
          value={`${metrics.rules.active}/${metrics.rules.total}`}
          status="success"
          subtitle={`${metrics.rules.successRate}% επιτυχία`}
          icon="📜"
        />
        <MetricsCard
          title="Notifications Sent"
          value={metrics.notifications.sent}
          status={metrics.notifications.failed > 0 ? 'warning' : 'success'}
          subtitle={`${metrics.notifications.failed} αποτυχίες`}
          icon="📧"
        />
      </div>

      {/* Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px'
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <AlertsList
            alerts={recentAlerts}
            onAlertClick={handleAlertClick}
            maxItems={8}
          />
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <RealTimeEventLog
            events={realtimeEvents}
            maxItems={15}
          />
        </div>
      </div>

      {/* Alert Detail Modal (Simple) */}
      {selectedAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedAlert(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>{selectedAlert.title}</h3>
            <p style={{ margin: '0 0 16px 0', color: '#6B7280' }}>
              {selectedAlert.description}
            </p>
            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
              <div><strong>Severity:</strong> {selectedAlert.severity}</div>
              <div><strong>Status:</strong> {selectedAlert.status}</div>
              <div><strong>Timestamp:</strong> {new Date(selectedAlert.timestamp).toLocaleString('el-GR')}</div>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: '#374151',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertMonitoringDashboard;