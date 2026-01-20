'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { formatSize } from './version-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDateTime as formatDate } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Version history item type
export interface VersionHistoryItem {
  id: string;
  message: string;
  type: 'milestone' | 'auto' | 'manual';
  timestamp: string | Date;
  author?: { name: string; id?: string };
  stats: { polygons: number; objects: number };
  size: number;
  thumbnail?: string;
  diff?: {
    added: unknown[];
    modified: unknown[];
    removed: unknown[];
  };
}

export function VersionList({
  versions,
  selectedVersionId,
  onSelect,
}: {
  versions: VersionHistoryItem[];
  selectedVersionId: string | null;
  onSelect: (v: VersionHistoryItem) => void;
}) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className="p-4 space-y-2">
      {versions.map(version => (
        <div
          key={version.id}
          onClick={() => onSelect(version)}
          className={cn(
            `p-4 ${quick.card} cursor-pointer`,
            TRANSITION_PRESETS.STANDARD_ALL,
            selectedVersionId === version.id
              ? `${getStatusBorder('info')} bg-primary/10`
              : cn(quick.card, INTERACTIVE_PATTERNS.SUBTLE_HOVER)
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{version.message}</h4>
                {version.type === 'milestone' && (
                  <CommonBadge
                    status="company"
                    customLabel={t('versionHistory.badge.milestone')}
                    variant="outline"
                    className={`${getStatusBorder('warning')} ${colors.bg.warning} text-yellow-700`}
                  />
                )}
                {version.type === 'auto' && (
                  <CommonBadge
                    status="company"
                    customLabel={t('versionHistory.badge.auto')}
                    variant="secondary"
                  />
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {version.author?.name} • {formatDate(version.timestamp)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {version.stats.polygons} polygons • {version.stats.objects} objects • {formatSize(version.size)}
              </div>
            </div>
            {version.thumbnail && (
              <img src={version.thumbnail} alt="Thumbnail" className={`${iconSizes.xl4} object-cover ${quick.input} ml-4 border`} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}