'use client';

/**
 * 📜 ContactHistoryTab — Unified contact history timeline
 *
 * Merges audit trail entries and photo share records into a single
 * chronological timeline with shared stats, filters, and day grouping.
 *
 * Replaces the previous dual-component layout (PhotoShareHistoryTab + ActivityTab).
 *
 * @module components/contacts/tabs/ContactHistoryTab
 * @enterprise ADR-195 — Entity Audit Trail
 */

import React, { useMemo, useState } from 'react';
import {
  Clock, History, ChevronDown, BarChart3, Filter,
  FileEdit, Users, ImageIcon,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useEntityAudit } from '@/hooks/useEntityAudit';
import { usePhotoShareHistory } from '@/hooks/usePhotoShareHistory';
import { formatRelativeTime, formatDateTime } from '@/lib/intl-utils';
import { StatsCard } from '@/components/property-management/dashboard/StatsCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ACTION_MAP, FILTER_OPTIONS } from '@/components/shared/audit/activity-tab-config';
import { formatDisplayValue } from '@/components/shared/audit/activity-tab-helpers';
import { ShareEntry } from './ShareEntryRenderer';
import {
  mergeAndSort,
  groupTimelineByDate,
  filterTimeline,
  computeContactStats,
} from './contact-history-helpers';
import type { ContactHistoryFilter } from './contact-history-types';
import type { EntityAuditEntry } from '@/types/audit-trail';
import { ENTITY_TYPES } from '@/config/domain-constants';

// ============================================================================
// EXTENDED FILTER OPTIONS (adds photo_share to audit filters)
// ============================================================================

const CONTACT_FILTER_OPTIONS: { value: ContactHistoryFilter; labelKey: string }[] = [
  ...FILTER_OPTIONS,
  { value: 'photo_share', labelKey: 'audit.filters.photo_share' },
];

// ============================================================================
// PROPS
// ============================================================================

interface ContactHistoryTabProps {
  contactId: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContactHistoryTab({ contactId }: ContactHistoryTabProps) {
  const { t } = useTranslation('common');
  const { t: tContacts } = useTranslation('contacts-core');
  const colors = useSemanticColors();
  const [activeFilter, setActiveFilter] = useState<ContactHistoryFilter>('all');

  // Data sources
  const { entries: auditEntries, isLoading: auditLoading, error: auditError, hasMore, loadMore } =
    useEntityAudit({ entityType: ENTITY_TYPES.CONTACT, entityId: contactId });
  const { shares, isLoading: sharesLoading, error: sharesError } =
    usePhotoShareHistory(contactId);

  const isLoading = auditLoading && auditEntries.length === 0 && shares.length === 0;
  const error = auditError ?? sharesError;

  // Merge, filter, group, stats
  const allEntries = useMemo(() => mergeAndSort(auditEntries, shares), [auditEntries, shares]);
  const filteredEntries = useMemo(() => filterTimeline(allEntries, activeFilter), [allEntries, activeFilter]);
  const groupedEntries = useMemo(() => groupTimelineByDate(filteredEntries), [filteredEntries]);
  const stats = useMemo(() => computeContactStats(allEntries), [allEntries]);

  return (
    <section className="space-y-4 p-4">
      {/* Header */}
      <header className={cn('flex items-center gap-2 text-sm font-medium', colors.text.muted)}>
        <History className="h-4 w-4" />
        <span>{t('audit.changeHistory')}</span>
      </header>

      {/* Statistics */}
      {allEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatsCard title={t('audit.totalLabel')} value={stats.total} icon={BarChart3} color="blue" />
          <StatsCard title={t('audit.stats.lastChange')} value={stats.lastChangeRelative ?? '—'} icon={Clock} color="gray" />
          <StatsCard title={t('audit.stats.fieldsChanged')} value={stats.uniqueFieldsChanged} icon={FileEdit} color="orange" />
          {stats.photoShareCount > 0
            ? <StatsCard title={t('audit.filters.photo_share')} value={stats.photoShareCount} icon={ImageIcon} color="teal" />
            : <StatsCard title={t('audit.stats.users')} value={stats.uniqueUsers} icon={Users} color="teal" />
          }
        </div>
      )}

      {/* Quick Filters */}
      {allEntries.length > 0 && (
        <nav className="flex flex-wrap gap-1.5" aria-label={t('audit.historyFilters')}>
          {CONTACT_FILTER_OPTIONS.map(({ value, labelKey }) => {
            const isActive = activeFilter === value;
            const count = value === 'all'
              ? stats.total
              : value === 'photo_share'
                ? stats.photoShareCount
                : (stats.byAction[value] ?? 0);

            if (value !== 'all' && count === 0) return null;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveFilter(isActive && value !== 'all' ? 'all' : value)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : `bg-muted/60 ${colors.text.muted} hover:bg-muted`
                }`}
              >
                {t(labelKey)}
                <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      )}

      {/* Empty */}
      {!isLoading && allEntries.length === 0 && !error && (
        <div className={cn('flex flex-col items-center justify-center py-12', colors.text.muted)}>
          <Clock className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">{t('audit.noHistory')}</p>
          <p className="text-xs opacity-60">{t('audit.changesWillAppear')}</p>
        </div>
      )}

      {/* Empty after filter */}
      {!isLoading && allEntries.length > 0 && filteredEntries.length === 0 && (
        <div className={cn('flex flex-col items-center justify-center py-8', colors.text.muted)}>
          <Filter className="mb-2 h-6 w-6 opacity-40" />
          <p className="text-sm">{t('audit.noFilterResults')}</p>
        </div>
      )}

      {/* Day-Grouped Timeline */}
      {groupedEntries.map(({ dateLabel, dateKey, entries: dayEntries }) => (
        <section key={dateKey}>
          {/* Day header */}
          <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
            <div className="h-px flex-1 bg-border" />
            <span className={cn('text-[11px] font-medium', colors.text.muted)}>{dateLabel}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Timeline entries */}
          <ol className="relative ml-3 space-y-0 border-l-2 border-muted">
            {dayEntries.map((item) =>
              item.kind === 'audit'
                ? <AuditEntryRenderer key={item.entry.id} entry={item.entry} t={t} colors={colors} />
                : <PhotoShareTimelineEntry key={item.entry.id} share={item.entry} t={tContacts} colors={colors} />,
            )}
          </ol>
        </section>
      ))}

      {/* Load more */}
      {hasMore && (
        <footer className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={auditLoading}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50',
              colors.text.muted,
            )}
          >
            {auditLoading ? <Spinner size="small" color="inherit" /> : <ChevronDown className="h-3 w-3" />}
            {t('audit.loadMore')}
          </button>
        </footer>
      )}
    </section>
  );
}

// ============================================================================
// AUDIT ENTRY RENDERER (mirrors ActivityTab's AuditEntryItem)
// ============================================================================

interface SemanticColors { text: { muted: string } }

function AuditEntryRenderer({ entry, t, colors }: { entry: EntityAuditEntry; t: (k: string, p?: Record<string, unknown>) => string; colors: SemanticColors }) {
  const config = ACTION_MAP[entry.action] ?? ACTION_MAP.updated;
  const Icon = config.icon;
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
  const relativeTime = timestamp ? formatRelativeTime(timestamp) : '';
  const absoluteTime = timestamp ? formatDateTime(timestamp) : '';

  const translateValue = (v: string): string | undefined => {
    const enumKey = `audit.values.${v}`;
    const result = t(enumKey);
    if (result !== enumKey) return result;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return undefined;
  };

  return (
    <li className="relative pb-5 pl-8 last:pb-0">
      <div className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background ${config.color}`}>
        <Icon className="h-2.5 w-2.5" />
      </div>
      <article className="space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>{t(config.labelKey)}</span>
          {entry.performedByName && (
            <span className={cn('text-xs', colors.text.muted)}>{t('audit.byUser', { name: entry.performedByName })}</span>
          )}
          {timestamp && (
            <time dateTime={entry.timestamp} className={cn('ml-auto text-[11px]', colors.text.muted)} title={absoluteTime}>
              {relativeTime}
            </time>
          )}
        </div>
        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change, idx) => (
              <li key={`${change.field}-${idx}`} className="rounded bg-muted/50 px-2.5 py-1 text-xs">
                <span className="font-medium">{change.label ?? change.field}</span>
                {': '}
                <span className={cn(colors.text.muted, 'line-through decoration-red-400/60')}>
                  {formatDisplayValue(change.oldValue, translateValue)}
                </span>
                {' → '}
                <span className="font-medium text-foreground">
                  {formatDisplayValue(change.newValue, translateValue)}
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
// PHOTO SHARE TIMELINE ENTRY (wraps ShareEntry in timeline dot styling)
// ============================================================================

function PhotoShareTimelineEntry({ share, t, colors }: { share: import('@/types/photo-share').PhotoShareRecord; t: (k: string, p?: Record<string, unknown>) => string; colors: SemanticColors }) {
  return (
    <li className="relative pb-5 pl-8 last:pb-0">
      <div className="absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background text-sky-600">
        <ImageIcon className="h-2.5 w-2.5" />
      </div>
      <ShareEntry share={share} t={t} />
    </li>
  );
}

export default ContactHistoryTab;
