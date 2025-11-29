'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { formatDate, formatSize } from './version-utils';

export function VersionList({
  versions,
  selectedVersionId,
  onSelect,
}: {
  versions: any[];
  selectedVersionId: string | null;
  onSelect: (v: any) => void;
}) {
  return (
    <div className="p-4 space-y-2">
      {versions.map(version => (
        <div
          key={version.id}
          onClick={() => onSelect(version)}
          className={`p-4 border rounded-lg cursor-pointer transition-all ${
            selectedVersionId === version.id
              ? 'border-primary bg-primary/10'
              : 'border-border hover:bg-muted/50'
          }`}
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
              <img src={version.thumbnail} alt="Thumbnail" className="w-16 h-16 object-cover rounded ml-4 border" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}