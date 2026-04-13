/**
 * @file useProjectDetail — Hydrate-on-select for the project detail view
 * @module hooks/useProjectDetail
 *
 * 🏢 ENTERPRISE: ADR-256 Read-path counterpart.
 *
 * The project list (`/api/projects/list`) intentionally projects a lean
 * `ProjectSummary` for tile performance — it omits ~22 fields that the detail
 * view needs (permits, description, budget, client, etc.). This hook fetches
 * the full Firestore document via `GET /api/projects/[projectId]` and becomes
 * the single source of truth for the detail tabs. The list summary is used
 * only as a placeholder until hydration resolves.
 *
 * Behavior:
 * - Fetches on `projectId` change, with an in-memory cache keyed by id.
 * - Merges `PROJECT_UPDATED` realtime events shallowly into the hydrated doc.
 * - Pauses automatic refetch while the user is editing (prevents mid-edit
 *   clobber) — events are still merged because they are authoritative deltas
 *   from the user's own save.
 * - Exposes `refetch()` for post-save canonicalization.
 * - Soft-aborts superseded requests via a monotonic request counter.
 * - 404 surfaces as `error` + `project: null` so callers can render an empty
 *   state when a document is deleted mid-navigation.
 *
 * @see src/app/api/projects/[projectId]/route.ts (GET handler)
 * @see src/hooks/useProjectsState.ts (list-side event merge — kept in sync in parallel)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { applyUpdates } from '@/lib/utils';
import type { Project } from '@/types/project';

const logger = createModuleLogger('useProjectDetail');

// ============================================================================
// Module-level cache — SPA session lifetime.
// Shared across all hook instances so revisiting a previously-hydrated project
// paints instantly. Kept fresh by PROJECT_UPDATED events (see subscription
// below). Never persisted — a hard reload clears it, which is intentional
// because the fetch that follows is the canonical source of truth.
// ============================================================================
const projectCache = new Map<string, Project>();

interface ProjectGetResponse {
  project: Project;
}

export interface UseProjectDetailOptions {
  /** Skip fetching entirely (e.g. create mode — no document exists yet). */
  skip?: boolean;
  /**
   * When true, suppress automatic refetch on id change. Realtime events are
   * still merged. Flip this on while the user is actively editing so an
   * incoming hydration can't clobber unsaved form state.
   */
  pauseRefetch?: boolean;
}

export interface UseProjectDetailResult {
  project: Project | null;
  isLoading: boolean;
  error: Error | null;
  /** Manually re-run the fetch, bypassing cache and `pauseRefetch`. */
  refetch: () => Promise<void>;
}

/**
 * Soft-abort guard: each fetch increments `requestIdRef`, and the completion
 * handler checks it against its own captured value before touching state.
 * Prevents a slow first request from overwriting a fast second request.
 */
export function useProjectDetail(
  projectId: string | null | undefined,
  opts: UseProjectDetailOptions = {},
): UseProjectDetailResult {
  const { skip = false, pauseRefetch = false } = opts;

  const [project, setProject] = useState<Project | null>(
    projectId ? projectCache.get(projectId) ?? null : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);
  const projectIdRef = useRef<string | null | undefined>(projectId);
  projectIdRef.current = projectId;

  // Imperative fetcher, reused by the auto-fetch effect AND by refetch().
  const doFetch = useCallback(async (id: string, forceBypassCache: boolean) => {
    const myRequestId = ++requestIdRef.current;

    const cached = projectCache.get(id);
    if (cached && !forceBypassCache) {
      setProject(cached);
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ProjectGetResponse>(API_ROUTES.PROJECTS.BY_ID(id));

      if (myRequestId !== requestIdRef.current || projectIdRef.current !== id) {
        // Superseded — drop the result on the floor.
        return;
      }

      const fresh = response.project;
      projectCache.set(id, fresh);
      setProject(fresh);
      setError(null);
    } catch (caught) {
      if (myRequestId !== requestIdRef.current || projectIdRef.current !== id) {
        return;
      }

      const isNotFound = ApiClientError.isApiClientError(caught) && caught.statusCode === 404;
      if (isNotFound) {
        projectCache.delete(id);
        setProject(null);
        setError(caught as Error);
        logger.info('Project not found (404)', { projectId: id });
      } else {
        // Non-404: keep whatever we had cached and surface the error.
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        logger.warn('Project detail fetch failed', { projectId: id, error: caught });
      }
    } finally {
      if (myRequestId === requestIdRef.current && projectIdRef.current === id) {
        setIsLoading(false);
      }
    }
  }, []);

  // Auto-fetch on id change. Suspended when `skip` is true (create mode) or
  // `pauseRefetch` is true (user is editing — we don't want a stale-window
  // refetch clobbering unsaved input).
  useEffect(() => {
    if (skip || !projectId) {
      requestIdRef.current += 1; // invalidate any in-flight fetch
      setProject(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (pauseRefetch) {
      // Seed from cache if we have it (for instant paint after mount in edit
      // mode) but do not fetch.
      const cached = projectCache.get(projectId);
      if (cached) setProject(cached);
      return;
    }

    void doFetch(projectId, false);
  }, [projectId, skip, pauseRefetch, doFetch]);

  // Realtime subscription — shallow-merge PROJECT_UPDATED deltas into the
  // hydrated doc and the cache. Events are accepted even during an editing
  // session: keeping `hydrated` in sync is what prevents a post-save flash
  // of stale data when the form's sync effect runs again on `isEditing` exit.
  // The consumer (`GeneralProjectTab`) is responsible for not re-syncing its
  // form state from props mid-edit (see its `isEditing` early-return).
  useEffect(() => {
    const handleUpdate = (payload: ProjectUpdatedPayload) => {
      if (!projectIdRef.current || payload.projectId !== projectIdRef.current) return;

      setProject((prev) => {
        if (!prev) return prev;
        const merged = applyUpdates(prev, payload.updates);
        projectCache.set(payload.projectId, merged);
        return merged;
      });
    };

    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleUpdate);
    return unsubscribe;
  }, []);

  const refetch = useCallback(async () => {
    const currentId = projectIdRef.current;
    if (!currentId || skip) return;
    await doFetch(currentId, true);
  }, [doFetch, skip]);

  return { project, isLoading, error, refetch };
}
