/**
 * @file useVersionedSave — Silent Last-Write-Wins Versioning Hook
 * @module hooks/useVersionedSave
 *
 * 🏢 ENTERPRISE: SPEC-256A Phase 2 — Google pattern for solo-user apps.
 *
 * Wraps any save function to:
 * 1. Inject `_v` into the payload automatically (server still enforces it for audit)
 * 2. Bump local version on success
 * 3. On 409 VERSION_CONFLICT → **silently retry without `_v`** (last-write-wins)
 *
 * No dialog. No user interruption. The audit trail remains the source of truth
 * for who-changed-what. This matches Gmail / Google Contacts / Calendar behavior
 * for single-tenant records: the user's latest intent always wins, and the
 * version history is preserved server-side for post-hoc inspection.
 *
 * Phase 1 (ConflictDialog-based) was removed because:
 * - Nestor is a solo-user operator app — true concurrent edits are exceptional.
 * - The dialog fired on self-conflicts (stale prop, phantom server bumps, etc.)
 *   and became noise, not signal.
 * - A "pick keep-mine vs discard" modal breaks flow for something the user
 *   cannot meaningfully resolve without side-by-side diff UX.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-256-concurrency-conflict-analysis.md
 * @see docs/centralized-systems/reference/adrs/specs/SPEC-256A-optimistic-versioning.md
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CONFLICT_CODE } from '@/config/versioning-config';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useVersionedSave');

// ============================================
// TYPES
// ============================================

interface VersionedSaveResult {
  success: boolean;
  error?: string;
  _v?: number;
}

interface UseVersionedSaveConfig<T> {
  /** Initial version from the loaded document. `undefined` = not yet loaded. */
  initialVersion: number | undefined;
  /**
   * Identity of the entity being saved (e.g. `project.id`). When this changes,
   * the hook resets its tracked version to `initialVersion`. When it stays the
   * same, a lagging prop cannot roll the version backwards — the local tracked
   * version only ever moves forward.
   */
  entityId?: string;
  /** The actual save function that sends data to the API */
  saveFn: (data: T & { _v?: number }) => Promise<VersionedSaveResult>;
}

interface UseVersionedSaveReturn<T> {
  /** Current tracked version */
  version: number | undefined;
  /** Wrapped save function — silent last-write-wins on 409 */
  save: (data: T) => Promise<void>;
  /** Manually set version (e.g. after external reload) */
  setVersion: (v: number) => void;
}

// ============================================
// HELPERS
// ============================================

function is409Conflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as Record<string, unknown>;
  if (errObj.statusCode === 409) return true;
  if (errObj.errorCode === CONFLICT_CODE || errObj.code === CONFLICT_CODE) return true;
  const message = typeof errObj.message === 'string' ? errObj.message : '';
  return message.includes(CONFLICT_CODE);
}

function resultIs409(result: VersionedSaveResult): boolean {
  if (result.success) return false;
  return typeof result.error === 'string' && result.error.includes(CONFLICT_CODE);
}

// ============================================
// HOOK
// ============================================

export function useVersionedSave<T>(
  config: UseVersionedSaveConfig<T>
): UseVersionedSaveReturn<T> {
  const { initialVersion, entityId, saveFn } = config;

  const versionRef = useRef<number | undefined>(initialVersion);
  const entityIdRef = useRef<string | undefined>(entityId);

  // Forward-only version sync. Entity swap → reset. Same entity → adopt only
  // prop versions that move forward (prevents lagging-prop rollback causing
  // self-409 races on auto-save).
  const entityChanged = entityId !== undefined && entityId !== entityIdRef.current;
  if (entityChanged) {
    versionRef.current = initialVersion;
  } else if (
    initialVersion !== undefined
    && (versionRef.current === undefined || initialVersion > versionRef.current)
  ) {
    versionRef.current = initialVersion;
  }

  useEffect(() => {
    if (entityId === undefined) return;
    if (entityId === entityIdRef.current) return;
    entityIdRef.current = entityId;
  }, [entityId]);

  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const save = useCallback(async (data: T) => {
    // First attempt: with `_v` so the server can audit the version.
    const firstPayload = { ...data, _v: versionRef.current } as T & { _v?: number };

    let result: VersionedSaveResult;
    try {
      result = await saveFnRef.current(firstPayload);
    } catch (thrown: unknown) {
      if (is409Conflict(thrown)) {
        // Silent retry without _v (last-write-wins).
        logger.warn('Version conflict — silent retry without _v', { entityId });
        const retryPayload = { ...data } as T & { _v?: number };
        const retryResult = await saveFnRef.current(retryPayload);
        if (retryResult.success && typeof retryResult._v === 'number') {
          versionRef.current = retryResult._v;
        } else if (!retryResult.success) {
          throw new Error(retryResult.error || 'Save failed after version-conflict retry');
        }
        return;
      }
      throw thrown;
    }

    if (!result.success) {
      if (resultIs409(result)) {
        logger.warn('Version conflict (result) — silent retry without _v', { entityId });
        const retryPayload = { ...data } as T & { _v?: number };
        const retryResult = await saveFnRef.current(retryPayload);
        if (retryResult.success && typeof retryResult._v === 'number') {
          versionRef.current = retryResult._v;
        } else if (!retryResult.success) {
          throw new Error(retryResult.error || 'Save failed after version-conflict retry');
        }
        return;
      }
      throw new Error(result.error || 'Save failed');
    }

    if (typeof result._v === 'number') {
      versionRef.current = result._v;
    }
  }, [entityId]);

  const setVersion = useCallback((v: number) => {
    versionRef.current = v;
  }, []);

  return {
    version: versionRef.current,
    save,
    setVersion,
  };
}
