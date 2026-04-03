'use client';

import { BrokerageService } from '@/services/brokerage.service';
import type { BrokerageAgreement, CreateBrokerageAgreementInput, ExclusivityValidationResult } from '@/types/brokerage';

interface CreateBrokerageAgreementWithPolicyInput {
  readonly input: CreateBrokerageAgreementInput;
  readonly createdBy: string;
}

interface UpdateBrokerageAgreementWithPolicyInput {
  readonly id: string;
  readonly updates: Partial<Pick<
    BrokerageAgreement,
    'exclusivity' | 'commissionType' | 'commissionPercentage' |
    'commissionFixedAmount' | 'startDate' | 'endDate' | 'notes' | 'scope' | 'propertyId'
  >>;
  readonly updatedBy: string;
}

interface TerminateBrokerageAgreementWithPolicyInput {
  readonly id: string;
  readonly updatedBy: string;
}

export async function createBrokerageAgreementWithPolicy({
  input,
  createdBy,
}: CreateBrokerageAgreementWithPolicyInput): Promise<{
  success: boolean;
  id?: string;
  error?: string;
  validation?: ExclusivityValidationResult;
}> {
  return BrokerageService.createAgreement(input, createdBy);
}

export async function updateBrokerageAgreementWithPolicy({
  id,
  updates,
  updatedBy,
}: UpdateBrokerageAgreementWithPolicyInput): Promise<{
  success: boolean;
  error?: string;
  validation?: ExclusivityValidationResult;
}> {
  return BrokerageService.updateAgreement(id, updates, updatedBy);
}

export async function terminateBrokerageAgreementWithPolicy({
  id,
  updatedBy,
}: TerminateBrokerageAgreementWithPolicyInput): Promise<{
  success: boolean;
  error?: string;
}> {
  return BrokerageService.terminateAgreement(id, updatedBy);
}
