import { API_ROUTES } from '@/config/domain-constants';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';
import type {
  CreatePaymentPlanInput,
  CreateSplitPlansInput,
  UpdatePaymentPlanInput,
  CreatePaymentInput,
  CreateInstallmentInput,
  UpdateInstallmentInput,
  LoanInfo,
} from '@/types/payment-plan';
import type {
  AddCommunicationLogInput,
  CreateLoanInput,
  LoanTransitionInput,
  RecordDisbursementInput,
  UpdateLoanInput,
} from '@/types/loan-tracking';
import type {
  BounceInput,
  ChequeTransitionInput,
  CreateChequeInput,
  EndorseInput,
  UpdateChequeInput,
} from '@/types/cheque-registry';

interface GatewayActionResult {
  success: boolean;
  error?: string;
}

export async function createPaymentPlanWithPolicy(
  propertyId: string,
  input: Omit<CreatePaymentPlanInput, 'propertyId'>,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.PAYMENT_PLAN(propertyId),
    jsonRequest('POST', input),
  );
}

export async function createSplitPaymentPlansWithPolicy(
  propertyId: string,
  input: CreateSplitPlansInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.PAYMENT_PLAN(propertyId),
    jsonRequest('POST', input),
  );
}

export async function updatePaymentPlanWithPolicy(
  propertyId: string,
  planId: string,
  updates: UpdatePaymentPlanInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.PAYMENT_PLAN(propertyId),
    jsonRequest('PATCH', { planId, ...updates }),
  );
}

export async function deletePaymentPlanWithPolicy(
  propertyId: string,
  planId: string,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.PAYMENT_PLAN(propertyId)}?planId=${encodeURIComponent(planId)}`,
    { method: 'DELETE' },
  );
}

export async function recordPropertyPaymentWithPolicy(
  propertyId: string,
  input: CreatePaymentInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.PAYMENTS(propertyId),
    jsonRequest('POST', input),
  );
}

export async function addPaymentInstallmentWithPolicy(
  propertyId: string,
  planId: string,
  installment: CreateInstallmentInput,
  insertAtIndex?: number,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.INSTALLMENTS(propertyId),
    jsonRequest('POST', { planId, installment, insertAtIndex }),
  );
}

export async function updatePaymentInstallmentWithPolicy(
  propertyId: string,
  planId: string,
  index: number,
  updates: UpdateInstallmentInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.INSTALLMENTS(propertyId),
    jsonRequest('PATCH', { planId, index, updates }),
  );
}

export async function removePaymentInstallmentWithPolicy(
  propertyId: string,
  planId: string,
  index: number,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.INSTALLMENTS(propertyId),
    jsonRequest('DELETE', { planId, index }),
  );
}

export async function updatePaymentPlanLoanInfoWithPolicy(
  propertyId: string,
  planId: string,
  loan: Partial<LoanInfo>,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.LOAN(propertyId),
    jsonRequest('PATCH', { planId, ...loan }),
  );
}

export async function createPropertyLoanWithPolicy(
  propertyId: string,
  input: CreateLoanInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.LOANS(propertyId),
    jsonRequest('POST', input),
  );
}

export async function updatePropertyLoanWithPolicy(
  propertyId: string,
  loanId: string,
  input: UpdateLoanInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.LOANS(propertyId)}/${loanId}`,
    jsonRequest('PATCH', input),
  );
}

export async function transitionPropertyLoanWithPolicy(
  propertyId: string,
  loanId: string,
  input: LoanTransitionInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.LOANS(propertyId)}/${loanId}/transition`,
    jsonRequest('POST', input),
  );
}

export async function recordLoanDisbursementWithPolicy(
  propertyId: string,
  loanId: string,
  input: RecordDisbursementInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.LOANS(propertyId)}/${loanId}/disburse`,
    jsonRequest('POST', input),
  );
}

export async function addLoanCommunicationLogWithPolicy(
  propertyId: string,
  loanId: string,
  input: AddCommunicationLogInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.LOANS(propertyId)}/${loanId}/comm-log`,
    jsonRequest('POST', input),
  );
}

export async function createPropertyChequeWithPolicy(
  propertyId: string,
  input: CreateChequeInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    API_ROUTES.PROPERTIES.CHEQUES(propertyId),
    jsonRequest('POST', input),
  );
}

export async function updatePropertyChequeWithPolicy(
  propertyId: string,
  chequeId: string,
  input: UpdateChequeInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.CHEQUES(propertyId)}/${chequeId}`,
    jsonRequest('PATCH', input),
  );
}

export async function transitionPropertyChequeWithPolicy(
  propertyId: string,
  chequeId: string,
  input: ChequeTransitionInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.CHEQUES(propertyId)}/${chequeId}/transition`,
    jsonRequest('POST', input),
  );
}

export async function endorsePropertyChequeWithPolicy(
  propertyId: string,
  chequeId: string,
  input: EndorseInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.CHEQUES(propertyId)}/${chequeId}/endorse`,
    jsonRequest('POST', input),
  );
}

export async function bouncePropertyChequeWithPolicy(
  propertyId: string,
  chequeId: string,
  input: BounceInput,
): Promise<GatewayActionResult> {
  return fetchJson<GatewayActionResult>(
    `${API_ROUTES.PROPERTIES.CHEQUES(propertyId)}/${chequeId}/bounce`,
    jsonRequest('POST', input),
  );
}
