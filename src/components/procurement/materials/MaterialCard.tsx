'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Pencil, Trash2, Users2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Material } from '@/subapps/procurement/types/material';

interface MaterialCardProps {
  material: Material;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}

export function MaterialCard({ material, onEdit, onDelete }: MaterialCardProps) {
  const { t } = useTranslation('procurement');

  const supplierCount = material.preferredSupplierContactIds.length;
  const categoryLabel =
    t(`categories.${material.atoeCategoryCode}`, { defaultValue: '' }) ||
    material.atoeCategoryCode;

  return (
    <Card className="flex flex-col gap-0 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <CardTitle className="text-base leading-tight truncate">
              {material.name}
            </CardTitle>
            <code className="text-xs font-mono text-muted-foreground">
              {material.code}
            </code>
          </div>
          <Layers className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" aria-hidden />
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant="outline" className="text-xs">
            {categoryLabel}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {t(`hub.materialCatalog.units.${material.unit}`, { defaultValue: '' }) ||
              material.unit}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {material.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {material.description}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {material.lastPrice !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">
                {t('hub.materialCatalog.lastPrice')}
              </dt>
              <dd className="font-semibold">
                {formatCurrency(material.lastPrice)}
              </dd>
            </div>
          )}
          {material.avgPrice !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">
                {t('hub.materialCatalog.avgPrice')}
              </dt>
              <dd className="font-medium text-green-700 dark:text-green-400">
                {formatCurrency(material.avgPrice)}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users2 className="h-3 w-3" aria-hidden />
            <span>
              {t('hub.materialCatalog.supplierCount', { count: supplierCount })}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(material)}
              aria-label={t('hub.materialCatalog.edit')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(material)}
              aria-label={t('hub.materialCatalog.delete')}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
