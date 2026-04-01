/**
 * ANALYTICS DASHBOARD
 * Geo-Alert System - Phase 5: Enterprise Analytics Dashboard
 *
 * Comprehensive analytics dashboard for visualization of event analytics,
 * trends, and business intelligence reports.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useBorderTokens } from '../../../../src/hooks/useBorderTokens';
import { formatDate, formatDateTime } from '../../../../src/lib/intl-utils';
import { EventAnalyticsEngine, type AnalyticsReport } from './EventAnalyticsEngine';
import {
  useDynamicBackgroundClass,
  useDynamicTextClass,
} from '../../../../src/components/ui/utils/dynamic-styles';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../src/components/ui/effects/hover-effects';
import {
  ACTION_LOG_MESSAGES,
  ANALYTICS_DASHBOARD_TABS,
  DEFAULT_TIME_RANGE_DURATION_MS,
  EMPTY_STATE_MESSAGES,
} from './AnalyticsDashboard.constants';
import type { AnalyticsDashboardTabId, DashboardState } from './AnalyticsDashboard.types';
import {
  getActiveAlertsCount,
  getDetailTabTitle,
  isAnalyticsDashboardTabId,
  prepareChartData,
} from './AnalyticsDashboard.utils';
import MetricCard from './components/MetricCard';
import SimpleChart from './components/SimpleChart';
import InsightCard from './components/InsightCard';
import RecommendationCard from './components/RecommendationCard';

const LOADING_BACKGROUND_COLOR = '#F9FAFB';
const ERROR_TEXT_COLOR = '#EF4444';
const MUTED_TEXT_COLOR = '#6B7280';
const TITLE_TEXT_COLOR = '#000';

export const AnalyticsDashboard: React.FC = () => {
  const { quick, getStatusBorder } = useBorderTokens();

  const loadingBgClass = useDynamicBackgroundClass(LOADING_BACKGROUND_COLOR);
  const errorTextClass = useDynamicTextClass(ERROR_TEXT_COLOR);
  const grayTextClass = useDynamicTextClass(MUTED_TEXT_COLOR);
  const mainBgClass = useDynamicBackgroundClass(LOADING_BACKGROUND_COLOR);
  const titleTextClass = useDynamicTextClass(TITLE_TEXT_COLOR);
  const refreshButtonBgClass = useDynamicBackgroundClass('white');

  const [dashboardState, setDashboardState] = useState<DashboardState>({
    currentReport: null,
    selectedTimeRange: {
      start: new Date(Date.now() - DEFAULT_TIME_RANGE_DURATION_MS),
      end: new Date(),
      granularity: 'hour',
    },
    isLoading: true,
    error: null,
    lastUpdated: null,
  });
  const [activeTab, setActiveTab] = useState<AnalyticsDashboardTabId>('overview');

  const analyticsEngine = EventAnalyticsEngine.getInstance();

  const loadAnalyticsData = useCallback(async () => {
    try {
      setDashboardState(prev => ({ ...prev, isLoading: true, error: null }));

      const report = await analyticsEngine.generateComprehensiveReport(
        dashboardState.selectedTimeRange,
        {
          includeExecutiveSummary: true,
          includeDetailedAnalysis: true,
          includeRecommendations: true,
          includeExports: false,
        }
      );

      setDashboardState(prev => ({
        ...prev,
        currentReport: report,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      setDashboardState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load analytics data',
        isLoading: false,
      }));
    }
  }, [analyticsEngine, dashboardState.selectedTimeRange]);

  useEffect(() => {
    void loadAnalyticsData();
  }, [loadAnalyticsData]);

  const handleRefresh = () => {
    void loadAnalyticsData();
  };

  const handleInsightAction = (insightId: string) => {
    console.log(ACTION_LOG_MESSAGES.insight, insightId);
  };

  const handleRecommendationImplement = (recommendationId: string) => {
    console.log(ACTION_LOG_MESSAGES.recommendation, recommendationId);
  };

  const renderOverviewTab = (report: AnalyticsReport) => {
    const chartData = prepareChartData(report);
    const activeAlertsCount = getActiveAlertsCount(report);

    return (
      <div className="grid gap-6">
        <section>
          <h2 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Executive Summary
          </h2>
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
        </section>

        <section>
          <h2 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Key Metrics
          </h2>
          <div className="grid grid-cols-auto-fit-200 gap-4">
            <MetricCard
              title="Total Events"
              value={report.eventMetrics.totalEvents}
              icon="📊"
              description="Events in selected period"
            />
            <MetricCard
              title="Active Alerts"
              value={activeAlertsCount}
              icon="🚨"
              status={activeAlertsCount > 10 ? 'warning' : 'good'}
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
        </section>

        <section className="grid grid-cols-[2fr_1fr] gap-6">
          <SimpleChart
            title="Events Over Time"
            data={chartData.eventsOverTimeChart}
            type="bar"
          />
          <SimpleChart
            title="Alerts by Severity"
            data={chartData.alertsBySeverityChart}
            type="pie"
          />
        </section>
      </div>
    );
  };

  const renderInsightsTab = (report: AnalyticsReport) => {
    return (
      <div className="grid gap-6">
        <section>
          <h2 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Analytics Insights ({report.insights.length})
          </h2>
          <div className="grid gap-4">
            {report.insights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onAction={handleInsightAction}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
            Recommendations ({report.recommendations.length})
          </h2>
          <div className="grid gap-4">
            {report.recommendations.map(recommendation => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onImplement={handleRecommendationImplement}
              />
            ))}
          </div>
        </section>
      </div>
    );
  };

  if (dashboardState.isLoading) {
    return (
      <section className={`flex justify-center items-center h-[400px] ${loadingBgClass}`}>
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className={grayTextClass}>{EMPTY_STATE_MESSAGES.loading}</div>
        </div>
      </section>
    );
  }

  if (dashboardState.error) {
    return (
      <section className={`flex justify-center items-center h-[400px] ${loadingBgClass}`}>
        <div className="text-center">
          <div className={`text-2xl mb-2 ${errorTextClass}`}>❌</div>
          <div className={`mb-2 ${errorTextClass}`}>{EMPTY_STATE_MESSAGES.errorTitle}</div>
          <div className={`text-sm ${grayTextClass}`}>{dashboardState.error}</div>
          <button
            onClick={handleRefresh}
            className={`mt-4 px-4 py-2 ${quick.card} cursor-pointer ${refreshButtonBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
          >
            {EMPTY_STATE_MESSAGES.retry}
          </button>
        </div>
      </section>
    );
  }

  if (!dashboardState.currentReport) {
    return null;
  }

  const report = dashboardState.currentReport;
  const isDetailTab =
    activeTab === 'events' ||
    activeTab === 'alerts' ||
    activeTab === 'rules' ||
    activeTab === 'notifications';

  return (
    <main className={`${mainBgClass} min-h-screen p-6`}>
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`m-0 mb-2 text-4xl font-bold ${titleTextClass}`}>
            📊 Event Analytics & Reporting
          </h1>
          <p className={`m-0 ${grayTextClass}`}>
            {formatDate(dashboardState.selectedTimeRange.start)} - {formatDate(dashboardState.selectedTimeRange.end)}
            {dashboardState.lastUpdated && (
              <span className="ml-4">
                Last updated: {formatDateTime(dashboardState.lastUpdated, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={`px-4 py-2 ${quick.card} text-sm text-gray-700 cursor-pointer ${refreshButtonBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
        >
          🔄 Refresh
        </button>
      </header>

      <nav className={`flex gap-1 mb-6 ${quick.separatorH}`} aria-label="Analytics dashboard sections">
        {ANALYTICS_DASHBOARD_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (isAnalyticsDashboardTabId(tab.id)) {
                setActiveTab(tab.id);
              }
            }}
            className={`px-4 py-3 border-none border-b-2 bg-transparent cursor-pointer text-sm font-medium ${
              activeTab === tab.id
                ? `${getStatusBorder('info')} text-blue-500`
                : 'border-transparent text-gray-500'
            } ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      <section>
        {activeTab === 'overview' && renderOverviewTab(report)}
        {activeTab === 'insights' && renderInsightsTab(report)}
        {isDetailTab && (
          <section className={`${refreshButtonBgClass} ${quick.card} p-6 text-center`}>
            <h2 className={`m-0 mb-4 text-lg font-semibold ${titleTextClass}`}>
              {getDetailTabTitle(activeTab)}
            </h2>
            <p className={`m-0 ${grayTextClass}`}>
              Detailed {activeTab} {EMPTY_STATE_MESSAGES.detailedTabSuffix}{' '}
              {EMPTY_STATE_MESSAGES.detailedTabHint}
            </p>
          </section>
        )}
      </section>
    </main>
  );
};

export default AnalyticsDashboard;
