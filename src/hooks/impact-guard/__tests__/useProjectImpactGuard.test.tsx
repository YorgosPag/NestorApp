/**
 * Behaviour lock for the shared impact-guard state machine (ADR-307 / ADR-584 / ADR-664).
 *
 * These assertions were transcribed from the SIX pre-merge sibling hooks
 * (broker-terminate / engineer-remove / landowners-save / ownership-mutation /
 * project-mutation / ika-labor-compliance-save), which had no tests of their own.
 * They exist to prove the merge preserved each behaviour rather than assume it.
 *
 * 🔗 ADR-777 §8.69.13 — `previewBefore` now resolves a named `GuardResult` AFTER the
 * decision and the action (it used to resolve `false` before the dialog was even
 * answered). The state machine's own anchors live in `useImpactDecision.test.tsx`;
 * these keep the project binding honest (endpoint, dialog, onBlockDismiss, INP).
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { GuardResult } from '../guard-result';
import { useProjectImpactGuard, buildUnavailableProjectImpactPreview } from '../useProjectImpactGuard';

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
  ProjectMutationImpactDialog: ({
    open,
    preview,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    preview: ProjectMutationImpactPreview | null;
    onConfirm: () => void;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="impact-dialog" data-mode={preview?.mode ?? 'none'}>
        <span data-testid="message-key">{preview?.messageKey ?? 'no-message'}</span>
        <button type="button" onClick={onConfirm}>confirm</button>
        <button type="button" onClick={() => onOpenChange(false)}>dismiss</button>
      </div>
    ) : null,
}));

const mockedPost = apiClient.post as jest.Mock;
const ENDPOINT = '/api/projects/prj_1/impact-preview';

function makePreview(mode: ProjectMutationImpactPreview['mode']): ProjectMutationImpactPreview {
  return {
    mode,
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: `impactGuard.messages.${mode}`,
    blockingCount: mode === 'block' ? 1 : 0,
    warningCount: mode === 'warn' ? 1 : 0,
  };
}

/** Renders the hook and also mounts its ImpactDialog, so dialog interaction is real. */
function renderGuard(options?: { onBlockDismiss?: () => void }) {
  const view = renderHook(() =>
    useProjectImpactGuard<{ agreementId: string }>('testScope', ENDPOINT, options),
  );
  const dialog = render(<>{view.result.current.ImpactDialog}</>);
  const rerenderDialog = () => dialog.rerender(<>{view.result.current.ImpactDialog}</>);
  return { ...view, rerenderDialog };
}

type GuardHook = ReturnType<typeof renderGuard>['result'];

/**
 * Starts the guard and lets the preview answer — WITHOUT waiting for the outcome.
 *
 * ⚠️ The pending promise travels INSIDE an object: an `async` function that returns a promise
 * directly gets it flattened by `await`, and a `warn` test would then hang on the decision.
 */
async function start(
  result: GuardHook,
  action: () => Promise<void>,
  request = { agreementId: 'a1' },
): Promise<{ readonly pending: Promise<GuardResult> }> {
  let pending!: Promise<GuardResult>;
  await act(async () => {
    pending = result.current.previewBefore(request, action);
  });
  return { pending };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useProjectImpactGuard — preview modes', () => {
  it('allow → runs the action immediately and resolves `completed`, no dialog', async () => {
    mockedPost.mockResolvedValue(makePreview('allow'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    const { pending } = await start(result, action);

    await expect(pending).resolves.toEqual({ outcome: 'completed' });
    expect(action).toHaveBeenCalledTimes(1);
    rerenderDialog();
    expect(screen.queryByTestId('impact-dialog')).not.toBeInTheDocument();
    expect(result.current.checking).toBe(false);
  });

  it('warn → defers the action, shows the dialog, and resolves ONLY after confirm + action', async () => {
    mockedPost.mockResolvedValue(makePreview('warn'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    const { pending } = await start(result, action);

    expect(action).not.toHaveBeenCalled();
    rerenderDialog();
    expect(screen.getByTestId('impact-dialog')).toHaveAttribute('data-mode', 'warn');

    act(() => { screen.getByText('confirm').click(); });
    await act(async () => { jest.runAllTimers(); });

    await expect(pending).resolves.toEqual({ outcome: 'completed' });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('block → shows the dialog and the action can never run, even on confirm ⇒ `blocked`', async () => {
    mockedPost.mockResolvedValue(makePreview('block'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    const { pending } = await start(result, action);
    rerenderDialog();
    expect(screen.getByTestId('impact-dialog')).toHaveAttribute('data-mode', 'block');

    act(() => { screen.getByText('confirm').click(); });
    act(() => { jest.runAllTimers(); });

    expect(action).not.toHaveBeenCalled();
    await expect(pending).resolves.toEqual({ outcome: 'blocked' });
  });
});

describe('useProjectImpactGuard — Google INP deferral', () => {
  it('confirm closes the dialog BEFORE running the action, not synchronously with it', async () => {
    mockedPost.mockResolvedValue(makePreview('warn'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    await start(result, action);
    rerenderDialog();

    act(() => { screen.getByText('confirm').click(); });

    // The whole point of the pattern: the click has returned, the dialog is gone,
    // and the mutation has NOT run yet — it is queued for the next task.
    rerenderDialog();
    expect(screen.queryByTestId('impact-dialog')).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    act(() => { jest.runAllTimers(); });
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('useProjectImpactGuard — endpoint contract', () => {
  it('posts the request body to the endpoint it was given', async () => {
    mockedPost.mockResolvedValue(makePreview('allow'));
    const { result } = renderGuard();

    await start(result, jest.fn().mockResolvedValue(undefined), { agreementId: 'agr_7' });

    expect(mockedPost).toHaveBeenCalledWith(ENDPOINT, { agreementId: 'agr_7' });
  });

  it('preview failure → unavailable block preview, action never runs ⇒ `blocked`', async () => {
    mockedPost.mockRejectedValue(new Error('network down'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    const { pending } = await start(result, action);

    expect(action).not.toHaveBeenCalled();
    rerenderDialog();
    expect(screen.getByTestId('impact-dialog')).toHaveAttribute('data-mode', 'block');
    expect(screen.getByTestId('message-key')).toHaveTextContent('impactGuard.messages.unavailable');
    expect(result.current.checking).toBe(false);

    act(() => { screen.getByText('dismiss').click(); });
    await expect(pending).resolves.toEqual({ outcome: 'blocked' });
  });

  it('an ApiClientError failure is handled the same as a plain error', async () => {
    mockedPost.mockRejectedValue({ statusCode: 500, message: 'boom' });
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    await start(result, action);

    rerenderDialog();
    expect(screen.getByTestId('impact-dialog')).toHaveAttribute('data-mode', 'block');
    expect(action).not.toHaveBeenCalled();
  });
});

describe('useProjectImpactGuard — onBlockDismiss', () => {
  it('fires when a block dialog is dismissed', async () => {
    mockedPost.mockResolvedValue(makePreview('block'));
    const onBlockDismiss = jest.fn();
    const { result, rerenderDialog } = renderGuard({ onBlockDismiss });

    await start(result, jest.fn().mockResolvedValue(undefined));
    rerenderDialog();
    act(() => { screen.getByText('dismiss').click(); });

    expect(onBlockDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when a warn dialog is dismissed — and the outcome is `cancelled`', async () => {
    mockedPost.mockResolvedValue(makePreview('warn'));
    const onBlockDismiss = jest.fn();
    const { result, rerenderDialog } = renderGuard({ onBlockDismiss });

    const { pending } = await start(result, jest.fn().mockResolvedValue(undefined));
    rerenderDialog();
    act(() => { screen.getByText('dismiss').click(); });

    expect(onBlockDismiss).not.toHaveBeenCalled();
    await expect(pending).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('is optional — dismissing a block without it does not throw', async () => {
    mockedPost.mockResolvedValue(makePreview('block'));
    const { result, rerenderDialog } = renderGuard();

    await start(result, jest.fn().mockResolvedValue(undefined));
    rerenderDialog();

    expect(() => act(() => { screen.getByText('dismiss').click(); })).not.toThrow();
  });
});

describe('useProjectImpactGuard — reset', () => {
  it('clears the dialog and drops the deferred action ⇒ `cancelled`', async () => {
    mockedPost.mockResolvedValue(makePreview('warn'));
    const action = jest.fn().mockResolvedValue(undefined);
    const { result, rerenderDialog } = renderGuard();

    const { pending } = await start(result, action);
    act(() => { result.current.reset(); });

    rerenderDialog();
    expect(screen.queryByTestId('impact-dialog')).not.toBeInTheDocument();

    act(() => { jest.runAllTimers(); });
    expect(action).not.toHaveBeenCalled();
    await expect(pending).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('keeps a stable identity across renders (an inline options literal must not re-create it)', async () => {
    mockedPost.mockResolvedValue(makePreview('allow'));
    const { result, rerender } = renderHook(() =>
      // A fresh object literal every render — exactly how the consumers call it.
      useProjectImpactGuard<{ agreementId: string }>('testScope', ENDPOINT, { onBlockDismiss: () => {} }),
    );

    const firstReset = result.current.reset;
    rerender();

    expect(result.current.reset).toBe(firstReset);
  });
});

describe('buildUnavailableProjectImpactPreview', () => {
  it('is a block with no detail and the unavailable message key', () => {
    expect(buildUnavailableProjectImpactPreview()).toEqual({
      mode: 'block',
      mutationKinds: [],
      changes: [],
      dependencies: [],
      companyLinkChange: 'none',
      messageKey: 'impactGuard.messages.unavailable',
      blockingCount: 0,
      warningCount: 0,
    });
  });
});
