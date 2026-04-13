/**
 * @file useVersionedSave — Client-side Optimistic Versioning Hook
 * @module hooks/useVersionedSave
 *
 * 🏢 ENTERPRISE: SPEC-256A — Tracks document `_v` and intercepts 409 conflicts.
 *
 * Wraps any save function to:
 * 1. Inject `_v` into the payload automatically
 * 2. Bump local version on success
 * 3. Catch 409 conflicts and expose `isConflicted` (blocks useAutoSave retries)
 * 4. Provide `resetConflict()` + `forceSave()` for ConflictDialog actions
 *
 * @example
 * ```tsx
 * const versioned = useVersionedSave({
 *   initialVersion: building._v,
 *   saveFn: (data) => updateBuilding(buildingId, data),
 *   onConflict: (body) => setConflictData(body),
 * });
 *
 * // Pass to useAutoSave:
 * useAutoSave(formData, {
 *   saveFn: versioned.save,
 *   enabled: isEditing && !versioned.isConflicted,
 * });
 * ```
 *
 * @see src/types/versioning.ts
 * @see src/components/shared/ConflictDialog.tsx
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { ConflictResponseBody } from '@/types/versioning';
import { CONFLICT_CODE } from '@/config/versioning-config';

// ============================================
// TYPES
// ============================================

/** Result from a versioned save function (must include `_v` on success) */
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
   * version only ever moves forward. Omit ONLY for legacy call-sites that
   * never swap entities within the same mount.
   */
  entityId?: string;
  /** The actual save function that sends data to the API */
  saveFn: (data: T & { _v?: number }) => Promise<VersionedSaveResult>;
  /** Called when a 409 conflict is detected */
  onConflict?: (body: ConflictResponseBody) => void;
}

interface UseVersionedSaveReturn<T> {
  /** Current tracked version */
  version: number | undefined;
  /** Whether a conflict is active (blocks auto-save) */
  isConflicted: boolean;
  /** Conflict details (for ConflictDialog) */
  conflictData: ConflictResponseBody | null;
  /** Wrapped save function — injects `_v`, handles 409 */
  save: (data: T) => Promise<void>;
  /** Force save ignoring version (for "Overwrite" action in ConflictDialog) */
  forceSave: (data: T) => Promise<void>;
  /** Clear conflict state (for "Reload" action) */
  resetConflict: () => void;
  /** Manually set version (e.g. after reload) */
  setVersion: (v: number) => void;
}

// ============================================
// HELPERS
// ============================================

/**
 * Detect a version conflict from an error.
 * Works with:
 * 1. ApiClientError (statusCode: 409, errorCode: 'VERSION_CONFLICT')
 * 2. Plain objects with code/errorCode fields
 * 3. Error messages containing VERSION_CONFLICT
 */
function extractConflictBody(error: unknown): ConflictResponseBody | null {
  if (!error || typeof error !== 'object') return null;

  const errObj = error as Record<string, unknown>;

  // Pattern 1: ApiClientError with statusCode 409
  // The errorCode and message are set from the response body by enterprise-api-client
  if (errObj.statusCode === 409 || errObj.errorCode === CONFLICT_CODE || errObj.code === CONFLICT_CODE) {
    // Try to extract structured body
    if (errObj.body && typeof errObj.body === 'object') {
      return errObj.body as ConflictResponseBody;
    }

    // ApiClientError: message contains the conflict info
    // The 409 response body has: code, error, errorCode, currentVersion, expectedVersion, updatedAt, updatedBy
    // enterprise-api-client sets error.message = response.error field
    const message = (errObj.message as string) ?? '';
    if (message.includes('conflict') || message.includes(CONFLICT_CODE)) {
      // Build a minimal ConflictResponseBody from available data
      return {
        code: CONFLICT_CODE,
        error: message,
        errorCode: CONFLICT_CODE,
        currentVersion: -1, // Unknown — dialog will still show
        expectedVersion: -1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'unknown',
      };
    }
  }

  // Pattern 2: Check error message for conflict indicator
  const message = (errObj.message as string) ?? '';
  if (message.includes(CONFLICT_CODE)) {
    try {
      const jsonStart = message.indexOf('{');
      if (jsonStart >= 0) {
        return JSON.parse(message.slice(jsonStart)) as ConflictResponseBody;
      }
    } catch {
      // Not parseable — fall through
    }
  }

  return null;
}

// ============================================
// HOOK
// ============================================

export function useVersionedSave<T>(
  config: UseVersionedSaveConfig<T>
): UseVersionedSaveReturn<T> {
  const { initialVersion, entityId, saveFn, onConflict } = config;

  const versionRef = useRef<number | undefined>(initialVersion);
  const entityIdRef = useRef<string | undefined>(entityId);
  const [isConflicted, setIsConflicted] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictResponseBody | null>(null);

  // Sync versionRef with the prop under two carefully-scoped rules. The old
  // implementation unconditionally mirrored `initialVersion` into `versionRef`
  // on every render, which caused a race on solo-user auto-save: a successful
  // save bumped the ref from 5→6, but the parent prop still held _v=5 for one
  // extra render, so the mirror rolled the ref back to 5 and the next
  // auto-save fired with a stale _v, producing a self-409.
  if (entityId !== undefined && entityId !== entityIdRef.current) {
    // Entity swap (e.g. user navigated to a different project). Adopt the new
    // prop version outright — previous entity's tracked version is irrelevant.
    entityIdRef.current = entityId;
    versionRef.current = initialVersion;
  } else if (
    initialVersion !== undefined &&
    !isConflicted &&
    (versionRef.current === undefined || initialVersion > versionRef.current)
  ) {
    // Same entity: only accept prop versions that move forward. Prevents the
    // lagging-prop rollback while still picking up genuine external updates
    // (e.g. another tab wrote a newer version and the parent re-fetched).
    versionRef.current = initialVersion;
  }

  // Save function ref to avoid stale closures
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;

  /**
   * Internal save logic — shared by `save` (with _v) and `forceSave` (without _v).
   */
  const doSave = useCallback(async (data: T, includeVersion: boolean) => {
    const payload = includeVersion
      ? { ...data, _v: versionRef.current }
      : { ...data }; // No _v → server does force-write

    let result: VersionedSaveResult;
    try {
      result = await saveFnRef.current(payload as T & { _v?: number });
    } catch (thrown: unknown) {
      // SPEC-256A: ApiClientError with 409 is re-thrown by service layer
      const conflictBody = extractConflictBody(thrown);
      if (conflictBody) {
        setIsConflicted(true);
        setConflictData(conflictBody);
        onConflictRef.current?.(conflictBody);
        // DO NOT re-throw — prevents useAutoSave from retrying
        return;
      }
      // Non-conflict errors: re-throw for useAutoSave to handle
      throw thrown;
    }

    if (!result.success) {
      // Check if the error message contains conflict info
      const conflictBody = extractConflictBody({ message: result.error, code: CONFLICT_CODE });
      if (conflictBody || result.error?.includes(CONFLICT_CODE)) {
        setIsConflicted(true);
        if (conflictBody) {
          setConflictData(conflictBody);
          onConflictRef.current?.(conflictBody);
        }
        // DO NOT throw — prevents useAutoSave from retrying
        return;
      }
      throw new Error(result.error || 'Save failed');
    }

    // Success — update local version
    if (typeof result._v === 'number') {
      versionRef.current = result._v;
    }
  }, []);

  /** Normal save — includes `_v` for conflict detection */
  const save = useCallback(async (data: T) => {
    await doSave(data, true);
  }, [doSave]);

  /** Force save — omits `_v` to bypass version check */
  const forceSave = useCallback(async (data: T) => {
    await doSave(data, false);
    // Clear conflict state on successful force save
    setIsConflicted(false);
    setConflictData(null);
  }, [doSave]);

  /** Reset conflict state (e.g. after user reloads data) */
  const resetConflict = useCallback(() => {
    setIsConflicted(false);
    setConflictData(null);
  }, []);

  /** Manually set version (e.g. after reloading document) */
  const setVersion = useCallback((v: number) => {
    versionRef.current = v;
  }, []);

  return {
    version: versionRef.current,
    isConflicted,
    conflictData,
    save,
    forceSave,
    resetConflict,
    setVersion,
  };
}
