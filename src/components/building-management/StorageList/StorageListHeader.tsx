'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import {
  Layers,
  Table as TableIcon,
  Trash2
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageListHeaderProps {
  totalCount: number;
  selectedCount: number;
  onBulkDelete: () => void;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
}

export function StorageListHeader({
  totalCount,
  selectedCount,
  onBulkDelete,
  viewMode,
  setViewMode,
}: StorageListHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t('storageListHeader.results', { count: totalCount })}
        </span>
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-primary">
              • {t('storageListHeader.selected', { count: selectedCount })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              className={`text-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
            >
              <Trash2 className={`${iconSizes.sm} mr-1`} />
              {t('storageListHeader.deleteSelected')}
            </Button>
          </>
        )}
      </div>

      <nav className="flex items-center gap-2">
        <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('cards')}
        >
          <Layers className={`${iconSizes.sm} mr-2`} /> {t('storageListHeader.cardsView')}
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
        >
          <TableIcon className={`${iconSizes.sm} mr-2`} /> {t('storageListHeader.tableView')}
        </Button>
      </nav>
    </header>
  );
}
