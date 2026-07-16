/**
 * Wiring lock for the six impact-guard bindings (ADR-307 / ADR-584).
 *
 * After the merge onto `useProjectImpactGuard`, each sibling hook is only a
 * binding: a scope, an endpoint, and a public method name. That binding is
 * exactly what a copy-paste merge gets silently wrong — a guard pointed at the
 * wrong endpoint still compiles, still renders, and previews the wrong mutation.
 * So the endpoint and the method name are asserted per hook, by name.
 */
import { act, renderHook } from '@testing-library/react';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useProjectBrokerTerminateImpactGuard } from '../../useProjectBrokerTerminateImpactGuard';
import { useProjectEngineerRemoveImpactGuard } from '../../useProjectEngineerRemoveImpactGuard';
import { useProjectLandownersSaveImpactGuard } from '../../useProjectLandownersSaveImpactGuard';
import { useProjectOwnershipMutationImpactGuard } from '../../useProjectOwnershipMutationImpactGuard';
import { useProjectMutationImpactGuard } from '../../useProjectMutationImpactGuard';
import { useIkaLaborComplianceSaveImpactGuard } from '../../useIkaLaborComplianceSaveImpactGuard';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  ApiClientError: {
    isApiClientError: (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/components/projects/dialogs/ProjectMutationImpactDialog', () => ({
  ProjectMutationImpactDialog: () => null,
}));

const mockedPost = apiClient.post as jest.Mock;
const PROJECT_ID = 'prj_1';

const ALLOW: ProjectMutationImpactPreview = {
  mode: 'allow',
  mutationKinds: [],
  changes: [],
  dependencies: [],
  companyLinkChange: 'none',
  messageKey: 'impactGuard.messages.allow',
  blockingCount: 0,
  warningCount: 0,
};

const REQUEST = { agreementId: 'agr_1' };

/** The public surface every project guard exposes, keyed by its own method name. */
type GuardApi = Record<string, unknown> & { readonly checking: boolean; readonly reset: () => void };

interface Binding {
  readonly name: string;
  readonly endpoint: string;
  /** The public method name this hook is contractually required to keep. */
  readonly method: string;
  /** Renders the hook, returning its live result object. */
  readonly render: () => { readonly current: GuardApi };
}

const BINDINGS: readonly Binding[] = [
  {
    name: 'useProjectBrokerTerminateImpactGuard',
    endpoint: '/api/projects/prj_1/broker-terminate-preview',
    method: 'previewBeforeTerminate',
    render: () => renderHook(() => useProjectBrokerTerminateImpactGuard(PROJECT_ID)).result,
  },
  {
    name: 'useProjectEngineerRemoveImpactGuard',
    endpoint: '/api/projects/prj_1/engineer-impact-preview',
    method: 'previewBeforeRemove',
    render: () => renderHook(() => useProjectEngineerRemoveImpactGuard(PROJECT_ID)).result,
  },
  {
    name: 'useProjectLandownersSaveImpactGuard',
    endpoint: '/api/projects/prj_1/landowners-save-preview',
    method: 'previewBeforeSave',
    render: () => renderHook(() => useProjectLandownersSaveImpactGuard(PROJECT_ID)).result,
  },
  {
    name: 'useProjectOwnershipMutationImpactGuard',
    endpoint: '/api/projects/prj_1/ownership-impact-preview',
    method: 'previewBeforeMutate',
    render: () => renderHook(() => useProjectOwnershipMutationImpactGuard(PROJECT_ID)).result,
  },
  {
    name: 'useProjectMutationImpactGuard',
    endpoint: '/api/projects/prj_1/impact-preview',
    method: 'previewBeforeMutate',
    render: () => renderHook(() => useProjectMutationImpactGuard(PROJECT_ID)).result,
  },
];

type PreviewMethod = (req: typeof REQUEST, action: () => Promise<void>) => Promise<boolean>;

/** Renders the binding and calls its own preview method, whatever it is named. */
async function runBinding(binding: Binding, action: () => Promise<void>): Promise<void> {
  const result = binding.render();
  const preview = result.current[binding.method] as PreviewMethod;
  await act(async () => { await preview(REQUEST, action); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedPost.mockResolvedValue(ALLOW);
});

describe.each(BINDINGS)('$name', (binding) => {
  it(`posts to ${binding.endpoint} — and to nothing else`, async () => {
    await runBinding(binding, jest.fn().mockResolvedValue(undefined));
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith(binding.endpoint, REQUEST);
  });

  it(`still exposes its own method name: ${binding.method}`, () => {
    expect(binding.render().current).toEqual(
      expect.objectContaining({
        [binding.method]: expect.any(Function),
        checking: false,
        reset: expect.any(Function),
      }),
    );
  });

  it('allow → runs the caller action', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    await runBinding(binding, action);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('the six endpoints are distinct — no two guards share a route', () => {
  it('has no duplicate endpoint among the bindings', () => {
    const endpoints = BINDINGS.map((b) => b.endpoint);
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });
});

describe('useIkaLaborComplianceSaveImpactGuard — the one with no request body', () => {
  it('posts an empty body to the fixed IKA route, taking only an action', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useIkaLaborComplianceSaveImpactGuard());

    await act(async () => { await result.current.previewBeforeSave(action); });

    expect(mockedPost).toHaveBeenCalledWith('/api/ika/labor-compliance-save-preview', {});
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('keeps previewBeforeSave stable across renders', () => {
    const { result, rerender } = renderHook(() => useIkaLaborComplianceSaveImpactGuard());
    const first = result.current.previewBeforeSave;
    rerender();
    expect(result.current.previewBeforeSave).toBe(first);
  });
});
