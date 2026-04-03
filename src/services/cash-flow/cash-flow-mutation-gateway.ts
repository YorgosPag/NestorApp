import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  CashFlowConfig,
  RecurringPayment,
} from '@/services/cash-flow/cash-flow.types';

interface CashFlowConfigUpdateInput {
  initialBalance: CashFlowConfig['initialBalance'];
  recurringPayments: RecurringPayment[];
}

export async function updateCashFlowConfigWithPolicy(
  input: CashFlowConfigUpdateInput,
): Promise<void> {
  await apiClient.put('/api/reports/cash-flow', input);
}
