/**
 * Characterization + wiring lock for the four gateway-action data hooks
 * (ADR-230 / ADR-234 / ADR-584).
 *
 * Written against the PRE-merge hooks and kept byte-identical across the merge
 * onto `runGatewayAction`. That is the whole point: none of these four hooks had
 * a single test, so "behaviour did not change" would otherwise be an
 * unfalsifiable claim.
 *
 * What a copy-paste merge gets silently wrong is the binding, not the engine: a
 * hook wired to the wrong gateway function still compiles and still renders, it
 * just mutates the wrong record. So every action is asserted by name against the
 * gateway call it must make, with the arguments it must forward.
 *
 * The four axes that actually differ between the 23 actions are each locked:
 *   - which gateway function, and the exact argument forwarding
 *   - the propertyId guard (present + its message, or deliberately absent)
 *   - refetch discipline: awaited, versus handed to clientSafeFireAndForget
 *   - result mapping: passthrough on success, on gateway-false, and on throw
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import * as financeGateway from '@/services/property-finance/property-finance-mutation-gateway';
import * as legalGateway from '@/services/legal-contracts/legal-contract-mutation-gateway';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';
import { usePaymentPlan } from '../usePaymentPlan';
import { useChequeRegistry } from '../useChequeRegistry';
import { useLoanTracking } from '../useLoanTracking';
import { useLegalContracts } from '../useLegalContracts';

jest.mock('@/services/property-finance/property-finance-mutation-gateway', () => ({
  addPaymentInstallmentWithPolicy: jest.fn(),
  createPaymentPlanWithPolicy: jest.fn(),
  createSplitPaymentPlansWithPolicy: jest.fn(),
  deletePaymentPlanWithPolicy: jest.fn(),
  recordPropertyPaymentWithPolicy: jest.fn(),
  removePaymentInstallmentWithPolicy: jest.fn(),
  updatePaymentInstallmentWithPolicy: jest.fn(),
  updatePaymentPlanLoanInfoWithPolicy: jest.fn(),
  updatePaymentPlanWithPolicy: jest.fn(),
  bouncePropertyChequeWithPolicy: jest.fn(),
  createPropertyChequeWithPolicy: jest.fn(),
  endorsePropertyChequeWithPolicy: jest.fn(),
  transitionPropertyChequeWithPolicy: jest.fn(),
  updatePropertyChequeWithPolicy: jest.fn(),
  addLoanCommunicationLogWithPolicy: jest.fn(),
  createPropertyLoanWithPolicy: jest.fn(),
  recordLoanDisbursementWithPolicy: jest.fn(),
  transitionPropertyLoanWithPolicy: jest.fn(),
  updatePropertyLoanWithPolicy: jest.fn(),
}));

jest.mock('@/services/legal-contracts/legal-contract-mutation-gateway', () => ({
  createLegalContractWithPolicy: jest.fn(),
  overrideLegalProfessionalWithPolicy: jest.fn(),
  transitionLegalContractStatusWithPolicy: jest.fn(),
  updateLegalContractWithPolicy: jest.fn(),
}));

jest.mock('@/lib/safe-fire-and-forget', () => ({
  clientSafeFireAndForget: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

// Stable identities: the real hooks serve these from context, so they must not
// hand back a fresh object per render — that would retrigger the mount fetch
// effect forever and the loop would look like a product bug rather than a mock.
const mockCompanyIdValue = { companyId: 'co_1' } as const;
jest.mock('@/hooks/useCompanyId', () => ({
  useCompanyId: () => mockCompanyIdValue,
}));

const mockUnsubscribe = jest.fn();
const mockFirestoreSubscribe = jest.fn(() => mockUnsubscribe);
// Dereferenced lazily: `jest.mock` is hoisted above these consts, so a factory
// that captured the object directly would evaluate it in the TDZ.
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (...args: readonly unknown[]) => mockFirestoreSubscribe(...(args as [])),
  },
}));

jest.mock('firebase/firestore', () => ({
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

const mockedFireAndForget = clientSafeFireAndForget as jest.Mock;

const PROPERTY_ID = 'prop_1';

/**
 * `background` means the action hands the refetch promise to
 * clientSafeFireAndForget and returns without awaiting it; `awaited` means a
 * failed refetch is allowed to delay (but never mask) the action result.
 */
type RefetchMode = 'awaited' | 'background';

interface ActionSpec {
  /** Key of the action on the hook's return value. */
  readonly action: string;
  /** Gateway function this action must call — the binding a merge gets wrong. */
  readonly gateway: keyof typeof financeGateway | keyof typeof legalGateway;
  /** Arguments the caller passes to the action. */
  readonly callArgs: readonly unknown[];
  /** Arguments the gateway must receive — locks the propertyId/id forwarding. */
  readonly gatewayArgs: readonly unknown[];
  readonly refetch: RefetchMode;
  /** Fire-and-forget label, asserted only for `background` actions. */
  readonly label?: string;
  /**
   * Guard message returned when the hook has no propertyId, or `null` where the
   * hook deliberately has no guard (legal contracts are scoped by contractId,
   * not by property).
   */
  readonly guardError: string | null;
}

interface HookSpec {
  readonly name: string;
  readonly hook: (propertyId: string | null) => Record<string, unknown>;
  readonly gatewayModule: Record<string, unknown>;
  /** URL the mount effect must GET, and the response key it reads. */
  readonly listUrls: readonly string[];
  readonly actions: readonly ActionSpec[];
}

const PAYMENT_PLAN_ACTIONS: readonly ActionSpec[] = [
  {
    action: 'createPlan',
    gateway: 'createPaymentPlanWithPolicy',
    callArgs: [{ totalAmount: 100 }],
    gatewayArgs: [PROPERTY_ID, { totalAmount: 100 }],
    refetch: 'background',
    label: 'PaymentPlan.refetch',
    guardError: 'No property selected',
  },
  {
    action: 'createSplitPlans',
    gateway: 'createSplitPaymentPlansWithPolicy',
    callArgs: [{ owners: [], planType: 'individual' }],
    gatewayArgs: [PROPERTY_ID, { owners: [], planType: 'individual' }],
    refetch: 'background',
    label: 'PaymentPlan.refetchAfterSplit',
    guardError: 'No property selected',
  },
  {
    action: 'updatePlan',
    gateway: 'updatePaymentPlanWithPolicy',
    callArgs: ['pp_1', { totalAmount: 200 }],
    gatewayArgs: [PROPERTY_ID, 'pp_1', { totalAmount: 200 }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'recordPayment',
    gateway: 'recordPropertyPaymentWithPolicy',
    callArgs: [{ amount: 50 }],
    gatewayArgs: [PROPERTY_ID, { amount: 50 }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'addInstallment',
    gateway: 'addPaymentInstallmentWithPolicy',
    callArgs: ['pp_1', { amount: 10 }, 2],
    gatewayArgs: [PROPERTY_ID, 'pp_1', { amount: 10 }, 2],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'updateInstallment',
    gateway: 'updatePaymentInstallmentWithPolicy',
    callArgs: ['pp_1', 3, { amount: 11 }],
    gatewayArgs: [PROPERTY_ID, 'pp_1', 3, { amount: 11 }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'removeInstallment',
    gateway: 'removePaymentInstallmentWithPolicy',
    callArgs: ['pp_1', 4],
    gatewayArgs: [PROPERTY_ID, 'pp_1', 4],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'updateLoan',
    gateway: 'updatePaymentPlanLoanInfoWithPolicy',
    callArgs: ['pp_1', { bankName: 'X' }],
    gatewayArgs: [PROPERTY_ID, 'pp_1', { bankName: 'X' }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'deletePlan',
    gateway: 'deletePaymentPlanWithPolicy',
    callArgs: ['pp_1'],
    gatewayArgs: [PROPERTY_ID, 'pp_1'],
    refetch: 'awaited',
    // Changed on purpose by the merge — see the dedicated test below. Pre-merge
    // this was the only one of the nine without a guard.
    guardError: 'No property selected',
  },
];

const CHEQUE_ACTIONS: readonly ActionSpec[] = [
  {
    action: 'createCheque',
    gateway: 'createPropertyChequeWithPolicy',
    callArgs: [{ amount: 10 }],
    gatewayArgs: [PROPERTY_ID, { amount: 10 }],
    refetch: 'background',
    label: 'ChequeRegistry.refetch',
    guardError: 'No property selected',
  },
  {
    action: 'updateCheque',
    gateway: 'updatePropertyChequeWithPolicy',
    callArgs: ['chq_1', { amount: 20 }],
    gatewayArgs: [PROPERTY_ID, 'chq_1', { amount: 20 }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'transitionStatus',
    gateway: 'transitionPropertyChequeWithPolicy',
    callArgs: ['chq_1', { to: 'cleared' }],
    gatewayArgs: [PROPERTY_ID, 'chq_1', { to: 'cleared' }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'endorseCheque',
    gateway: 'endorsePropertyChequeWithPolicy',
    callArgs: ['chq_1', { to: 'c_9' }],
    gatewayArgs: [PROPERTY_ID, 'chq_1', { to: 'c_9' }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
  {
    action: 'bounceCheque',
    gateway: 'bouncePropertyChequeWithPolicy',
    callArgs: ['chq_1', { reason: 'nsf' }],
    gatewayArgs: [PROPERTY_ID, 'chq_1', { reason: 'nsf' }],
    refetch: 'awaited',
    guardError: 'No property selected',
  },
];

const LOAN_ACTIONS: readonly ActionSpec[] = [
  {
    action: 'addLoan',
    gateway: 'createPropertyLoanWithPolicy',
    callArgs: [{ bankName: 'A' }],
    gatewayArgs: [PROPERTY_ID, { bankName: 'A' }],
    refetch: 'background',
    label: 'LoanTracking.refetch',
    // Deliberate: this hook says "unit", its siblings say "property".
    guardError: 'No unit selected',
  },
  {
    action: 'updateLoan',
    gateway: 'updatePropertyLoanWithPolicy',
    callArgs: ['loan_1', { bankName: 'B' }],
    gatewayArgs: [PROPERTY_ID, 'loan_1', { bankName: 'B' }],
    refetch: 'awaited',
    guardError: 'No unit selected',
  },
  {
    action: 'transitionStatus',
    gateway: 'transitionPropertyLoanWithPolicy',
    callArgs: ['loan_1', { to: 'approved' }],
    gatewayArgs: [PROPERTY_ID, 'loan_1', { to: 'approved' }],
    refetch: 'awaited',
    guardError: 'No unit selected',
  },
  {
    action: 'recordDisbursement',
    gateway: 'recordLoanDisbursementWithPolicy',
    callArgs: ['loan_1', { amount: 5 }],
    gatewayArgs: [PROPERTY_ID, 'loan_1', { amount: 5 }],
    refetch: 'awaited',
    guardError: 'No unit selected',
  },
  {
    action: 'addCommLog',
    gateway: 'addLoanCommunicationLogWithPolicy',
    callArgs: ['loan_1', { note: 'n' }],
    gatewayArgs: [PROPERTY_ID, 'loan_1', { note: 'n' }],
    refetch: 'awaited',
    guardError: 'No unit selected',
  },
];

const LEGAL_ACTIONS: readonly ActionSpec[] = [
  {
    action: 'createContract',
    gateway: 'createLegalContractWithPolicy',
    callArgs: [{ propertyId: PROPERTY_ID }],
    gatewayArgs: [{ propertyId: PROPERTY_ID }],
    refetch: 'background',
    label: 'LegalContracts.refetch',
    guardError: null,
  },
  {
    action: 'transitionStatus',
    gateway: 'transitionLegalContractStatusWithPolicy',
    callArgs: ['ct_1', 'signed'],
    gatewayArgs: ['ct_1', 'signed'],
    refetch: 'awaited',
    guardError: null,
  },
  {
    action: 'updateContract',
    gateway: 'updateLegalContractWithPolicy',
    callArgs: ['ct_1', { note: 'n' }],
    gatewayArgs: ['ct_1', { note: 'n' }],
    refetch: 'awaited',
    guardError: null,
  },
  {
    action: 'overrideProfessional',
    gateway: 'overrideLegalProfessionalWithPolicy',
    callArgs: ['ct_1', 'notary', 'c_2'],
    gatewayArgs: ['ct_1', 'notary', 'c_2'],
    refetch: 'awaited',
    guardError: null,
  },
];

const HOOKS: readonly HookSpec[] = [
  {
    name: 'usePaymentPlan',
    hook: usePaymentPlan as unknown as HookSpec['hook'],
    gatewayModule: financeGateway as unknown as Record<string, unknown>,
    listUrls: [
      `/api/properties/${PROPERTY_ID}/payment-plan`,
      `/api/properties/${PROPERTY_ID}/payments`,
    ],
    actions: PAYMENT_PLAN_ACTIONS,
  },
  {
    name: 'useChequeRegistry',
    hook: useChequeRegistry as unknown as HookSpec['hook'],
    gatewayModule: financeGateway as unknown as Record<string, unknown>,
    listUrls: [`/api/properties/${PROPERTY_ID}/cheques`],
    actions: CHEQUE_ACTIONS,
  },
  {
    name: 'useLoanTracking',
    hook: useLoanTracking as unknown as HookSpec['hook'],
    gatewayModule: financeGateway as unknown as Record<string, unknown>,
    listUrls: [`/api/properties/${PROPERTY_ID}/payment-plan/loans`],
    actions: LOAN_ACTIONS,
  },
  {
    name: 'useLegalContracts',
    hook: useLegalContracts as unknown as HookSpec['hook'],
    gatewayModule: legalGateway as unknown as Record<string, unknown>,
    listUrls: [`/api/contracts?propertyId=${PROPERTY_ID}`],
    actions: LEGAL_ACTIONS,
  },
];

function mockFetchOk(): jest.Mock {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [] }),
  }));
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

/** Mount and let the mount-effect fetch settle, so later fetches are refetches. */
async function mountSettled(spec: HookSpec, propertyId: string | null = PROPERTY_ID) {
  const rendered = renderHook(() => spec.hook(propertyId));
  await waitFor(() => {
    expect(rendered.result.current.isLoading).toBe(false);
  });
  return rendered;
}

function gatewayMock(spec: HookSpec, action: ActionSpec): jest.Mock {
  return spec.gatewayModule[action.gateway as string] as jest.Mock;
}

async function callAction(
  result: { current: Record<string, unknown> },
  action: ActionSpec,
): Promise<{ success: boolean; error?: string }> {
  let outcome: { success: boolean; error?: string } = { success: false };
  await act(async () => {
    const fn = result.current[action.action] as (
      ...args: readonly unknown[]
    ) => Promise<{ success: boolean; error?: string }>;
    outcome = await fn(...action.callArgs);
  });
  return outcome;
}

describe('gateway-action data hooks — characterization', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = mockFetchOk();
  });

  describe.each(HOOKS.map((h) => [h.name, h] as const))('%s', (_name, spec) => {
    it('fetches its list on mount, from its own route', async () => {
      await mountSettled(spec);

      const urls = fetchMock.mock.calls.map((call) => call[0] as string);
      expect(urls).toEqual(expect.arrayContaining([...spec.listUrls]));
      expect(urls).toHaveLength(spec.listUrls.length);
    });

    it('does not fetch without a propertyId', async () => {
      renderHook(() => spec.hook(null));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exposes every action of its contract as a function', async () => {
      const { result } = await mountSettled(spec);
      for (const action of spec.actions) {
        expect(typeof result.current[action.action]).toBe('function');
      }
    });

    describe.each(spec.actions.map((a) => [a.action, a] as const))('%s', (_action, action) => {
      it('calls its own gateway with the forwarded arguments', async () => {
        const mock = gatewayMock(spec, action);
        mock.mockResolvedValue({ success: true });
        const { result } = await mountSettled(spec);

        await callAction(result, action);

        expect(mock).toHaveBeenCalledTimes(1);
        expect(mock).toHaveBeenCalledWith(...action.gatewayArgs);
      });

      it('returns the gateway result on success', async () => {
        gatewayMock(spec, action).mockResolvedValue({ success: true });
        const { result } = await mountSettled(spec);

        const outcome = await callAction(result, action);

        expect(outcome).toEqual({ success: true, error: undefined });
      });

      it('passes a gateway refusal through untouched', async () => {
        gatewayMock(spec, action).mockResolvedValue({ success: false, error: 'V-001 violated' });
        const { result } = await mountSettled(spec);

        const outcome = await callAction(result, action);

        expect(outcome).toEqual({ success: false, error: 'V-001 violated' });
      });

      it('maps a thrown gateway error onto the result instead of propagating', async () => {
        gatewayMock(spec, action).mockRejectedValue(new Error('HTTP 500'));
        const { result } = await mountSettled(spec);

        const outcome = await callAction(result, action);

        expect(outcome).toEqual({ success: false, error: 'HTTP 500' });
      });

      it('does not refetch when the gateway refuses', async () => {
        gatewayMock(spec, action).mockResolvedValue({ success: false, error: 'nope' });
        const { result } = await mountSettled(spec);
        const fetchesAfterMount = fetchMock.mock.calls.length;

        await callAction(result, action);

        expect(fetchMock.mock.calls).toHaveLength(fetchesAfterMount);
        expect(mockedFireAndForget).not.toHaveBeenCalled();
      });

      if (action.refetch === 'background') {
        it('hands the refetch to clientSafeFireAndForget under its own label', async () => {
          gatewayMock(spec, action).mockResolvedValue({ success: true });
          const { result } = await mountSettled(spec);

          await callAction(result, action);

          expect(mockedFireAndForget).toHaveBeenCalledTimes(1);
          expect(mockedFireAndForget).toHaveBeenCalledWith(expect.any(Promise), action.label);
        });
      } else {
        it('awaits the refetch rather than firing it off', async () => {
          gatewayMock(spec, action).mockResolvedValue({ success: true });
          const { result } = await mountSettled(spec);
          const fetchesAfterMount = fetchMock.mock.calls.length;

          await callAction(result, action);

          expect(mockedFireAndForget).not.toHaveBeenCalled();
          expect(fetchMock.mock.calls.length).toBeGreaterThan(fetchesAfterMount);
        });
      }

      if (action.guardError !== null) {
        it('refuses without a propertyId, before reaching the gateway', async () => {
          const { result } = renderHook(() => spec.hook(null));

          const outcome = await callAction(result, action);

          expect(outcome).toEqual({ success: false, error: action.guardError });
          expect(gatewayMock(spec, action)).not.toHaveBeenCalled();
        });
      }
    });
  });
});

/**
 * The one deliberate behaviour change of the merge, kept in its own block so it
 * cannot be mistaken for characterization.
 *
 * Pre-merge, `deletePlan` was the only one of the nine actions with no guard: it
 * forwarded `propertyId!` and reached the gateway with a literal null, which the
 * route then read as part of its path. Its eight siblings — including
 * `updatePlan`, written directly above it — all refuse first. There is no ADR or
 * caller that wants a null-scoped delete, so this is a copy-paste omission, not
 * an intent, and the merge closes it rather than encoding it as an option.
 */
describe('usePaymentPlan.deletePlan — guard gap closed by the merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOk();
  });

  it('no longer reaches the gateway with a null propertyId', async () => {
    const mock = financeGateway.deletePaymentPlanWithPolicy as jest.Mock;
    mock.mockResolvedValue({ success: true });
    const { result } = renderHook(() => usePaymentPlan(null));

    let outcome: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      outcome = await result.current.deletePlan('pp_1');
    });

    expect(mock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ success: false, error: 'No property selected' });
  });
});
