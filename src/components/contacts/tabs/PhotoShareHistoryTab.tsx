'use client';

/**
 * @fileoverview Photo Share History Tab — shows photos shared with a contact via CRM channels.
 * Displays timeline with channel icon, photo thumbnails, status, and timestamp.
 * @module components/contacts/tabs/PhotoShareHistoryTab
 */

import React, { useMemo } from 'react';
import { ImageIcon, Send, AlertCircle, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { usePhotoShareHistory } from '@/hooks/usePhotoShareHistory';
import { getChannelIconComponent } from '@/lib/channel-icon-map';
import { formatRelativeTime, formatDateTime } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { PhotoShareRecord, PhotoShareStatus } from '@/types/photo-share';

// ============================================================================
// TYPES
// ============================================================================

interface PhotoShareHistoryTabProps {
  contactId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusConfig(status: PhotoShareStatus) {
  switch (status) {
    case 'sent':
      return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' };
    case 'partial':
      return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' };
    case 'failed':
      return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' };
  }
}

function groupByDate(shares: PhotoShareRecord[]): Map<string, PhotoShareRecord[]> {
  const groups = new Map<string, PhotoShareRecord[]>();
  for (const share of shares) {
    const date = share.createdAt instanceof Date
      ? share.createdAt
      : new Date(share.createdAt as unknown as string);
    const key = date.toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' });
    const existing = groups.get(key) ?? [];
    existing.push(share);
    groups.set(key, existing);
  }
  return groups;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatsHeader({ shares, t }: { shares: PhotoShareRecord[]; t: (key: string, params?: Record<string, unknown>) => string }) {
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shares) {
      counts[s.channel] = (counts[s.channel] ?? 0) + 1;
    }
    return counts;
  }, [shares]);

  const totalPhotos = useMemo(
    () => shares.reduce((acc, s) => acc + s.sentCount, 0),
    [shares],
  );

  return (
    <section className="grid grid-cols-2 gap-3 mb-6">
      <article className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('photoShareHistory.stats.totalShares')}</p>
        <p className="text-2xl font-semibold">{shares.length}</p>
      </article>
      <article className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('photoShareHistory.stats.totalPhotos')}</p>
        <p className="text-2xl font-semibold">{totalPhotos}</p>
      </article>
      {Object.entries(channelCounts).length > 1 && (
        <article className="col-span-2 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">{t('photoShareHistory.stats.byChannel')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(channelCounts).map(([channel, count]) => {
              const Icon = getChannelIconComponent(channel);
              return (
                <span key={channel} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  <Icon className="w-3.5 h-3.5" />
                  {channel} ({count})
                </span>
              );
            })}
          </div>
        </article>
      )}
    </section>
  );
}

function ShareEntry({ share, t }: { share: PhotoShareRecord; t: (key: string, params?: Record<string, unknown>) => string }) {
  const ChannelIcon = getChannelIconComponent(share.channel);
  const statusCfg = getStatusConfig(share.status);
  const createdDate = share.createdAt instanceof Date
    ? share.createdAt
    : new Date(share.createdAt as unknown as string);

  return (
    <article className="flex gap-3 py-3">
      {/* Channel icon */}
      <div className={cn('mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0', statusCfg.bg)}>
        <ChannelIcon className={cn('w-4 h-4', statusCfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header line */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {t('photoShareHistory.entry.photosShared', { count: share.sentCount })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('photoShareHistory.entry.via', { channel: share.channel })}
          </span>
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', statusCfg.bg, statusCfg.color)}>
            {t(`photoShareHistory.entry.status.${share.status}`)}
          </span>
        </div>

        {/* Recipient */}
        <p className="text-xs text-muted-foreground mt-0.5">
          → {share.externalUserId}
        </p>

        {/* Caption */}
        {share.caption && (
          <p className="text-xs text-muted-foreground mt-1 italic truncate">
            &ldquo;{share.caption}&rdquo;
          </p>
        )}

        {/* Photo thumbnails */}
        {share.photoUrls.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {share.photoUrls.slice(0, 5).map((url, i) => (
              <img
                key={`${share.id}-${i}`}
                src={url}
                alt={`${i + 1}`}
                className="w-12 h-12 rounded object-cover border shrink-0"
                loading="lazy"
              />
            ))}
            {share.photoUrls.length > 5 && (
              <span className="w-12 h-12 rounded border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                +{share.photoUrls.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1.5" title={formatDateTime(createdDate)}>
          <Clock className="w-3 h-3 inline-block mr-1 -mt-px" />
          {formatRelativeTime(createdDate)}
        </p>
      </div>
    </article>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PhotoShareHistoryTab({ contactId }: PhotoShareHistoryTabProps) {
  const { t } = useTranslation('contacts-core');
  const { shares, isLoading, error } = usePhotoShareHistory(contactId);

  // Group by date
  const groupedShares = useMemo(() => groupByDate(shares), [shares]);

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive gap-2">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Empty
  if (shares.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ImageIcon className="w-7 h-7" />
        </div>
        <p className="text-sm">{t('photoShareHistory.empty')}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* Stats */}
      <StatsHeader shares={shares} t={t} />

      {/* Timeline */}
      <div className="space-y-6">
        {Array.from(groupedShares.entries()).map(([dateLabel, dayShares]) => (
          <section key={dateLabel}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 sticky top-0 bg-background py-1">
              {dateLabel}
            </h3>
            <div className="divide-y">
              {dayShares.map((share) => (
                <ShareEntry key={share.id} share={share} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
