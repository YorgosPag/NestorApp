'use client';

/**
 * ADR-366 Phase 9 / C.2 — @-mention user picker for BIM comments.
 * New SSoT for @-mention in BIM context — no existing user picker found.
 * Fetches company users via admin API, filters by query, keyboard nav.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { CompanyUser, UserListResponse } from '@/components/admin/role-management/types';

interface CommentMentionsPickerProps {
  readonly query: string;
  readonly onSelect: (userId: string, userName: string) => void;
  readonly onClose: () => void;
}

export function CommentMentionsPicker({ query, onSelect, onClose }: CommentMentionsPickerProps) {
  const { t } = useTranslation('bim3d');
  const [users, setUsers] = useState<readonly CompanyUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    apiClient
      .get<UserListResponse['data']>(API_ROUTES.ADMIN.ROLE_MANAGEMENT.USERS)
      .then((data) => setUsers(data.users))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const q = query.toLowerCase();
  const filtered = users.filter((u) => {
    const name = (u.displayName ?? '').toLowerCase();
    return name.includes(q) || u.email.toLowerCase().includes(q);
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      const u = filtered[activeIndex];
      onSelect(u.uid, u.displayName ?? u.email);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        {t('comments.mention.noUsers')}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label={t('comments.mention.placeholder')}
      className="rounded-md border border-border bg-popover shadow-md"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {filtered.map((u, i) => (
          <li
            key={u.uid}
            role="option"
            aria-selected={i === activeIndex}
            className={[
              'cursor-pointer px-3 py-1.5 text-xs',
              i === activeIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground hover:bg-accent/50',
            ].join(' ')}
            onMouseDown={() => onSelect(u.uid, u.displayName ?? u.email)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <span className="font-medium">{u.displayName ?? u.email}</span>
            {u.displayName && (
              <span className="ml-1 text-muted-foreground">{u.email}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
