import { API_ROUTES } from '@/config/domain-constants';
import type { DebtMaturityFormData } from '@/components/sales/financial-intelligence/DebtMaturityWall';

interface FinancialIntelligenceActionResult {
  success: boolean;
  error?: string;
}

interface BudgetVarianceSaveInput {
  projectId: string;
  projectName: string;
  categories: Array<{
    category: string;
    categoryKey: string;
    budgetAmount: number;
    actualAmount: number;
  }>;
}

function jsonRequest(method: 'POST' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function mutateJson<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function addDebtMaturityEntryWithPolicy(
  data: DebtMaturityFormData,
): Promise<FinancialIntelligenceActionResult> {
  return mutateJson<FinancialIntelligenceActionResult>(
    API_ROUTES.FINANCIAL_INTELLIGENCE.DEBT_MATURITY,
    jsonRequest('POST', data),
  );
}

export async function removeDebtMaturityEntryWithPolicy(
  loanId: string,
): Promise<FinancialIntelligenceActionResult> {
  return mutateJson<FinancialIntelligenceActionResult>(
    `${API_ROUTES.FINANCIAL_INTELLIGENCE.DEBT_MATURITY}?loanId=${encodeURIComponent(loanId)}`,
    jsonRequest('DELETE'),
  );
}

export async function saveBudgetVarianceWithPolicy(
  data: BudgetVarianceSaveInput,
): Promise<FinancialIntelligenceActionResult> {
  return mutateJson<FinancialIntelligenceActionResult>(
    API_ROUTES.FINANCIAL_INTELLIGENCE.BUDGET_VARIANCE,
    jsonRequest('POST', data),
  );
}
