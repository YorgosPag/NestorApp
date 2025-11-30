/**
 * ANALYTICS DASHBOARD
 * Geo-Alert System - Phase 5: Enterprise Analytics Dashboard
 *
 * Comprehensive analytics dashboard για visualization των event analytics,
 * trends, και business intelligence reports.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  EventAnalyticsEngine,
  AnalyticsTimeRange,
  AnalyticsReport,
  EventMetrics,
  AlertMetrics,
  RuleMetrics,
  NotificationMetrics,
  ExecutiveMetrics,
  AnalyticsInsight,
  AnalyticsRecommendation
} from './EventAnalyticsEngine';

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

interface DashboardState {
  currentReport: AnalyticsReport | null;
  selectedTimeRange: AnalyticsTimeRange;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

const MetricCard: React.FC<{
  title: string;
  value: number | string;
  unit?: string;
  trend?: number;
  icon?: string;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}> = ({ title, value, unit, trend, icon, status = 'good', description }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTrendColor = () => {
    if (!trend) return '#6B7280';
    return trend > 0 ? '#10B981' : '#EF4444';
  };

  const formatTrend = () => {
    if (!trend) return null;
    const direction = trend > 0 ? '↗' : '↘';
    return `${direction} ${Math.abs(trend).toFixed(1)}%`;
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '20px',
      minHeight: '140px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
          {title}
        </h4>
        {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
      </div>

      <div style={{ margin: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: getStatusColor()
          }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: '16px', color: '#6B7280' }}>
              {unit}
            </span>
          )}
        </div>
        {trend !== undefined && (
          <div style={{
            fontSize: '12px',
            color: getTrendColor(),
            marginTop: '4px'
          }}>
            {formatTrend()}
          </div>
        )}
      </div>

      {description && (
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#9CA3AF',
          lineHeight: '1.4'
        }}>
          {description}
        </p>
      )}
    </div>
  );
};

const SimpleChart: React.FC<{
  title: string;
  data: ChartData;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  height?: number;
}> = ({ title, data, type, height = 300 }) => {
  // Simplified chart implementation (στην πραγματικότητα θα χρησιμοποιεί Chart.js ή Recharts)
  const renderSimpleBarChart = () => {
    if (!data.datasets[0]) return null;

    const maxValue = Math.max(...data.datasets[0].data);

    return (
      <div style={{ display: 'flex', alignItems: 'end', gap: '8px', height: height - 100, padding: '20px' }}>
        {data.labels.map((label, index) => {
          const value = data.datasets[0].data[index];
          const barHeight = (value / maxValue) * (height - 150);

          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                background: data.datasets[0].backgroundColor || '#3B82F6',
                width: '100%',
                maxWidth: '40px',
                height: `${barHeight}px`,
                borderRadius: '4px 4px 0 0',
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'center',
                color: 'white',
                fontSize: '10px',
                paddingBottom: '4px'
              }}>
                {value}
              </div>
              <span style={{ fontSize: '10px', marginTop: '8px', textAlign: 'center' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSimplePieChart = () => {
    if (!data.datasets[0]) return null;

    const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
        <div style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: `conic-gradient(${data.datasets[0].data.map((value, index) => {
            const percentage = (value / total) * 100;
            return `${colors[index % colors.length]} ${percentage}%`;
          }).join(', ')})`
        }} />
        <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
          {data.labels.map((label, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: colors[index % colors.length],
                borderRadius: '2px'
              }} />
              <span style={{ fontSize: '12px' }}>
                {label}: {data.datasets[0].data[index]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        {title}
      </h3>
      <div style={{ height: `${height}px` }}>
        {type === 'bar' && renderSimpleBarChart()}
        {type === 'pie' && renderSimplePieChart()}
        {(type === 'line' || type === 'doughnut') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6B7280'
          }}>
            {type} Chart (Implementation needed)
          </div>
        )}
      </div>
    </div>
  );
};

const InsightCard: React.FC<{
  insight: AnalyticsInsight;
  onAction?: (insightId: string) => void;
}> = ({ insight, onAction }) => {
  const getSeverityColor = () => {
    switch (insight.severity) {
      case 'critical': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = () => {
    switch (insight.severity) {
      case 'critical': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
      borderLeft: `4px solid ${getSeverityColor()}`
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>{getSeverityIcon()}</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
            {insight.title}
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6B7280', lineHeight: '1.4' }}>
            {insight.description}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9CA3AF' }}>
              <span>Confidence: {insight.confidence}%</span>
              <span>Type: {insight.type}</span>
            </div>
            {insight.actionRequired && onAction && (
              <button
                onClick={() => onAction(insight.id)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Take Action
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{
  recommendation: AnalyticsRecommendation;
  onImplement?: (recId: string) => void;
}> = ({ recommendation, onImplement }) => {
  const getImpactColor = () => {
    switch (recommendation.impact) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
          {recommendation.title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '500',
            background: getImpactColor() + '20',
            color: getImpactColor()
          }}>
            {recommendation.impact.toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Priority: {recommendation.priority}/10
          </span>
        </div>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6B7280', lineHeight: '1.4' }}>
        {recommendation.description}
      </p>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
          <strong>Estimated Benefit:</strong> {recommendation.estimatedBenefit}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          Effort: {recommendation.effort} | Category: {recommendation.category}
        </div>
      </div>

      {recommendation.implementationSteps.length > 0 && (
        <details style={{ marginBottom: '12px' }}>
          <summary style={{ fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
            Implementation Steps ({recommendation.implementationSteps.length})
          </summary>
          <ul style={{ margin: '8px 0 0 16px', fontSize: '11px', color: '#6B7280' }}>
            {recommendation.implementationSteps.map((step, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>{step}</li>
            ))}
          </ul>
        </details>
      )}

      {onImplement && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onImplement(recommendation.id)}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#3B82F6',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Start Implementation
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN ANALYTICS DASHBOARD
// ============================================================================

export const AnalyticsDashboard: React.FC = () => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [dashboardState, setDashboardState] = useState<DashboardState>({
    currentReport: null,
    selectedTimeRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date(),
      granularity: 'hour'
    },
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'alerts' | 'rules' | 'notifications' | 'insights'>('overview');

  const analyticsEngine = EventAnalyticsEngine.getInstance();

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  const loadAnalyticsData = useCallback(async () => {
    try {
      setDashboardState(prev => ({ ...prev, isLoading: true, error: null }));

      const report = await analyticsEngine.generateComprehensiveReport(
        dashboardState.selectedTimeRange,
        {
          includeExecutiveSummary: true,
          includeDetailedAnalysis: true,
          includeRecommendations: true,
          includeExports: false
        }
      );

      setDashboardState(prev => ({
        ...prev,
        currentReport: report,
        isLoading: false,
        lastUpdated: new Date()
      }));

    } catch (error) {
      setDashboardState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load analytics data',
        isLoading: false
      }));
    }
  }, [dashboardState.selectedTimeRange, analyticsEngine]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleTimeRangeChange = (timeRange: AnalyticsTimeRange) => {
    setDashboardState(prev => ({ ...prev, selectedTimeRange: timeRange }));
  };

  const handleRefresh = () => {
    loadAnalyticsData();
  };

  const handleInsightAction = (insightId: string) => {
    console.log('Taking action on insight:', insightId);
    // Implementation would involve specific action based on insight type
  };

  const handleRecommendationImplement = (recId: string) => {
    console.log('Implementing recommendation:', recId);
    // Implementation would start the recommendation implementation process
  };

  // ========================================================================
  // CHART DATA PREPARATION
  // ========================================================================

  const prepareChartData = (report: AnalyticsReport) => {
    // Events over time chart
    const eventsOverTimeChart: ChartData = {
      labels: report.eventMetrics.eventsOverTime.map(point =>
        point.timestamp.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
      ),
      datasets: [{
        label: 'Events',
        data: report.eventMetrics.eventsOverTime.map(point => point.value),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: '#3B82F6',
        fill: true
      }]
    };

    // Alerts by severity chart
    const alertsBySeverityChart: ChartData = {
      labels: Object.keys(report.alertMetrics.alertsBySeverity),
      datasets: [{
        label: 'Alerts',
        data: Object.values(report.alertMetrics.alertsBySeverity),
        backgroundColor: '#EF4444'
      }]
    };

    // Notifications by channel chart
    const notificationsByChannelChart: ChartData = {
      labels: Object.keys(report.notificationMetrics.notificationsByChannel),
      datasets: [{
        label: 'Notifications',
        data: Object.values(report.notificationMetrics.notificationsByChannel),
        backgroundColor: '#10B981'
      }]
    };

    return {
      eventsOverTimeChart,
      alertsBySeverityChart,
      notificationsByChannelChart
    };
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderOverviewTab = (report: AnalyticsReport) => {
    const chartData = prepareChartData(report);

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Executive Metrics */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Executive Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <MetricCard
              title="System Health Score"
              value={report.executiveMetrics.systemHealthScore}
              unit="%"
              status={report.executiveMetrics.systemHealthScore >= 90 ? 'good' : report.executiveMetrics.systemHealthScore >= 70 ? 'warning' : 'critical'}
              icon="❤️"
              description="Overall system health and performance"
            />
            <MetricCard
              title="Alert Resolution Efficiency"
              value={report.executiveMetrics.alertResolutionEfficiency}
              unit="%"
              status={report.executiveMetrics.alertResolutionEfficiency >= 85 ? 'good' : 'warning'}
              icon="✅"
              description="How quickly alerts are resolved"
            />
            <MetricCard
              title="False Positive Rate"
              value={report.executiveMetrics.falsePositiveRate}
              unit="%"
              status={report.executiveMetrics.falsePositiveRate <= 15 ? 'good' : 'warning'}
              icon="🎯"
              description="Percentage of false alerts"
            />
            <MetricCard
              title="User Satisfaction"
              value={report.executiveMetrics.userSatisfactionScore.toFixed(1)}
              unit="/5"
              status={report.executiveMetrics.userSatisfactionScore >= 4 ? 'good' : 'warning'}
              icon="😊"
              description="Average user satisfaction rating"
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Key Metrics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <MetricCard
              title="Total Events"
              value={report.eventMetrics.totalEvents}
              icon="📊"
              description="Events in selected period"
            />
            <MetricCard
              title="Active Alerts"
              value={Object.values(report.alertMetrics.alertsByStatus)[0] || 0}
              icon="🚨"
              status={Object.values(report.alertMetrics.alertsByStatus)[0] > 10 ? 'warning' : 'good'}
              description="Currently active alerts"
            />
            <MetricCard
              title="Rules Success Rate"
              value={report.ruleMetrics.ruleSuccessRate.toFixed(1)}
              unit="%"
              icon="📜"
              status={report.ruleMetrics.ruleSuccessRate >= 95 ? 'good' : 'warning'}
              description="Rule execution success rate"
            />
            <MetricCard
              title="Notification Success"
              value={report.notificationMetrics.deliverySuccessRate.toFixed(1)}
              unit="%"
              icon="📧"
              status={report.notificationMetrics.deliverySuccessRate >= 90 ? 'good' : 'warning'}
              description="Notification delivery success"
            />
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <SimpleChart
            title="Events Over Time"
            data={chartData.eventsOverTimeChart}
            type="bar"
            height={300}
          />
          <SimpleChart
            title="Alerts by Severity"
            data={chartData.alertsBySeverityChart}
            type="pie"
            height={300}
          />
        </div>
      </div>
    );
  };

  const renderInsightsTab = (report: AnalyticsReport) => {
    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Analytics Insights ({report.insights.length})
          </h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            {report.insights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onAction={handleInsightAction}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Recommendations ({report.recommendations.length})
          </h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            {report.recommendations.map(recommendation => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onImplement={handleRecommendationImplement}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (dashboardState.isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
          <div style={{ color: '#6B7280' }}>Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (dashboardState.error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', color: '#EF4444' }}>❌</div>
          <div style={{ color: '#EF4444', marginBottom: '8px' }}>Error loading analytics</div>
          <div style={{ color: '#6B7280', fontSize: '14px' }}>{dashboardState.error}</div>
          <button
            onClick={handleRefresh}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardState.currentReport) {
    return null;
  }

  const report = dashboardState.currentReport;

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
            📊 Event Analytics & Reporting
          </h1>
          <p style={{ margin: 0, color: '#6B7280' }}>
            {dashboardState.selectedTimeRange.start.toLocaleDateString('el-GR')} - {dashboardState.selectedTimeRange.end.toLocaleDateString('el-GR')}
            {dashboardState.lastUpdated && (
              <span style={{ marginLeft: '16px' }}>
                Last updated: {dashboardState.lastUpdated.toLocaleTimeString('el-GR')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
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
          🔄 Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid #E5E7EB'
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: '📈' },
          { id: 'events', label: 'Events', icon: '📋' },
          { id: 'alerts', label: 'Alerts', icon: '🚨' },
          { id: 'rules', label: 'Rules', icon: '📜' },
          { id: 'notifications', label: 'Notifications', icon: '📧' },
          { id: 'insights', label: 'Insights & Recommendations', icon: '💡' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              // ✅ ENTERPRISE: Type guard instead of 'as any'
              const validTabs = ['overview', 'events', 'alerts', 'rules', 'notifications', 'insights'];
              if (validTabs.includes(tab.id)) {
                setActiveTab(tab.id as typeof activeTab);
              }
            }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? '#3B82F6' : '#6B7280',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab(report)}
        {activeTab === 'insights' && renderInsightsTab(report)}
        {(activeTab === 'events' || activeTab === 'alerts' || activeTab === 'rules' || activeTab === 'notifications') && (
          <div style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tab
            </h3>
            <p style={{ margin: 0, color: '#6B7280' }}>
              Detailed {activeTab} analytics will be implemented in the next iteration.
              For now, check the Overview and Insights tabs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;