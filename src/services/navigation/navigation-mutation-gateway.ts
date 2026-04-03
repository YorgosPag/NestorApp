import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';

interface NavigationCompanyCreateInput {
  contactId: string;
}

export async function addNavigationCompanyWithPolicy(
  input: NavigationCompanyCreateInput,
): Promise<void> {
  await apiClient.post(API_ROUTES.NAVIGATION.COMPANY, input);
}
