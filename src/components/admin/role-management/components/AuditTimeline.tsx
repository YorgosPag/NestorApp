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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { calendarDayLabel, groupByCalendarDay } from '@/lib/audit/calendar-day-groups';
import type { FrontendAuditEntry } from '../types';
import { AUDIT_ACTION_DISPLAY } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface AuditTimelineProps {
  entries: FrontendAuditEntry[];
  onFilterByActor: (actorId: string) => void;
  onFilterByTarget: (targetId: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Πλήρης ημερομηνία με ημέρα εβδομάδας για τις παλαιότερες ομάδες (ίδια μορφή με πριν). */
function formatEarlierDay(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
  const colors = useSemanticColors();

  // ADR-327: ΤΟΠΙΚΗ ημέρα μέσω του SSoT — εδώ η ομαδοποίηση γινόταν σε UTC (`toISOString`), οπότε στην Ελλάδα μια
  // εγγραφή μετά τα μεσάνυχτα έπεφτε στην προηγούμενη ημέρα.
  const groups = useMemo(() => {
    const labels = {
      today: t('roleManagement.auditTab.today'),
      yesterday: t('roleManagement.auditTab.yesterday'),
      unknown: t('roleManagement.auditTab.unknownDate'),
    };
    return groupByCalendarDay(entries, (entry) => entry.timestamp).map((group) => ({
      key: group.dateKey,
      label: calendarDayLabel(group, labels, formatEarlierDay),
      entries: group.entries,
    }));
  }, [entries, t]);

  if (entries.length === 0) {
    return (
      <section className="py-12 text-center">
        <p className={colors.text.muted}>
          {t('roleManagement.auditTab.noEntries')}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {groups.map((group) => (
        <article key={group.key}>
          <h3 className={cn("mb-3 text-sm font-semibold uppercase tracking-wider", colors.text.muted)}>
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

                  <time className={cn("shrink-0 text-xs tabular-nums w-12", colors.text.muted)}>
                    {formatTime(entry.timestamp)}
                  </time>

                  <section className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline cursor-pointer"
                              onClick={() => onFilterByActor(entry.actorId)}
                            >
                              {entry.actorDisplayName ?? entry.actorId.slice(0, 12)}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{entry.actorId}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className={cn("mx-1.5", colors.text.muted)}>
                        {t(`roleManagement.auditActions.${entry.action}`, { defaultValue: '' }) || entry.action}
                      </span>
                      {entry.targetType === 'user' ? (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="font-medium text-primary hover:underline cursor-pointer"
                                onClick={() => onFilterByTarget(entry.targetId)}
                              >
                                {entry.targetDisplayName ?? entry.targetId.slice(0, 12)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{entry.targetId}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className={cn("font-mono text-xs", colors.text.muted)}>
                          {entry.targetId.slice(0, 16)}
                        </span>
                      )}
                    </p>

                    <footer className="flex items-center gap-2">
                      <Badge variant={badgeVariant} className="text-[10px]">
                        {actionConfig?.icon} {actionConfig?.label ?? entry.action}
                      </Badge>
                      {changeDesc && (
                        <span className={cn("text-xs truncate max-w-[300px]", colors.text.muted)}>
                          {changeDesc}
                        </span>
                      )}
                      {entry.metadata?.reason && (
                        <span className={cn("text-xs italic truncate max-w-[200px]", colors.text.muted)}>
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
