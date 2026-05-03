'use client';

import { Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MaterialCard } from './MaterialCard';
import type { Material } from '@/subapps/procurement/types/material';

interface MaterialListProps {
  materials: Material[];
  loading: boolean;
  hasFilters: boolean;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}

function MaterialGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-lg" />
      ))}
    </div>
  );
}

export function MaterialList({
  materials,
  loading,
  hasFilters,
  onEdit,
  onDelete,
}: MaterialListProps) {
  const { t } = useTranslation('procurement');

  if (loading) {
    return <MaterialGridSkeleton />;
  }

  if (materials.length === 0) {
    if (hasFilters) {
      return (
        <p className="py-10 text-center text-muted-foreground">
          {t('hub.materialCatalog.emptySearch')}
        </p>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Layers className="h-12 w-12 text-muted-foreground opacity-40" aria-hidden />
        <p className="text-muted-foreground">
          {t('hub.materialCatalog.noMaterialsYet')}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('hub.materialCatalog.addMaterialHint')}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={t('hub.materialCatalog.title')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {materials.map((m) => (
        <MaterialCard
          key={m.id}
          material={m}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
