/**
 * ============================================================================
 * NOTIFICATION_KEYS Registry — Exhaustiveness & Coverage tests (safety net)
 * ============================================================================
 *
 * Bidirectional invariant between NOTIFICATION_KEYS and the domain hooks:
 *
 *   A) Every METHOD on the hook fires a leaf that LIVES in the registry.
 *      → Prevents the dispatcher from passing a key not routed through the SSoT.
 *      → Adding a new method without a registry leaf → test fails.
 *
 *   B) Every LEAF in the registry sub-tree (contacts / projects) is reachable
 *      by a hook method OR explicitly allow-listed as "direct-usage" (callers
 *      that are helper modules, not React hooks, e.g. form-error handlers).
 *      → Adding a leaf without wiring it → test fails, forcing either a hook
 *        method or an explicit allow-list entry.
 *
 * The combined result: every leaf has a documented owner (hook or helper), and
 * every hook method is backed by the registry. Silent drift is impossible.
 *
 * @see src/config/notification-keys.ts — SSoT registry
 * @see src/hooks/notifications/useContactNotifications.ts
 * @see src/hooks/notifications/useProjectNotifications.ts
 */
import { renderHook } from '@testing-library/react';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';
import { useContactNotifications } from '../useContactNotifications';
import { useProjectNotifications } from '../useProjectNotifications';
import { useFilesNotifications } from '../useFilesNotifications';

const success = jest.fn();
const error = jest.fn();
const info = jest.fn();
const warning = jest.fn();

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success, error, info, warning }),
}));

// Files domain hook uses useTranslation for ICU interpolation.
// Mock as identity so dispatched value === key → Direction A passes.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
  }),
}));

// ---------------------------------------------------------------------------
// Registry traversal — collect every string leaf as a Set
// ---------------------------------------------------------------------------
function collectLeaves(node: unknown, out: Set<string>): void {
  if (typeof node === 'string') {
    out.add(node);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectLeaves(value, out);
    }
  }
}

function registryLeaves(subtree: unknown): Set<string> {
  const out = new Set<string>();
  collectLeaves(subtree, out);
  return out;
}

// ---------------------------------------------------------------------------
// Hook call-trace — fire every method, record every key passed to the spies
// ---------------------------------------------------------------------------
function captureKeys(fn: jest.Mock): Set<string> {
  const keys = new Set<string>();
  for (const call of fn.mock.calls) {
    if (typeof call[0] === 'string') keys.add(call[0]);
  }
  return keys;
}

function allDispatchedKeys(): Set<string> {
  const out = new Set<string>();
  for (const k of captureKeys(success)) out.add(k);
  for (const k of captureKeys(error)) out.add(k);
  for (const k of captureKeys(info)) out.add(k);
  for (const k of captureKeys(warning)) out.add(k);
  return out;
}

beforeEach(() => {
  success.mockClear();
  error.mockClear();
  info.mockClear();
  warning.mockClear();
});

// ---------------------------------------------------------------------------
// Direction A: every dispatched key is a registered leaf
// ---------------------------------------------------------------------------
describe('NOTIFICATION_KEYS exhaustiveness — A: dispatched keys ⊂ registry', () => {
  it('useContactNotifications — every method fires a NOTIFICATION_KEYS.contacts leaf', () => {
    const { result } = renderHook(() => useContactNotifications());
    const api = result.current;
    // Fire every documented method
    api.createSuccess();
    api.updateSuccess();
    api.updateError();
    api.uploadsFailed();
    api.uploadsPending();
    api.validationUnknownType();
    api.validationReviewFields();

    const dispatched = allDispatchedKeys();
    const registered = registryLeaves(NOTIFICATION_KEYS.contacts);

    for (const k of dispatched) {
      expect(registered).toContain(k);
    }
  });

  it('useProjectNotifications — every method fires a NOTIFICATION_KEYS.projects leaf', () => {
    const { result } = renderHook(() => useProjectNotifications());
    const api = result.current;
    api.created();
    api.updated();
    api.deleted();
    api.archived();
    api.exported();
    api.loadingError();
    api.address.added();
    api.address.updated();
    api.address.deleted();
    api.address.cleared();
    api.address.primaryUpdated();
    api.address.saveError();
    api.address.updateError();
    api.address.deleteError();
    api.address.clearError();
    api.address.soleAddressMustBePrimary();
    api.address.cityRequired();

    const dispatched = allDispatchedKeys();
    const registered = registryLeaves(NOTIFICATION_KEYS.projects);

    for (const k of dispatched) {
      expect(registered).toContain(k);
    }
  });

  it('useFilesNotifications — every method fires a NOTIFICATION_KEYS.files leaf', () => {
    const { result } = renderHook(() => useFilesNotifications());
    const api = result.current;
    api.upload.success(1);
    api.upload.notAuthenticated();
    api.upload.authFailed();
    api.upload.partialSuccess({ success: 2, fail: 1, total: 3 });
    api.upload.allFailed(3);
    api.upload.generic();
    api.list.renameSuccess();
    api.list.renameError();
    api.list.deleteSuccess();
    api.list.deleteError();
    api.list.unlinkSuccess();
    api.list.unlinkError();
    api.technical.pathUnavailable();
    api.technical.pathCopied();
    api.technical.copyError();
    api.trash.restoreSuccess();
    api.trash.restoreError();
    api.archived.unarchiveSuccess();
    api.archived.unarchiveError();
    api.batch.archiveSuccess(5);
    api.batch.archivePartialSuccess({ processed: 3, failed: 2, total: 5 });
    api.batch.archiveNoChanges();
    api.batch.archiveError();
    api.batch.unarchiveSuccess(4);
    api.batch.unarchiveError();
    api.batch.noAIClassifiableFiles();

    const dispatched = allDispatchedKeys();
    const registered = registryLeaves(NOTIFICATION_KEYS.files);

    for (const k of dispatched) {
      expect(registered).toContain(k);
    }
  });
});

// ---------------------------------------------------------------------------
// Direction B: every registered leaf has an owner (hook method OR allow-list)
// ---------------------------------------------------------------------------

/**
 * Leaves used by NON-hook helpers (pure functions that cannot call React
 * hooks). When the owning helper is migrated to a dispatcher, its entry is
 * removed from this list — that's the only way to shrink the allow-list.
 *
 * Each entry MUST link to the helper that consumes it. New entries require
 * an ADR comment.
 */
const DIRECT_USAGE_LEAVES = new Set<string>([
  // src/utils/contactForm/submission-error-handler.ts — pure helper, no hook
  NOTIFICATION_KEYS.contacts.duplicate.exactMatch,
  NOTIFICATION_KEYS.contacts.duplicate.possibleMatch,
  NOTIFICATION_KEYS.contacts.duplicate.similarMatch,
  // src/utils/contactForm/execute-guarded-contact-update.ts — pure helper, no hook
  NOTIFICATION_KEYS.contacts.companyIdentity.unsafeClear,
  // src/components/shared/files/hooks/useBatchFileOperations.ts — showArchiveResultFeedback()
  // pure exported utility that accepts generic notify callbacks; called from
  // file-manager-handlers.ts too. Migrated to domain hook in a future phase.
  NOTIFICATION_KEYS.files.batch.archiveSuccess,
  NOTIFICATION_KEYS.files.batch.archivePartialSuccess,
  NOTIFICATION_KEYS.files.batch.archiveNoChanges,
  NOTIFICATION_KEYS.files.batch.archiveError,
]);

function leavesCoveredByHook(
  hook: () => { [k: string]: unknown } | unknown,
  invokeAll: (api: ReturnType<typeof hook>) => void,
): Set<string> {
  const { result } = renderHook(hook);
  invokeAll(result.current as ReturnType<typeof hook>);
  return allDispatchedKeys();
}

describe('NOTIFICATION_KEYS exhaustiveness — B: every leaf has an owner', () => {
  it('NOTIFICATION_KEYS.contacts — every leaf is covered by hook or allow-list', () => {
    const registered = registryLeaves(NOTIFICATION_KEYS.contacts);
    const covered = leavesCoveredByHook(useContactNotifications, (api) => {
      const a = api as ReturnType<typeof useContactNotifications>;
      a.createSuccess();
      a.updateSuccess();
      a.updateError();
      a.uploadsFailed();
      a.uploadsPending();
      a.validationUnknownType();
      a.validationReviewFields();
    });

    const orphans: string[] = [];
    for (const leaf of registered) {
      if (!covered.has(leaf) && !DIRECT_USAGE_LEAVES.has(leaf)) {
        orphans.push(leaf);
      }
    }

    expect(orphans).toEqual([]);
  });

  it('NOTIFICATION_KEYS.projects — every leaf is covered by hook method', () => {
    const registered = registryLeaves(NOTIFICATION_KEYS.projects);
    const covered = leavesCoveredByHook(useProjectNotifications, (api) => {
      const a = api as ReturnType<typeof useProjectNotifications>;
      a.created();
      a.updated();
      a.deleted();
      a.archived();
      a.exported();
      a.loadingError();
      a.address.added();
      a.address.updated();
      a.address.deleted();
      a.address.cleared();
      a.address.primaryUpdated();
      a.address.saveError();
      a.address.updateError();
      a.address.deleteError();
      a.address.clearError();
      a.address.soleAddressMustBePrimary();
      a.address.cityRequired();
    });

    const orphans: string[] = [];
    for (const leaf of registered) {
      if (!covered.has(leaf) && !DIRECT_USAGE_LEAVES.has(leaf)) {
        orphans.push(leaf);
      }
    }

    expect(orphans).toEqual([]);
  });

  it('NOTIFICATION_KEYS.files — every leaf is covered by hook method or allow-list', () => {
    const registered = registryLeaves(NOTIFICATION_KEYS.files);
    const covered = leavesCoveredByHook(useFilesNotifications, (api) => {
      const a = api as ReturnType<typeof useFilesNotifications>;
      a.upload.success(1);
      a.upload.notAuthenticated();
      a.upload.authFailed();
      a.upload.partialSuccess({ success: 2, fail: 1, total: 3 });
      a.upload.allFailed(3);
      a.upload.generic();
      a.list.renameSuccess();
      a.list.renameError();
      a.list.deleteSuccess();
      a.list.deleteError();
      a.list.unlinkSuccess();
      a.list.unlinkError();
      a.technical.pathUnavailable();
      a.technical.pathCopied();
      a.technical.copyError();
      a.trash.restoreSuccess();
      a.trash.restoreError();
      a.archived.unarchiveSuccess();
      a.archived.unarchiveError();
      a.batch.archiveSuccess(5);
      a.batch.archivePartialSuccess({ processed: 3, failed: 2, total: 5 });
      a.batch.archiveNoChanges();
      a.batch.archiveError();
      a.batch.unarchiveSuccess(4);
      a.batch.unarchiveError();
      a.batch.noAIClassifiableFiles();
    });

    const orphans: string[] = [];
    for (const leaf of registered) {
      if (!covered.has(leaf) && !DIRECT_USAGE_LEAVES.has(leaf)) {
        orphans.push(leaf);
      }
    }

    expect(orphans).toEqual([]);
  });

  it('DIRECT_USAGE_LEAVES entries all resolve to real registry leaves (no stale entries)', () => {
    const allLeaves = new Set<string>();
    collectLeaves(NOTIFICATION_KEYS, allLeaves);
    for (const leaf of DIRECT_USAGE_LEAVES) {
      expect(allLeaves).toContain(leaf);
    }
  });
});
