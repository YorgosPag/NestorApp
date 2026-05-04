'use client';

import { useMemo } from 'react';
import { Layers, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
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
    return material.preferredSupplierContactIds.map((id) => nameMap.get(id) ?? id);
  }, [suppliers, material.preferredSupplierContactIds]);

  const subtitle = `${material.code} · ${categoryLabel} · ${unitLabel}`;

  return (
    <article className="flex flex-col gap-5">
      <EntityDetailsHeader
        icon={Layers}
        title={material.name}
        subtitle={subtitle}
        variant="detailed"
        actions={[
          createEntityAction('edit', t('hub.materialCatalog.edit'), () => onEdit(material)),
          createEntityAction('delete', t('hub.materialCatalog.delete'), () => onDelete(material)),
        ]}
      />

      {material.description && (
        <p className="text-sm text-muted-foreground">{material.description}</p>
      )}

      <Separator />

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

      <Badge variant="outline" className="self-start text-xs">
        {unitLabel}
      </Badge>
    </article>
  );
}
