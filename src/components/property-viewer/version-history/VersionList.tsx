'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { formatSize } from './version-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatDateTime as formatDate } from '@/lib/intl-utils';

export function VersionList({
  versions,
  selectedVersionId,
  onSelect,
}: {
  versions: any[];
  selectedVersionId: string | null;
  onSelect: (v: any) => void;
}) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
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
              ? 'border-primary bg-primary/10'
              : cn('border-border', INTERACTIVE_PATTERNS.SUBTLE_HOVER)
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{version.message}</h4>
                {version.type === 'milestone' && (
                  <CommonBadge
                    status="company"
                    customLabel="Ορόσημο"
                    variant="outline"
                    className="border-yellow-400 bg-yellow-50 text-yellow-700"
                  />
                )}
                {version.type === 'auto' && (
                  <CommonBadge
                    status="company"
                    customLabel="Auto"
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