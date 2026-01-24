'use client';

/**
 * 📦 ENTERPRISE STORAGE GRID VIEW
 *
 * Full-width grid view for storage units.
 * Replaces the list+details layout when grid mode is selected.
 *
 * @fileoverview Storage grid view component (mirrors PropertyGridView pattern)
 * @enterprise Fortune 500 compliant
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Warehouse } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { Storage } from '@/types/storage/contracts';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Using centralized domain card
import { StorageGridCard } from '@/domain';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface StorageGridViewProps {
  /** Storage units to display */
  storages: Storage[];
  /** Currently selected storage */
  selectedStorage: Storage | null;
  /** Selection handler */
  onSelectStorage?: (storage: Storage) => void;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function StorageGridView({
  storages,
  selectedStorage,
  onSelectStorage,
}: StorageGridViewProps) {
  const { t } = useTranslation('storage');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Favorites state (local for now)
  const [favorites, setFavorites] = React.useState<string[]>([]);

  const toggleFavorite = (storageId: string) => {
    setFavorites(prev =>
      prev.includes(storageId)
        ? prev.filter(id => id !== storageId)
        : [...prev, storageId]
    );
  };

  // Empty state
  if (storages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${colors.text.muted} p-8`}>
        <Warehouse className={`${iconSizes.xl} mb-4 text-amber-500`} />
        <h2 className="text-xl font-semibold">{t('storages.list.noResults')}</h2>
        <p className="text-sm">{t('storages.list.noResultsHint')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full flex-1">
      {/* 🏢 ENTERPRISE: Full-width responsive grid */}
      <div className="w-full p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {storages.map((storage) => (
            <StorageGridCard
              key={storage.id}
              storage={storage}
              isSelected={selectedStorage?.id === storage.id}
              isFavorite={favorites.includes(storage.id)}
              onSelect={() => onSelectStorage?.(storage)}
              onToggleFavorite={() => toggleFavorite(storage.id)}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export default StorageGridView;
