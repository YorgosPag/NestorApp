/**
 * Unit tests for the gateway-action engine (ADR-584).
 *
 * The bindings are covered by `hooks/__tests__/gateway-action-bindings.test.tsx`;
 * this file pins the engine's own decisions — the ones that used to be retyped
 * 23 times, and so used to be wrong in 23 places at once when they were wrong.
 */
import { runGatewayAction } from '../gateway-action';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';

// Mirrors the real contract: it takes ownership of the promise and logs the
// rejection. A bare jest.fn() would leave it unhandled and crash the worker.
jest.mock('@/lib/safe-fire-and-forget', () => ({
  clientSafeFireAndForget: jest.fn((promise: Promise<unknown>) => {
    void promise.catch(() => undefined);
  }),
}));

const mockedFireAndForget = clientSafeFireAndForget as jest.Mock;

describe('runGatewayAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scope guard', () => {
    it('refuses with the guard message without invoking the gateway', async () => {
      const invoke = jest.fn();
      const run = jest.fn();

      const result = await runGatewayAction(invoke, { run, blocked: 'No property selected' });

      expect(result).toEqual({ success: false, error: 'No property selected' });
      expect(invoke).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    });

    it('proceeds when the guard is null', async () => {
      const invoke = jest.fn().mockResolvedValue({ success: true });
      const run = jest.fn().mockResolvedValue(undefined);

      const result = await runGatewayAction(invoke, { run, blocked: null });

      expect(result).toEqual({ success: true, error: undefined });
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('proceeds when the caller omits a guard entirely', async () => {
      const invoke = jest.fn().mockResolvedValue({ success: true });
      const run = jest.fn().mockResolvedValue(undefined);

      const result = await runGatewayAction(invoke, { run });

      expect(result).toEqual({ success: true, error: undefined });
      expect(invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('result mapping', () => {
    it('passes a gateway refusal through with its reason', async () => {
      const run = jest.fn().mockResolvedValue(undefined);

      const result = await runGatewayAction(
        async () => ({ success: false, error: 'V-CHQ-003 violated' }),
        { run },
      );

      expect(result).toEqual({ success: false, error: 'V-CHQ-003 violated' });
    });

    it('reduces a thrown Error to a failed result rather than propagating it', async () => {
      const run = jest.fn().mockResolvedValue(undefined);

      const result = await runGatewayAction(
        async () => { throw new Error('HTTP 500'); },
        { run },
      );

      expect(result).toEqual({ success: false, error: 'HTTP 500' });
    });

    it('reduces a non-Error throw through getErrorMessage', async () => {
      const run = jest.fn().mockResolvedValue(undefined);

      const result = await runGatewayAction(
        async () => { throw 'plain string'; },
        { run },
      );

      expect(result).toEqual({ success: false, error: 'plain string' });
    });
  });

  describe('refetch discipline', () => {
    it('awaits the refetch before resolving, so callers see fresh data', async () => {
      const order: string[] = [];
      const run = jest.fn(async () => { order.push('refetch'); });

      await runGatewayAction(async () => { order.push('gateway'); return { success: true }; }, { run });
      order.push('resolved');

      expect(order).toEqual(['gateway', 'refetch', 'resolved']);
      expect(mockedFireAndForget).not.toHaveBeenCalled();
    });

    it('hands the refetch to clientSafeFireAndForget under the given label', async () => {
      const run = jest.fn().mockResolvedValue(undefined);

      await runGatewayAction(async () => ({ success: true }), { run, background: 'Thing.refetch' });

      expect(run).toHaveBeenCalledTimes(1);
      expect(mockedFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockedFireAndForget).toHaveBeenCalledWith(expect.any(Promise), 'Thing.refetch');
    });

    it('does not refetch when the gateway refuses', async () => {
      const run = jest.fn();

      await runGatewayAction(async () => ({ success: false, error: 'nope' }), { run });

      expect(run).not.toHaveBeenCalled();
      expect(mockedFireAndForget).not.toHaveBeenCalled();
    });

    it('does not refetch when the gateway throws', async () => {
      const run = jest.fn();

      await runGatewayAction(async () => { throw new Error('boom'); }, { run });

      expect(run).not.toHaveBeenCalled();
    });

    it('reports a failed awaited refetch rather than the successful mutation', async () => {
      // The awaited path deliberately lets a refetch failure surface: the caller
      // asked to wait for fresh data and did not get it.
      const run = jest.fn().mockRejectedValue(new Error('refetch died'));

      const result = await runGatewayAction(async () => ({ success: true }), { run });

      expect(result).toEqual({ success: false, error: 'refetch died' });
    });

    it('never lets a backgrounded refetch failure mask a successful mutation', async () => {
      // clientSafeFireAndForget owns the rejection; the action still reports success.
      const run = jest.fn().mockRejectedValue(new Error('refetch died'));

      const result = await runGatewayAction(async () => ({ success: true }), {
        run,
        background: 'Thing.refetch',
      });

      expect(result).toEqual({ success: true, error: undefined });
    });
  });
});
