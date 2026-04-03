import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { CommunicationChannel } from '@/types/communications';

interface NotificationDispatchInput {
  messageId: string;
  conversationId: string;
  recipientId: string;
  tenantId: string;
  direction: 'inbound' | 'outbound';
  content: {
    text: string;
  };
  channel: CommunicationChannel;
}

export async function dispatchRealtimeMessageNotificationWithPolicy(
  input: NotificationDispatchInput,
): Promise<void> {
  await apiClient.post(API_ROUTES.NOTIFICATIONS.DISPATCH, input);
}

interface ErrorReportNotificationInput {
  errorId: string;
  message: string;
  stack?: string;
  componentStack?: string;
  component: string;
  severity: string;
  timestamp: string;
  url: string;
  userAgent: string;
  digest?: string;
  retryCount?: number;
}

interface ErrorReportNotificationResponse {
  success: boolean;
  notificationId?: string;
  error?: string;
}

export async function reportErrorNotificationWithPolicy(
  input: ErrorReportNotificationInput,
): Promise<ErrorReportNotificationResponse> {
  return apiClient.post<ErrorReportNotificationResponse>(
    API_ROUTES.NOTIFICATIONS.ERROR_REPORT,
    input,
  );
}
