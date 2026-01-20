'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatSize } from './version-utils';
import { formatDateTime as formatDate } from '@/lib/intl-utils';
import type { VersionHistoryItem } from './VersionList';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function VersionDetails({
  version,
  onRestore
}: {
  version: VersionHistoryItem | null;
  onRestore: (id: string) => void;
}) {
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  if (!version) {
    return (
      <div className="text-center text-muted-foreground pt-20">
        <p>{t('versionHistory.selectVersion')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h3 className="font-semibold text-lg">{t('versionHistory.details.title')}</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">ID:</span>
          <span className="ml-2 font-mono text-xs">{version.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('versionHistory.details.creator')}</span>
          <span className="ml-2">{version.author?.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('versionHistory.details.date')}</span>
          <span className="ml-2">{formatDate(version.timestamp)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('versionHistory.details.size')}</span>
          <span className="ml-2">{formatSize(version.size)}</span>
        </div>
      </div>

      {version.diff && (
        <div className={`bg-muted/50 p-3 ${quick.card} border`}>
          <h4 className="font-medium mb-2 text-sm">{t('versionHistory.details.changes')}</h4>
          <div className="text-sm space-y-1">
            <div className="text-green-600">+ {version.diff.added.length} {t('versionHistory.details.additions')}</div>
            <div className="text-blue-600">~ {version.diff.modified.length} {t('versionHistory.details.modifications')}</div>
            <div className="text-red-600">- {version.diff.removed.length} {t('versionHistory.details.deletions')}</div>
          </div>
        </div>
      )}

      {version.thumbnail && (
        <div>
          <h4 className="font-medium mb-2 text-sm">{t('versionHistory.details.preview')}</h4>
          <img src={version.thumbnail} alt="Version preview" className={`w-full ${quick.input} border`} />
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button onClick={() => onRestore(version.id)} className="flex-1">
          {t('versionHistory.actions.restore')}
        </Button>
        <Button variant="outline" className="flex-1">
          {t('versionHistory.actions.compare')}
        </Button>
      </div>
    </div>
  );
}