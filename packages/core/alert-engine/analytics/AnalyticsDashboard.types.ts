import type {
  AnalyticsInsight,
  AnalyticsRecommendation,
  AnalyticsReport,
  AnalyticsTimeRange,
} from './EventAnalyticsEngine';

export interface DashboardState {
  currentReport: AnalyticsReport | null;
  selectedTimeRange: AnalyticsTimeRange;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
  fill?: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface AnalyticsCharts {
  eventsOverTimeChart: ChartData;
  alertsBySeverityChart: ChartData;
  notificationsByChannelChart: ChartData;
}

export type AnalyticsDashboardTabId =
  | 'overview'
  | 'events'
  | 'alerts'
  | 'rules'
  | 'notifications'
  | 'insights';

export interface AnalyticsDashboardTab {
  id: AnalyticsDashboardTabId;
  label: string;
  icon: string;
}

export interface InsightCardActionProps {
  insight: AnalyticsInsight;
  onAction?: (insightId: string) => void;
}

export interface RecommendationCardActionProps {
  recommendation: AnalyticsRecommendation;
  onImplement?: (recommendationId: string) => void;
}
