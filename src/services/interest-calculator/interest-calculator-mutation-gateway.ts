import { API_ROUTES } from '@/config/domain-constants';
import type {
  BankSpreadConfig,
  BankSpreadsResponse,
  CostCalculationRequest,
  CostCalculationResponse,
  EuriborRatesResponse,
} from '@/types/interest-calculator';

async function mutateJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(text);
  }

  return response.json() as Promise<T>;
}

export async function refreshEuriborRatesWithPolicy(): Promise<EuriborRatesResponse> {
  return mutateJson<EuriborRatesResponse>(API_ROUTES.EURIBOR.REFRESH, {
    method: 'POST',
  });
}

export async function calculateInterestCostWithPolicy(
  input: CostCalculationRequest,
): Promise<CostCalculationResponse> {
  return mutateJson<CostCalculationResponse>(API_ROUTES.CALCULATOR.COST, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBankSpreadsWithPolicy(
  config: BankSpreadConfig,
): Promise<BankSpreadsResponse> {
  return mutateJson<BankSpreadsResponse>(API_ROUTES.SETTINGS.BANK_SPREADS, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}
