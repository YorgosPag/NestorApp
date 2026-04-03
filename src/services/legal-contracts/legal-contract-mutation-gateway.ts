import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  ContractStatus,
  CreateContractInput,
  LegalContract,
  LegalProfessionalRole,
} from '@/types/legal-contracts';

interface GatewayActionResult {
  success: boolean;
  error?: string;
}

export async function createLegalContractWithPolicy(
  input: CreateContractInput,
): Promise<{ success: boolean; data?: LegalContract; error?: string }> {
  return apiClient.post<{ success: boolean; data?: LegalContract; error?: string }>(
    API_ROUTES.CONTRACTS.LIST,
    input,
  );
}

export async function transitionLegalContractStatusWithPolicy(
  contractId: string,
  targetStatus: ContractStatus,
): Promise<GatewayActionResult> {
  return apiClient.post<GatewayActionResult>(
    API_ROUTES.CONTRACTS.TRANSITION(contractId),
    { targetStatus },
  );
}

export async function updateLegalContractWithPolicy(
  contractId: string,
  updates: Record<string, unknown>,
): Promise<GatewayActionResult> {
  return apiClient.patch<GatewayActionResult>(
    API_ROUTES.CONTRACTS.BY_ID(contractId),
    updates,
  );
}

export async function overrideLegalProfessionalWithPolicy(
  contractId: string,
  role: LegalProfessionalRole,
  contactId: string | null,
): Promise<GatewayActionResult> {
  return apiClient.patch<GatewayActionResult>(
    API_ROUTES.CONTRACTS.PROFESSIONALS(contractId),
    { role, contactId },
  );
}
