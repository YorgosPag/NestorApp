/**
 * ADR-344 Phase 7.D — User text-templates fetch hook.
 *
 * Built-ins are read synchronously from `BUILT_IN_TEXT_TEMPLATES` (TS
 * constants, no I/O). User templates come from `/api/dxf/text-templates`
 * GET. Both are normalised to the canonical `TextTemplate` shape so the
 * manager UI can treat them uniformly while still discriminating via
 * `isDefault` for the read-only / Duplicate-only flow (Q2 → option α).
 *
 * Lightweight cache: a single in-memory `Map<companyId, TextTemplate[]>`
 * keyed by tenant so navigating away and back to the manager does not
 * re-fetch. Optimistic mutations (`useTextTemplateMutations`) replace the
 * cache entry; `refresh()` re-fetches from the server.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BUILT_IN_TEXT_TEMPLATES,
  type TextTemplate,
} from '@/subapps/dxf-viewer/text-engine/templates';
import type { SerializedUserTextTemplate } from '../shared/serialized-template.types';
import { deserializeUserTemplate, getCachedUserTemplates, setCachedUserTemplates } from './template-cache';

interface UseTextTemplatesResult {
  readonly builtIn: readonly TextTemplate[];
  readonly user: readonly TextTemplate[];
  readonly all: readonly TextTemplate[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  /** Replace the in-memory user list (used by optimistic mutations). */
  readonly setUserTemplatesLocal: (next: readonly TextTemplate[]) => void;
}

interface ListResponse {
  readonly success: boolean;
  readonly templates?: readonly SerializedUserTextTemplate[];
  readonly error?: string;
}

export function useTextTemplates(companyId: string | null): UseTextTemplatesResult {
  const [user, setUser] = useState<readonly TextTemplate[]>(() =>
    companyId ? (getCachedUserTemplates(companyId) ?? []) : [],
  );
  const [loading, setLoading] = useState<boolean>(() => !!companyId && !getCachedUserTemplates(companyId));
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dxf/text-templates', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.success || !data.templates) {
        throw new Error(data.error ?? `Failed to list templates (HTTP ${res.status})`);
      }
      const list = data.templates.map(deserializeUserTemplate);
      setCachedUserTemplates(tenantId, list);
      setUser(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setUser([]);
      setLoading(false);
      return;
    }
    void fetchList(companyId);
  }, [companyId, fetchList]);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    await fetchList(companyId);
  }, [companyId, fetchList]);

  const setUserTemplatesLocal = useCallback(
    (next: readonly TextTemplate[]) => {
      if (companyId) setCachedUserTemplates(companyId, next);
      setUser(next);
    },
    [companyId],
  );

  const all = useMemo<readonly TextTemplate[]>(
    () => [...BUILT_IN_TEXT_TEMPLATES, ...user],
    [user],
  );

  return {
    builtIn: BUILT_IN_TEXT_TEMPLATES,
    user,
    all,
    loading,
    error,
    refresh,
    setUserTemplatesLocal,
  };
}
