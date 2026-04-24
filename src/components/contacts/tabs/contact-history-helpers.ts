/**
 * Contact Unified History — Helpers
 *
 * Merge, sort, group, filter, and stats logic for the unified contact timeline.
 *
 * @module components/contacts/tabs/contact-history-helpers
 */

import { formatDate, formatRelativeTime } from '@/lib/intl-utils';
import type { EntityAuditEntry, AuditAction } from '@/types/audit-trail';
import type { PhotoShareRecord } from '@/types/photo-share';
import type {
  ContactTimelineEntry,
  ContactHistoryFilter,
  GroupedTimelineDay,
  ContactHistoryStats,
} from './contact-history-types';

// ============================================================================
// TIMESTAMP EXTRACTION
// ============================================================================

/** Normalize any timestamp variant to a Date */
function toDate(value: Date | string | number | { seconds: number; nanoseconds: number }): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
}


// ============================================================================
// MERGE & SORT
// ============================================================================

export function mergeAndSort(
  auditEntries: EntityAuditEntry[],
  shares: PhotoShareRecord[],
): ContactTimelineEntry[] {
  const auditItems: ContactTimelineEntry[] = auditEntries.map((e) => ({
    kind: 'audit' as const,
    timestamp: e.timestamp ? toDate(e.timestamp) : new Date(0),
    entry: e,
  }));

  const shareItems: ContactTimelineEntry[] = shares.map((s) => ({
    kind: 'photo_share' as const,
    timestamp: toDate(s.createdAt),
    entry: s,
  }));

  const merged = [...auditItems, ...shareItems];
  merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return merged;
}

// ============================================================================
// GROUPING BY DATE
// ============================================================================

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function groupTimelineByDate(entries: ContactTimelineEntry[]): GroupedTimelineDay[] {
  if (entries.length === 0) return [];

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(yesterday);

  const groups = new Map<string, ContactTimelineEntry[]>();

  for (const entry of entries) {
    const dateKey = toDateKey(entry.timestamp);
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
    } else {
      const [y, m, d] = dateKey.split('-');
      dateLabel = formatDate(new Date(Number(y), Number(m) - 1, Number(d)));
    }

    return { dateLabel, dateKey, entries: dayEntries };
  });
}

// ============================================================================
// FILTERING
// ============================================================================

export function filterTimeline(
  entries: ContactTimelineEntry[],
  filter: ContactHistoryFilter,
): ContactTimelineEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'photo_share') return entries.filter((e) => e.kind === 'photo_share');
  return entries.filter((e) => e.kind === 'audit' && e.entry.action === filter);
}

// ============================================================================
// STATISTICS
// ============================================================================

export function computeContactStats(entries: ContactTimelineEntry[]): ContactHistoryStats {
  const byAction: Partial<Record<AuditAction, number>> = {};
  const fieldSet = new Set<string>();
  const userSet = new Set<string>();
  let auditCount = 0;
  let photoShareCount = 0;

  for (const item of entries) {
    if (item.kind === 'audit') {
      auditCount++;
      const e = item.entry;
      byAction[e.action] = (byAction[e.action] ?? 0) + 1;
      if (e.performedByName) userSet.add(e.performedByName);
      else if (e.performedBy) userSet.add(e.performedBy);
      for (const change of e.changes ?? []) {
        fieldSet.add(change.field);
      }
    } else {
      photoShareCount++;
    }
  }

  // Last change relative time (from most recent entry of either kind)
  let lastChangeRelative: string | null = null;
  if (entries.length > 0) {
    const newest = entries[0]; // already sorted descending
    if (!isNaN(newest.timestamp.getTime())) {
      lastChangeRelative = formatRelativeTime(newest.timestamp);
    }
  }

  return {
    total: entries.length,
    auditCount,
    photoShareCount,
    byAction,
    lastChangeRelative,
    uniqueFieldsChanged: fieldSet.size,
    uniqueUsers: userSet.size,
  };
}
