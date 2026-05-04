'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ExternalLink, PackageCheck, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useVendorPurchaseOrders } from '@/hooks/procurement/useVendorPurchaseOrders';
import { useSupplierMetrics } from '@/hooks/procurement/useSupplierMetrics';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { PO_STATUS_META } from '@/types/procurement';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { VendorCardData } from './VendorCard';

interface VendorDetailProps {
  data: VendorCardData;
}

const COLOR_MAP: Record<string, string> = {
  gray:    'bg-gray-100 text-gray-700',
  blue:    'bg-blue-100 text-blue-700',
  yellow:  'bg-yellow-100 text-yellow-700',
  orange:  'bg-orange-100 text-orange-700',
  green:   'bg-green-100 text-green-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red:     'bg-red-100 text-red-700',
};

export function VendorDetail({ data }: VendorDetailProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const contactId = data.contact.id ?? null;
  const displayName = getContactDisplayName(data.contact);

  const { metrics, isLoading: metricsLoading } = useSupplierMetrics(contactId);
  const { purchaseOrders, loading: posLoading } = useVendorPurchaseOrders(contactId);

  const recentPos = useMemo(
    () => [...purchaseOrders].sort((a, b) => b.dateCreated.localeCompare(a.dateCreated)).slice(0, 5),
    [purchaseOrders],
  );

  const tradeSpecialties = metrics?.tradeSpecialties ?? data.metrics?.tradeSpecialties ?? [];
  const subtitle = tradeSpecialties.length > 0
    ? tradeSpecialties.slice(0, 4).map((c) => t(`trades.${c}`, { defaultValue: '' }) || c).join(' · ')
    : undefined;

  return (
    <article className="flex flex-col gap-5">
      <EntityDetailsHeader
        icon={Building2}
        title={displayName}
        subtitle={subtitle}
        variant="detailed"
        actions={contactId
          ? [createEntityAction(
              'view',
              t('hub.vendorMaster.detail.viewInCrm'),
              () => router.push(`/contacts/${contactId}`),
              { icon: ExternalLink },
            )]
          : []}
      />

      {metricsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : metrics ? (
        <section aria-label={t('hub.vendorMaster.detail.kpis.totalOrders')}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              icon={<PackageCheck className="h-4 w-4 text-muted-foreground" />}
              label={t('hub.vendorMaster.detail.kpis.totalOrders')}
              value={String(metrics.totalOrders)}
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              label={t('hub.vendorMaster.detail.kpis.totalSpend')}
              value={formatCurrency(metrics.totalSpend)}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              label={t('hub.vendorMaster.detail.kpis.onTimeRate')}
              value={`${metrics.onTimeDeliveryRate}%`}
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              label={t('hub.vendorMaster.detail.kpis.avgOrderValue')}
              value={formatCurrency(metrics.averageOrderValue)}
            />
          </div>
          {metrics.lastOrderDate && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {t('hub.vendorMaster.lastOrder')}: {formatDate(metrics.lastOrderDate)}
            </p>
          )}
        </section>
      ) : null}

      <Separator />

      <section>
        <h3 className="text-sm font-medium mb-3">{t('hub.vendorMaster.detail.recentOrders')}</h3>
        {posLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded" />
            ))}
          </div>
        ) : recentPos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hub.vendorMaster.detail.noRecentOrders')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recentPos.map((po) => {
              const meta = PO_STATUS_META[po.status];
              return (
                <li
                  key={po.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs font-medium">{po.poNumber}</span>
                  <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${COLOR_MAP[meta.color] ?? ''}`}>
                    {meta.label.el}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(po.dateCreated)}</span>
                  <span className="font-medium">{formatCurrency(po.total)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}
