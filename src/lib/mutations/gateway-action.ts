/**
 * =============================================================================
 * runGatewayAction — SSoT for client mutation actions over a policy gateway
 * =============================================================================
 *
 * The client-side twin of the `*WithPolicy` mutation gateways. Every data hook
 * that mutates through one repeats the same four decisions, and repeated them
 * 23 times across four hooks before this module existed (ADR-584 jscpd audit):
 *
 *   1. refuse before the call when the hook is out of scope (no propertyId),
 *   2. invoke the gateway,
 *   3. refetch on success — awaited, or fired off when a slow refetch must not
 *      hold up the caller,
 *   4. map the outcome onto `ActionResult`, turning a throw into `success:false`
 *      rather than letting it escape into a click handler.
 *
 * Only step 4 is uniform; the rest are per-action, which is why this is a plain
 * function taking them as arguments rather than a hook owning them. Callers keep
 * their own `useCallback`, so action identities stay stable and consumers can
 * safely put them in effect dependencies.
 *
 * @module lib/mutations/gateway-action
 * @see ADR-230 — Contract Workflow & Legal Process
 * @see ADR-234 — Payment Plan & Installment Tracking
 * @see ADR-584 — token-based clone ratchet (jscpd)
 */

import { getErrorMessage } from '@/lib/error-utils';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';

/** What every `*WithPolicy` gateway resolves to. */
export interface GatewayResult {
  success: boolean;
  error?: string;
}

/** What every gateway-backed hook action resolves to. Never throws. */
export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface GatewayActionContext {
  /** Refetch to run after a successful mutation. */
  readonly run: () => Promise<void>;
  /**
   * When set, the refetch is handed to `clientSafeFireAndForget` under this
   * label instead of being awaited, so a failing refetch cannot mask a mutation
   * that already succeeded. Absent means the caller waits for fresh data.
   *
   * Encoded as an optional label rather than a `mode` flag so that "fire the
   * refetch off, but unlabelled" is unrepresentable.
   */
  readonly background?: string;
  /**
   * Message to refuse with, without touching the gateway — the hook's scope
   * guard, e.g. no property selected yet. `null` means in scope; hooks scoped by
   * something other than the caller's id (legal contracts carry their own
   * contractId) simply omit it.
   */
  readonly blocked?: string | null;
}

/**
 * Run one gateway mutation and reduce it to an `ActionResult`.
 *
 * @param invoke  Thunk calling exactly one `*WithPolicy` gateway function.
 * @param context Guard, refetch, and refetch discipline for this action.
 */
export async function runGatewayAction(
  invoke: () => Promise<GatewayResult>,
  context: GatewayActionContext,
): Promise<ActionResult> {
  const { run, background, blocked } = context;

  if (blocked) {
    return { success: false, error: blocked };
  }

  try {
    const data = await invoke();

    if (data.success) {
      if (background === undefined) {
        await run();
      } else {
        clientSafeFireAndForget(run(), background);
      }
    }

    return { success: data.success, error: data.error };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
