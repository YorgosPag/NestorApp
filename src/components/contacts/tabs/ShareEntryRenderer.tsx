'use client';

/**
 * ShareEntry — Reusable renderer for photo share timeline entries.
 * Extracted from PhotoShareHistoryTab for use in the unified ContactHistoryTab.
 *
 * @module components/contacts/tabs/ShareEntryRenderer
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { getChannelIconComponent } from '@/lib/channel-icon-map';
import { formatRelativeTime, formatDateTime } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { PhotoShareRecord, PhotoShareStatus } from '@/types/photo-share';

// ============================================================================
// HELPERS
// ============================================================================

export function getStatusConfig(status: PhotoShareStatus) {
  switch (status) {
    case 'sent':
      return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' };
    case 'partial':
      return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' };
    case 'failed':
      return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' };
  }
}

// ============================================================================
// SHARE ENTRY COMPONENT
// ============================================================================

interface ShareEntryProps {
  share: PhotoShareRecord;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function ShareEntry({ share, t }: ShareEntryProps) {
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
