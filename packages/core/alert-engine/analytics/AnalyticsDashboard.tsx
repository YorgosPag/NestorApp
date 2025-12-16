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
import {
  useDynamicBackgroundClass,
  useDynamicTextClass,
  useDynamicBorderClass,
  useDynamicElementClasses,
  DynamicStyleConfig
} from '../../../../src/components/ui/utils/dynamic-styles';
import { layoutUtilities } from '../../../../src/styles/design-tokens';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../src/components/ui/effects/hover-effects';
import { analyticsDashboardStyles, calculateBarHeight } from './AnalyticsDashboard.styles';

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

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES
  const cardBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass('#6B7280');
  const valueTextClass = useDynamicTextClass(getStatusColor());
  const unitTextClass = useDynamicTextClass('#6B7280');
  const trendTextClass = useDynamicTextClass(getTrendColor());
  const descTextClass = useDynamicTextClass('#9CA3AF');

  const formatTrend = () => {
    if (!trend) return null;
    const direction = trend > 0 ? '↗' : '↘';
    return `${direction} ${Math.abs(trend).toFixed(1)}%`;
  };

  return (
    <div className={`${cardBgClass} border border-gray-200 rounded-lg p-5 min-h-[140px] flex flex-col justify-between ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}>
      <div className="flex justify-between items-center">
        <h4 className={`m-0 text-sm font-medium ${titleTextClass}`}>
          {title}
        </h4>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${valueTextClass}`}>
            {value}
          </span>
          {unit && (
            <span className={`text-base ${unitTextClass}`}>
              {unit}
            </span>
          )}
        </div>
        {trend !== undefined && (
          <div className={`text-xs mt-1 ${trendTextClass}`}>
            {formatTrend()}
          </div>
        )}
      </div>

      {description && (
        <p className={`m-0 text-xs leading-relaxed ${descTextClass}`}>
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
  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES
  const chartBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass('#000');
  const labelTextClass = useDynamicTextClass('#000');
  const barBgClass = useDynamicBackgroundClass(data.datasets[0]?.backgroundColor || '#3B82F6');
  const centerTextClass = useDynamicTextClass('#6B7280');
  // Simplified chart implementation (στην πραγματικότητα θα χρησιμοποιεί Chart.js ή Recharts)
  const renderSimpleBarChart = () => {
    if (!data.datasets[0]) return null;

    const maxValue = Math.max(...data.datasets[0].data);

    return (
      <div style={analyticsDashboardStyles.barChart.container(height)}>
        {data.labels.map((label, index) => {
          const value = data.datasets[0].data[index];
          const barHeight = calculateBarHeight(value, maxValue, height, 150);

          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className={`${barBgClass}`}
                style={analyticsDashboardStyles.barChart.bar(barHeight)}
              >
                {value}
              </div>
              <span className={`${labelTextClass}`} style={analyticsDashboardStyles.barChart.label}>
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
      <div className="flex flex-col items-center p-5">
        <div
          className="w-[200px] h-[200px] rounded-full"
          className={useDynamicBackgroundClass(
            `conic-gradient(${data.datasets[0].data.map((value, index) => {
              const percentage = (value / total) * 100;
              return `${colors[index % colors.length]} ${percentage}%`;
            }).join(', ')})`
          )}
        />
        <div className="mt-5 flex flex-wrap gap-3 justify-center">
          {data.labels.map((label, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                className={useDynamicBackgroundClass(colors[index % colors.length])}
              />
              <span className={`text-xs ${labelTextClass}`}>
                {label}: {data.datasets[0].data[index]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`${chartBgClass} border border-gray-200 rounded-lg p-4`}>
      <h3 className={`m-0 mb-4 text-base font-semibold ${titleTextClass}`}>
        {title}
      </h3>
      <div style={analyticsDashboardStyles.charts.container(height)}>
        {type === 'bar' && renderSimpleBarChart()}
        {type === 'pie' && renderSimplePieChart()}
        {(type === 'line' || type === 'doughnut') && (
          <div className={`flex items-center justify-center h-full ${centerTextClass}`}>
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

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES
  const cardBgClass = useDynamicBackgroundClass('white');
  const borderLeftClass = useDynamicBorderClass(getSeverityColor(), '4px');
  const titleTextClass = useDynamicTextClass('#000');
  const descTextClass = useDynamicTextClass('#6B7280');
  const metaTextClass = useDynamicTextClass('#9CA3AF');

  return (
    <div className={`${cardBgClass} border border-gray-200 rounded-lg p-4 ${borderLeftClass}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{getSeverityIcon()}</span>
        <div className="flex-1">
          <h4 className={`m-0 mb-2 text-sm font-semibold ${titleTextClass}`}>
            {insight.title}
          </h4>
          <p className={`m-0 mb-3 text-xs leading-relaxed ${descTextClass}`}>
            {insight.description}
          </p>
          <div className="flex justify-between items-center">
            <div className={`flex gap-3 text-xs ${metaTextClass}`}>
              <span>Confidence: {insight.confidence}%</span>
              <span>Type: {insight.type}</span>
            </div>
            {insight.actionRequired && onAction && (
              <button
                onClick={() => onAction(insight.id)}
                className={`px-3 py-1 border border-gray-300 rounded text-xs text-gray-700 cursor-pointer ${cardBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
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

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES
  const cardBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass('#000');
  const impactBadgeBgClass = useDynamicBackgroundClass(getImpactColor() + '20');
  const impactBadgeTextClass = useDynamicTextClass(getImpactColor());
  const priorityTextClass = useDynamicTextClass('#6B7280');
  const descTextClass = useDynamicTextClass('#6B7280');
  const metaTextClass = useDynamicTextClass('#374151');
  const buttonBgClass = useDynamicBackgroundClass('#3B82F6');

  return (
    <div className={`${cardBgClass} border border-gray-200 rounded-lg p-4`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className={`m-0 text-sm font-semibold ${titleTextClass}`}>
          {recommendation.title}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impactBadgeBgClass} ${impactBadgeTextClass}`}>
            {recommendation.impact.toUpperCase()}
          </span>
          <span className={`text-xs ${priorityTextClass}`}>
            Priority: {recommendation.priority}/10
          </span>
        </div>
      </div>

      <p className={`m-0 mb-3 text-xs leading-relaxed ${descTextClass}`}>
        {recommendation.description}
      </p>

      <div className="mb-3">
        <div className={`text-xs mb-1 ${metaTextClass}`}>
          <strong>Estimated Benefit:</strong> {recommendation.estimatedBenefit}
        </div>
        <div className={`text-xs ${priorityTextClass}`}>
          Effort: {recommendation.effort} | Category: {recommendation.category}
        </div>
      </div>

      {recommendation.implementationSteps.length > 0 && (
        <details className="mb-3">
          <summary className={`text-xs cursor-pointer ${metaTextClass}`}>
            Implementation Steps ({recommendation.implementationSteps.length})
          </summary>
          <ul className={`mt-2 ml-4 text-xs ${priorityTextClass}`}>
            {recommendation.implementationSteps.map((step, index) => (
              <li key={index} className="mb-1">{step}</li>
            ))}
          </ul>
        </details>
      )}

      {onImplement && (
        <div className="flex justify-end">
          <button
            onClick={() => onImplement(recommendation.id)}
            className={`px-4 py-1.5 border-none rounded text-xs text-white cursor-pointer ${buttonBgClass} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT}`}
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
  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES
  const loadingBgClass = useDynamicBackgroundClass('#F9FAFB');
  const errorTextClass = useDynamicTextClass('#EF4444');
  const grayTextClass = useDynamicTextClass('#6B7280');
  const mainBgClass = useDynamicBackgroundClass('#F9FAFB');
  const titleTextClass = useDynamicTextClass('#000');
  const refreshButtonBgClass = useDynamicBackgroundClass('white');

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
      <div className="grid gap-6">
        {/* Executive Metrics */}
        <div>
          <h3 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Executive Summary
          </h3>
          <div className="grid grid-cols-auto-fit-250 gap-4">
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
          <h3 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Key Metrics
          </h3>
          <div className="grid grid-cols-auto-fit-200 gap-4">
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
        <div className="grid grid-cols-[2fr_1fr] gap-6">
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
      <div className="grid gap-6">
        <div>
          <h3 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Analytics Insights ({report.insights.length})
          </h3>
          <div className="grid gap-4">
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
          <h3 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Recommendations ({report.recommendations.length})
          </h3>
          <div className="grid gap-4">
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
      <div className={`flex justify-center items-center h-[400px] ${loadingBgClass}`}>
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className={grayTextClass}>Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (dashboardState.error) {
    return (
      <div className={`flex justify-center items-center h-[400px] ${loadingBgClass}`}>
        <div className="text-center">
          <div className={`text-2xl mb-2 ${errorTextClass}`}>❌</div>
          <div className={`mb-2 ${errorTextClass}`}>Error loading analytics</div>
          <div className={`text-sm ${grayTextClass}`}>{dashboardState.error}</div>
          <button
            onClick={handleRefresh}
            className={`mt-4 px-4 py-2 border border-gray-300 rounded-md cursor-pointer ${refreshButtonBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
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
    <div className={`${mainBgClass} min-h-screen p-6`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`m-0 mb-2 text-4xl font-bold ${titleTextClass}`}>
            📊 Event Analytics & Reporting
          </h1>
          <p className={`m-0 ${grayTextClass}`}>
            {dashboardState.selectedTimeRange.start.toLocaleDateString('el-GR')} - {dashboardState.selectedTimeRange.end.toLocaleDateString('el-GR')}
            {dashboardState.lastUpdated && (
              <span className="ml-4">
                Last updated: {dashboardState.lastUpdated.toLocaleTimeString('el-GR')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={`px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer ${refreshButtonBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
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
            className={`px-4 py-3 border-none border-b-2 bg-transparent cursor-pointer text-sm font-medium ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-500'
            } ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
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
          <div className={`${refreshButtonBgClass} border border-gray-200 rounded-lg p-6 text-center`}>
            <h3 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tab
            </h3>
            <p className={`m-0 ${grayTextClass}`}>
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