'use client';

/**
 * ADR-244 Phase B: Audit Timeline
 *
 * Renders audit log entries grouped by date in a timeline view.
 * Clickable actors/targets auto-populate filters.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import type { FrontendAuditEntry, AuditLogFilters } from '../types';
import { AUDIT_ACTION_DISPLAY } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface AuditTimelineProps {
  entries: FrontendAuditEntry[];
  onFilterByActor: (actorId: string) => void;
  onFilterByTarget: (targetId: string) => void;
}

interface DateGroup {
  label: string;
  entries: FrontendAuditEntry[];
}

// =============================================================================
// HELPERS
// =============================================================================

function getDateLabel(isoDate: string, today: string, yesterday: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const dateStr = date.toISOString().slice(0, 10);

  if (dateStr === todayStr) return today;
  if (dateStr === yesterdayStr) return yesterday;
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function groupByDate(entries: FrontendAuditEntry[], today: string, yesterday: string): DateGroup[] {
  const groups = new Map<string, FrontendAuditEntry[]>();

  for (const entry of entries) {
    const label = getDateLabel(entry.timestamp, today, yesterday);
    const existing = groups.get(label);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, entries: items }));
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getChangeDescription(entry: FrontendAuditEntry): string {
  const prev = entry.previousValue;
  const next = entry.newValue;

  if (entry.action === 'role_changed' && prev && next) {
    return `${String(prev.value)} → ${String(next.value)}`;
  }
  if (entry.action === 'member_added' && next) {
    const val = next.value as Record<string, unknown>;
    return `role: ${String(val.roleId ?? 'N/A')}`;
  }
  if (entry.action === 'member_removed') {
    return '';
  }
  if (next?.value && typeof next.value === 'string') {
    return next.value;
  }
  if (Array.isArray(next?.value)) {
    return (next.value as string[]).join(', ');
  }
  return '';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AuditTimeline({ entries, onFilterByActor, onFilterByTarget }: AuditTimelineProps) {
  const { t } = useTranslation('admin');

  const groups = useMemo(
    () => groupByDate(
      entries,
      t('roleManagement.auditTab.today', 'Today'),
      t('roleManagement.auditTab.yesterday', 'Yesterday')
    ),
    [entries, t]
  );

  if (entries.length === 0) {
    return (
      <section className="py-12 text-center">
        <p className="text-muted-foreground">
          {t('roleManagement.auditTab.noEntries', 'No audit log entries found.')}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {groups.map((group) => (
        <article key={group.label}>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {group.label}
          </h3>
          <ol className="space-y-2 border-l-2 border-muted pl-4">
            {group.entries.map((entry) => {
              const actionConfig = AUDIT_ACTION_DISPLAY[entry.action];
              const badgeVariant = actionConfig?.color ?? 'default';
              const changeDesc = getChangeDescription(entry);

              return (
                <li
                  key={entry.id}
                  className="relative flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors"
                >
                  {/* Timeline dot */}
                  <span
                    className="absolute -left-[1.35rem] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                    aria-hidden="true"
                  />

                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums w-12">
                    {formatTime(entry.timestamp)}
                  </time>

                  <section className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm">
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => onFilterByActor(entry.actorId)}
                        title={entry.actorId}
                      >
                        {entry.actorDisplayName ?? entry.actorId.slice(0, 12)}
                      </button>
                      <span className="mx-1.5 text-muted-foreground">
                        {actionConfig?.label ?? entry.action}
                      </span>
                      {entry.targetType === 'user' ? (
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() => onFilterByTarget(entry.targetId)}
                          title={entry.targetId}
                        >
                          {entry.targetDisplayName ?? entry.targetId.slice(0, 12)}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.targetId.slice(0, 16)}
                        </span>
                      )}
                    </p>

                    <footer className="flex items-center gap-2">
                      <Badge variant={badgeVariant} className="text-[10px]">
                        {actionConfig?.icon} {actionConfig?.label ?? entry.action}
                      </Badge>
                      {changeDesc && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {changeDesc}
                        </span>
                      )}
                      {entry.metadata?.reason && (
                        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          &mdash; {entry.metadata.reason}
                        </span>
                      )}
                    </footer>
                  </section>
                </li>
              );
            })}
          </ol>
        </article>
      ))}
    </section>
  );
}
