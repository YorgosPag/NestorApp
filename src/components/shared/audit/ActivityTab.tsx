/**
 * 📜 ActivityTab — Shared Entity Audit Trail Component
 *
 * Displays a vertical timeline of entity changes.
 * Generic — works for any entity type (unit, building, contact, etc.)
 *
 * @module components/shared/audit/ActivityTab
 * @enterprise ADR-195 — Entity Audit Trail
 */

'use client';

import React from 'react';
import {
  Clock,
  Edit3,
  Trash2,
  Plus,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  History,
  ChevronDown,
} from 'lucide-react';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import { formatRelativeTime, formatDateTime } from '@/lib/intl-utils';
import type { AuditEntityType, AuditAction, EntityAuditEntry } from '@/types/audit-trail';
import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';

// ============================================================================
// ACTION CONFIG
// ============================================================================

interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const ACTION_MAP: Record<AuditAction, ActionConfig> = {
  created: { icon: Plus, label: 'Δημιουργήθηκε', color: 'text-emerald-600' },
  updated: { icon: Edit3, label: 'Ενημερώθηκε', color: 'text-blue-600' },
  deleted: { icon: Trash2, label: 'Διαγράφηκε', color: 'text-red-600' },
  status_changed: { icon: RefreshCw, label: 'Αλλαγή κατάστασης', color: 'text-amber-600' },
  linked: { icon: Link2, label: 'Συνδέθηκε', color: 'text-purple-600' },
  unlinked: { icon: Unlink, label: 'Αποσυνδέθηκε', color: 'text-gray-600' },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ActivityTabProps extends TabComponentProps {
  entityType?: AuditEntityType;
  entityId?: string;
}

export function ActivityTab({ entityType, entityId, unit, data }: ActivityTabProps) {
  // Resolve entityId from props (direct or from unit/data objects)
  const resolvedEntityId = entityId
    ?? (unit as Record<string, unknown> | undefined)?.id as string | undefined
    ?? (data as Record<string, unknown> | undefined)?.id as string | undefined;

  const resolvedEntityType = entityType ?? 'unit';

  const { entries, isLoading, error, hasMore, loadMore } = useEntityAudit({
    entityType: resolvedEntityType,
    entityId: resolvedEntityId,
  });

  if (!resolvedEntityId) {
    return (
      <section className="flex items-center justify-center p-8 text-muted-foreground">
        <History className="mr-2 h-5 w-5" />
        <span>Δεν βρέθηκε αναγνωριστικό οντότητας</span>
      </section>
    );
  }

  return (
    <section className="space-y-4 p-4">
      <header className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <History className="h-4 w-4" />
        <span>Ιστορικό αλλαγών</span>
      </header>

      {/* Error state */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Loading state (initial) */}
      {isLoading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Δεν υπάρχει ιστορικό αλλαγών</p>
          <p className="text-xs opacity-60">
            Οι αλλαγές θα εμφανίζονται εδώ αυτόματα
          </p>
        </div>
      )}

      {/* Timeline */}
      {entries.length > 0 && (
        <ol className="relative border-l-2 border-muted ml-3 space-y-0">
          {entries.map((entry) => (
            <AuditEntryItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      {/* Load more */}
      {hasMore && (
        <footer className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Περισσότερα
          </button>
        </footer>
      )}
    </section>
  );
}

// ============================================================================
// TIMELINE ENTRY
// ============================================================================

function AuditEntryItem({ entry }: { entry: EntityAuditEntry }) {
  const config = ACTION_MAP[entry.action] ?? ACTION_MAP.updated;
  const Icon = config.icon;

  const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
  const relativeTime = timestamp ? formatRelativeTime(timestamp) : '';
  const absoluteTime = timestamp ? formatDateTime(timestamp) : '';

  return (
    <li className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline dot */}
      <div
        className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border-2 border-muted ${config.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>

      <article className="space-y-1">
        {/* Header: action + who */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {entry.performedByName && (
            <span className="text-xs text-muted-foreground">
              από {entry.performedByName}
            </span>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <time
            dateTime={entry.timestamp}
            className="block text-xs text-muted-foreground"
            title={absoluteTime}
          >
            {relativeTime}
          </time>
        )}

        {/* Field-level changes */}
        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change, idx) => (
              <li
                key={`${change.field}-${idx}`}
                className="rounded bg-muted/50 px-2.5 py-1 text-xs"
              >
                <span className="font-medium">{change.label ?? change.field}</span>
                {': '}
                <span className="text-muted-foreground line-through decoration-red-400/60">
                  {formatDisplayValue(change.oldValue)}
                </span>
                {' → '}
                <span className="text-foreground font-medium">
                  {formatDisplayValue(change.newValue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDisplayValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  if (value === '') return '—';
  return String(value);
}

export default ActivityTab;
