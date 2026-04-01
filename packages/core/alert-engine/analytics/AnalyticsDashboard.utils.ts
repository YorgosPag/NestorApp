import { formatDateTime } from '../../../../src/lib/intl-utils';
import type { AnalyticsReport } from './EventAnalyticsEngine';
import {
  ANALYTICS_DASHBOARD_TAB_IDS,
  CHART_COLOR_TOKENS,
} from './AnalyticsDashboard.constants';
import type {
  AnalyticsCharts,
  AnalyticsDashboardTabId,
  ChartData,
} from './AnalyticsDashboard.types';

export const isAnalyticsDashboardTabId = (
  value: string
): value is AnalyticsDashboardTabId => {
  return ANALYTICS_DASHBOARD_TAB_IDS.includes(value as AnalyticsDashboardTabId);
};

export const prepareChartData = (report: AnalyticsReport): AnalyticsCharts => {
  const eventsOverTimeChart: ChartData = {
    labels: report.eventMetrics.eventsOverTime.map(point =>
      formatDateTime(point.timestamp, { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [{
      label: 'Events',
      data: report.eventMetrics.eventsOverTime.map(point => point.value),
      backgroundColor: CHART_COLOR_TOKENS.eventsFill,
      borderColor: CHART_COLOR_TOKENS.eventsStroke,
      fill: true,
    }],
  };

  const alertsBySeverityChart: ChartData = {
    labels: Object.keys(report.alertMetrics.alertsBySeverity),
    datasets: [{
      label: 'Alerts',
      data: Object.values(report.alertMetrics.alertsBySeverity),
      backgroundColor: CHART_COLOR_TOKENS.alerts,
    }],
  };

  const notificationsByChannelChart: ChartData = {
    labels: Object.keys(report.notificationMetrics.notificationsByChannel),
    datasets: [{
      label: 'Notifications',
      data: Object.values(report.notificationMetrics.notificationsByChannel),
      backgroundColor: CHART_COLOR_TOKENS.notifications,
    }],
  };

  return {
    eventsOverTimeChart,
    alertsBySeverityChart,
    notificationsByChannelChart,
  };
};

export const getActiveAlertsCount = (report: AnalyticsReport): number => {
  return report.alertMetrics.alertsByStatus.new ?? 0;
};

export const getDetailTabTitle = (
  activeTab: Exclude<AnalyticsDashboardTabId, 'overview' | 'insights'>
): string => {
  return `${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)} Tab`;
};
