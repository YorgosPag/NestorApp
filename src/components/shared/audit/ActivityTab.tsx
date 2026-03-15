/**
 * 📜 ActivityTab — Enterprise Entity Audit Trail Component
 *
 * Displays a vertical timeline of entity changes with:
 * - Statistics header (total + per action type)
 * - Quick filters by action type
 * - Day-grouped timeline entries
 * - Field-level diffs with human-readable nested object display
 * - Real-time updates via RealtimeService
 *
 * Generic — works for any entity type (unit, building, contact, etc.)
 *
 * @module components/shared/audit/ActivityTab
 * @enterprise ADR-195 — Entity Audit Trail
 */

'use client';

import { safeJsonParse } from '@/lib/json-utils';
import React, { useMemo, useState } from 'react';
import {
  Clock,
  Edit3,
  Trash2,
  Plus,
  Link2,
  Unlink,
  RefreshCw,
  History,
  ChevronDown,
  BarChart3,
  Filter,
  UserPlus,
  UserMinus,
  Mail,
  Receipt,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import { formatRelativeTime, formatDateTime, formatDate } from '@/lib/intl-utils';
import type { AuditEntityType, AuditAction, EntityAuditEntry } from '@/types/audit-trail';
import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { StatsCard } from '@/components/property-management/dashboard/StatsCard';

// ============================================================================
// ACTION CONFIG
// ============================================================================

interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}

const ACTION_MAP: Record<AuditAction, ActionConfig> = {
  created: { icon: Plus, label: 'Δημιουργία', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
  updated: { icon: Edit3, label: 'Ενημέρωση', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  deleted: { icon: Trash2, label: 'Διαγραφή', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
  status_changed: { icon: RefreshCw, label: 'Αλλαγή κατάστασης', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  linked: { icon: Link2, label: 'Σύνδεση', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  unlinked: { icon: Unlink, label: 'Αποσύνδεση', color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-950/30' },
  professional_assigned: { icon: UserPlus, label: 'Ανάθεση επαγγελματία', color: 'text-teal-600', bgColor: 'bg-teal-50 dark:bg-teal-950/30' },
  professional_removed: { icon: UserMinus, label: 'Αφαίρεση επαγγελματία', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  email_sent: { icon: Mail, label: 'Email εστάλη', color: 'text-sky-600', bgColor: 'bg-sky-50 dark:bg-sky-950/30' },
  invoice_created: { icon: Receipt, label: 'Δημιουργία παραστατικού', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
};

const FILTER_OPTIONS: { value: AuditAction | 'all'; label: string }[] = [
  { value: 'all', label: 'Όλα' },
  { value: 'updated', label: 'Ενημερώσεις' },
  { value: 'created', label: 'Δημιουργίες' },
  { value: 'deleted', label: 'Διαγραφές' },
  { value: 'status_changed', label: 'Κατάσταση' },
  { value: 'professional_assigned', label: 'Αναθέσεις' },
  { value: 'professional_removed', label: 'Αφαιρέσεις' },
  { value: 'email_sent', label: 'Email' },
  { value: 'invoice_created', label: 'Παραστατικά' },
];

// ============================================================================
// COMPONENT
// ============================================================================

interface ActivityTabProps extends TabComponentProps {
  entityType?: AuditEntityType;
  entityId?: string;
}

export function ActivityTab({ entityType, entityId, unit, data }: ActivityTabProps) {
  const resolvedEntityId = entityId
    ?? (unit as Record<string, unknown> | undefined)?.id as string | undefined
    ?? (data as Record<string, unknown> | undefined)?.id as string | undefined;

  const resolvedEntityType = entityType ?? 'unit';
  const [activeFilter, setActiveFilter] = useState<AuditAction | 'all'>('all');

  const { entries, isLoading, error, hasMore, loadMore } = useEntityAudit({
    entityType: resolvedEntityType,
    entityId: resolvedEntityId,
  });

  // Filter entries by action type
  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return entries;
    return entries.filter((e) => e.action === activeFilter);
  }, [entries, activeFilter]);

  // Group filtered entries by date
  const groupedEntries = useMemo(() => groupEntriesByDate(filteredEntries), [filteredEntries]);

  // Statistics
  const stats = useMemo(() => computeStats(entries), [entries]);

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
      {/* ── Header ── */}
      <header className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <History className="h-4 w-4" />
        <span>Ιστορικό αλλαγών</span>
      </header>

      {/* ── Statistics ── */}
      {entries.length > 0 && <StatsPanel stats={stats} />}

      {/* ── Quick Filters ── */}
      {entries.length > 0 && (
        <QuickFilters
          active={activeFilter}
          onChange={setActiveFilter}
          stats={stats}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Loading (initial) ── */}
      {isLoading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && entries.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Δεν υπάρχει ιστορικό αλλαγών</p>
          <p className="text-xs opacity-60">Οι αλλαγές θα εμφανίζονται εδώ αυτόματα</p>
        </div>
      )}

      {/* ── Empty after filter ── */}
      {!isLoading && entries.length > 0 && filteredEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Filter className="mb-2 h-6 w-6 opacity-40" />
          <p className="text-sm">Δεν βρέθηκαν αλλαγές για αυτό το φίλτρο</p>
        </div>
      )}

      {/* ── Day-Grouped Timeline ── */}
      {groupedEntries.map(({ dateLabel, dateKey, entries: dayEntries }) => (
        <DayGroup key={dateKey} dateLabel={dateLabel}>
          {dayEntries.map((entry) => (
            <AuditEntryItem key={entry.id} entry={entry} />
          ))}
        </DayGroup>
      ))}

      {/* ── Load more ── */}
      {hasMore && (
        <footer className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {isLoading ? (
              <Spinner size="small" color="inherit" />
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
// STATISTICS PANEL
// ============================================================================

interface Stats {
  total: number;
  byAction: Partial<Record<AuditAction, number>>;
}

function StatsPanel({ stats }: { stats: Stats }) {
  const visibleActions: AuditAction[] = [
    'updated', 'created', 'deleted', 'status_changed',
    'professional_assigned', 'professional_removed', 'email_sent', 'invoice_created',
  ];

  const actionColorMap: Record<string, string> = {
    created: 'green',
    updated: 'blue',
    deleted: 'red',
    status_changed: 'orange',
    professional_assigned: 'teal',
    professional_removed: 'orange',
    email_sent: 'sky',
    invoice_created: 'green',
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <StatsCard
        title="Συνολικά"
        value={stats.total}
        icon={BarChart3}
        color="gray"
      />
      {visibleActions.map((action) => {
        const config = ACTION_MAP[action];
        const count = stats.byAction[action] ?? 0;
        if (count === 0) return null;
        return (
          <StatsCard
            key={action}
            title={config.label}
            value={count}
            icon={config.icon}
            color={actionColorMap[action] ?? 'gray'}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// QUICK FILTERS
// ============================================================================

function QuickFilters({
  active,
  onChange,
  stats,
}: {
  active: AuditAction | 'all';
  onChange: (v: AuditAction | 'all') => void;
  stats: Stats;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Φίλτρα ιστορικού">
      {FILTER_OPTIONS.map(({ value, label }) => {
        const isActive = active === value;
        const count = value === 'all' ? stats.total : (stats.byAction[value] ?? 0);

        // Hide filter buttons with 0 entries (except "all")
        if (value !== 'all' && count === 0) return null;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(isActive && value !== 'all' ? 'all' : value)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {label}
            <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================================
// DAY GROUP
// ============================================================================

function DayGroup({ dateLabel, children }: { dateLabel: string; children: React.ReactNode }) {
  return (
    <section>
      {/* Day header */}
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground">{dateLabel}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Day entries */}
      <ol className="relative ml-3 space-y-0 border-l-2 border-muted">
        {children}
      </ol>
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
    <li className="relative pb-5 pl-8 last:pb-0">
      {/* Timeline dot */}
      <div
        className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background ${config.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>

      <article className="space-y-1">
        {/* Header: action + who + time */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {entry.performedByName && (
            <span className="text-xs text-muted-foreground">
              από {entry.performedByName}
            </span>
          )}
          {timestamp && (
            <time
              dateTime={entry.timestamp}
              className="ml-auto text-[11px] text-muted-foreground"
              title={absoluteTime}
            >
              {relativeTime}
            </time>
          )}
        </div>

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
                <span className="font-medium text-foreground">
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

/** Nested object key labels for human-readable display */
const NESTED_KEY_LABELS: Record<string, string> = {
  bedrooms: 'Υ/Δ', bathrooms: 'Μπάνια', wc: 'WC',
  gross: 'Μικτό', net: 'Καθαρό', balcony: 'Μπαλκόνι',
  terrace: 'Βεράντα', garden: 'Κήπος',
  class: 'Κλάση',
  flooring: 'Δάπεδο', windowFrames: 'Κουφώματα', glazing: 'Υαλοπίνακες',
  heatingType: 'Θέρμανση', coolingType: 'Ψύξη',
};

function formatDisplayValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  if (value === '') return '—';

  // Try to parse JSON objects/arrays for human-readable display
  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    const parsed = safeJsonParse<unknown>(value, undefined);
    if (parsed !== undefined) {
      if (Array.isArray(parsed)) {
        return parsed.length === 0 ? '—' : parsed.join(', ');
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${NESTED_KEY_LABELS[k] ?? k}: ${v}`)
          .join(', ');
      }
    }
  }

  return String(value);
}

/** Group entries by calendar date */
function groupEntriesByDate(entries: EntityAuditEntry[]): { dateLabel: string; dateKey: string; entries: EntityAuditEntry[] }[] {
  if (entries.length === 0) return [];

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(yesterday);

  const groups = new Map<string, EntityAuditEntry[]>();

  for (const entry of entries) {
    const dateKey = entry.timestamp ? toDateKey(new Date(entry.timestamp)) : 'unknown';
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([dateKey, dayEntries]) => {
    let dateLabel: string;
    if (dateKey === todayKey) {
      dateLabel = 'Σήμερα';
    } else if (dateKey === yesterdayKey) {
      dateLabel = 'Χθες';
    } else if (dateKey === 'unknown') {
      dateLabel = 'Άγνωστη ημερομηνία';
    } else {
      // Parse the dateKey back to display
      const [y, m, d] = dateKey.split('-');
      dateLabel = formatDate(new Date(Number(y), Number(m) - 1, Number(d)));
    }

    return { dateLabel, dateKey, entries: dayEntries };
  });
}

/** Create a YYYY-MM-DD key from a date */
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Compute statistics from entries */
function computeStats(entries: EntityAuditEntry[]): Stats {
  const byAction: Partial<Record<AuditAction, number>> = {};
  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
  }
  return { total: entries.length, byAction };
}

export default ActivityTab;
