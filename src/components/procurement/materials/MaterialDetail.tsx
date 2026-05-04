'use client';

import { useMemo } from 'react';
import { Layers, Pencil, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import type { Material } from '@/subapps/procurement/types/material';

interface MaterialDetailProps {
  material: Material;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}

export function MaterialDetail({ material, onEdit, onDelete }: MaterialDetailProps) {
  const { t } = useTranslation('procurement');
  const { suppliers } = usePOSupplierContacts();

  const categoryLabel =
    t(`categories.${material.atoeCategoryCode}`, { defaultValue: '' }) ||
    material.atoeCategoryCode;

  const unitLabel =
    t(`hub.materialCatalog.units.${material.unit}`, { defaultValue: '' }) || material.unit;

  const preferredSupplierNames = useMemo(() => {
    const nameMap = new Map(suppliers.map((c) => [c.id ?? '', getContactDisplayName(c)]));
    return material.preferredSupplierContactIds.map(
      (id) => nameMap.get(id) ?? id,
    );
  }, [suppliers, material.preferredSupplierContactIds]);

  return (
    <article className="flex flex-col gap-5 p-1">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
            <Layers className="h-5 w-5 text-yellow-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{material.name}</h2>
            <div className="flex flex-wrap gap-1 mt-0.5">
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                {material.code}
              </code>
              <Badge variant="outline" className="text-xs">{categoryLabel}</Badge>
              <Badge variant="secondary" className="text-xs">{unitLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onEdit(material)}>
            <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
            {t('hub.materialCatalog.edit')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(material)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      {material.description && (
        <p className="text-sm text-muted-foreground">{material.description}</p>
      )}

      <Separator />

      {/* Prices */}
      <section aria-label={t('hub.materialCatalog.detail.priceHistory')}>
        <h3 className="text-sm font-medium mb-3">{t('hub.materialCatalog.detail.priceHistory')}</h3>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t('hub.materialCatalog.lastPrice')}</dt>
            <dd className="text-base font-semibold mt-0.5">
              {material.lastPrice !== null ? formatCurrency(material.lastPrice) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('hub.materialCatalog.avgPrice')}</dt>
            <dd className="text-base font-semibold mt-0.5 text-green-700 dark:text-green-400">
              {material.avgPrice !== null ? formatCurrency(material.avgPrice) : '—'}
            </dd>
          </div>
          {material.lastPurchaseDate && (
            <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span>{formatDate(material.lastPurchaseDate.toDate())}</span>
            </div>
          )}
        </dl>
      </section>

      <Separator />

      {/* Preferred Suppliers */}
      <section>
        <h3 className="text-sm font-medium mb-3">{t('hub.materialCatalog.detail.preferredSuppliers')}</h3>
        {preferredSupplierNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('hub.materialCatalog.detail.noPreferredSuppliers')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {preferredSupplierNames.map((name, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
