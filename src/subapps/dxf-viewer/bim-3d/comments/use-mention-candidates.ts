'use client';

/**
 * ADR-366 Phase 9 / C.2 — @-mention candidate source (BIM comments).
 *
 * Owns fetching + filtering the company user list so that the KEYBOARD owner
 * (the focused `<textarea>` in `CommentReplyInput`) and the RENDERER (the
 * `CommentMentionsPicker` listbox) read the exact same array. Before this hook
 * the list lived inside the picker, which is why the picker's own arrow / Enter
 * / Escape handler could never work: it was attached to a `role="listbox"` that
 * nothing ever focused (ADR-364 §10.5 Κ2-γ).
 *
 * Fetch policy: lazy and once. The request fires the first time a mention query
 * becomes active — never on mount of the reply box — and the result is reused
 * for every subsequent `@` in the same session of this component. Filtering is
 * purely local, so typing does not re-hit the API.
 */

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { CompanyUser, UserListResponse } from '@/components/admin/role-management/types';

function matches(user: CompanyUser, needle: string): boolean {
  const name = (user.displayName ?? '').toLowerCase();
  return name.includes(needle) || user.email.toLowerCase().includes(needle);
}

/**
 * @param query Active mention query (text after `@`), or `null` when no mention
 *              is in progress. `null` suppresses the fetch entirely.
 * @returns The filtered candidate list — empty while loading or when nothing matches.
 */
export function useMentionCandidates(query: string | null): readonly CompanyUser[] {
  const [users, setUsers] = useState<readonly CompanyUser[]>([]);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (query === null || requestedRef.current) return;
    requestedRef.current = true;

    let cancelled = false;
    apiClient
      .get<UserListResponse['data']>(API_ROUTES.ADMIN.ROLE_MANAGEMENT.USERS)
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (query === null) return [];
  const needle = query.toLowerCase();
  return users.filter((u) => matches(u, needle));
}
