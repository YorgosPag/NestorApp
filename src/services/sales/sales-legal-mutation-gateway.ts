import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction } from '@/types/audit-trail';

interface ProfessionalAssignmentNotificationInput {
  contactId: string;
  role: string;
  propertyId: string;
  type?: 'assignment' | 'removal';
}

interface PropertyActivityInput {
  action: AuditAction;
  changes: Array<{
    field: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
    label?: string;
  }>;
}

export async function notifyProfessionalAssignmentWithPolicy(
  input: ProfessionalAssignmentNotificationInput,
): Promise<void> {
  await apiClient.post(API_ROUTES.NOTIFICATIONS.PROFESSIONAL_ASSIGNED, input);
}

export async function recordPropertyActivityWithPolicy(
  propertyId: string,
  input: PropertyActivityInput,
): Promise<void> {
  await apiClient.post(API_ROUTES.PROPERTIES.ACTIVITY(propertyId), input);
}
