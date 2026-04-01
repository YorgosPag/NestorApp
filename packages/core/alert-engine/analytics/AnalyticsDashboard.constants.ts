import type { AnalyticsDashboardTab, AnalyticsDashboardTabId } from './AnalyticsDashboard.types';

export const DEFAULT_TIME_RANGE_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CHART_HEIGHT = 300;
export const CHART_BAR_PADDING = 150;
export const CHART_CONTAINER_OFFSET = 100;

export const ANALYTICS_DASHBOARD_TABS: AnalyticsDashboardTab[] = [
  { id: 'overview', label: 'Overview', icon: '📈' },
  { id: 'events', label: 'Events', icon: '📋' },
  { id: 'alerts', label: 'Alerts', icon: '🚨' },
  { id: 'rules', label: 'Rules', icon: '📜' },
  { id: 'notifications', label: 'Notifications', icon: '📧' },
  { id: 'insights', label: 'Insights & Recommendations', icon: '💡' },
];

export const ANALYTICS_DASHBOARD_TAB_IDS: AnalyticsDashboardTabId[] =
  ANALYTICS_DASHBOARD_TABS.map(tab => tab.id);

/* eslint-disable design-system/no-hardcoded-colors -- SVG chart rendering requires raw hex values */
export const PIE_CHART_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
];

export const CHART_COLOR_TOKENS = {
  eventsFill: 'rgba(59, 130, 246, 0.5)',
  eventsStroke: '#3B82F6',
  alerts: '#EF4444',
  notifications: '#10B981',
} as const;
/* eslint-enable design-system/no-hardcoded-colors */

export const EMPTY_STATE_MESSAGES = {
  loading: 'Loading analytics...',
  errorTitle: 'Error loading analytics',
  retry: 'Retry',
  detailedTabSuffix: 'analytics will be implemented in the next iteration.',
  detailedTabHint: 'For now, check the Overview and Insights tabs.',
} as const;

export const ACTION_LOG_MESSAGES = {
  insight: 'Taking action on insight:',
  recommendation: 'Implementing recommendation:',
} as const;
