'use client';

import { Layers } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { EntityListColumn } from '@/core/containers';
import type { Material } from '@/subapps/procurement/types/material';

interface MaterialSlimListProps {
  materials: Material[];
  loading: boolean;
  hasFilters: boolean;
  selectedMaterialId: string | undefined;
  onSelectMaterial: (material: Material) => void;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-md" />
      ))}
    </div>
  );
}

export function MaterialSlimList({
  materials,
  loading,
  hasFilters,
  selectedMaterialId,
  onSelectMaterial,
}: MaterialSlimListProps) {
  const { t } = useTranslation('procurement');

  return (
    <EntityListColumn aria-label={t('hub.materialCatalog.title')}>
      <ScrollArea className="flex-1">
        {loading ? (
          <ListSkeleton />
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
            <Layers className="h-8 w-8 text-muted-foreground opacity-40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? t('hub.materialCatalog.emptySearch')
                : t('hub.materialCatalog.noMaterialsYet')}
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {materials.map((m) => {
              const isSelected = m.id === selectedMaterialId;
              const categoryLabel =
                t(`categories.${m.atoeCategoryCode}`, { defaultValue: '' }) ||
                m.atoeCategoryCode;

              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-accent/60 transition-colors',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => onSelectMaterial(m)}
                    aria-pressed={isSelected}
                  >
                    <span className="text-sm font-medium truncate">{m.name}</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-muted-foreground font-mono">{m.code}</code>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                        {categoryLabel}
                      </Badge>
                      {m.lastPrice !== null && (
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {formatCurrency(m.lastPrice)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
