'use client';

/**
 * PurchaseOrderKPIs — 7 KPI dashboard cards
 *
 * Responsive: 4 columns desktop, 2×2 mobile.
 *
 * @see ADR-267 §9.1 (KPI Cards)
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTypography } from '@/hooks/useTypography';
import { cn, getStatusColor } from '@/lib/design-system';
import {
  Package,
  Truck,
  DollarSign,
  AlertTriangle,
  PackageOpen,
  FileWarning,
  TrendingUp,
} from 'lucide-react';
import type { PurchaseOrder } from '@/types/procurement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { formatPOCurrencyRounded } from './utils/procurement-format';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success';
}

function KPICard({ label, value, icon, variant = 'default' }: KPICardProps) {
  const typography = useTypography();

  return (
    <Card className={cn(
      'relative overflow-hidden',
      variant === 'warning' && 'border-amber-300 dark:border-amber-700',
      variant === 'success' && 'border-emerald-300 dark:border-emerald-700',
    )}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          variant === 'default' && `${getStatusColor('active', 'bg')} ${getStatusColor('active', 'text')}`,
          variant === 'warning' && `${getStatusColor('construction', 'bg')} ${getStatusColor('construction', 'text')}`,
          variant === 'success' && `${getStatusColor('available', 'bg')} ${getStatusColor('available', 'text')}`,
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={cn(typography.label.sm, 'text-muted-foreground truncate')}>
            {label}
          </p>
          <p className={cn(typography.heading.h3, 'tabular-nums')}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface PurchaseOrderKPIsProps {
  purchaseOrders: PurchaseOrder[];
}

export function PurchaseOrderKPIs({ purchaseOrders }: PurchaseOrderKPIsProps) {
  const { t } = useTranslation('procurement');
  const kpis = useMemo(() => {
    const now = nowISO();
    const currentMonth = now.substring(0, 7); // YYYY-MM

    const active = purchaseOrders.filter((po) =>
      ['ordered', 'partially_delivered', 'delivered'].includes(po.status)
    );
    const pendingDelivery = purchaseOrders.filter((po) =>
      po.status === 'ordered'
    );
    const totalCommitted = active.reduce((s, po) => s + po.total, 0);
    const overdue = purchaseOrders.filter((po) =>
      po.dateNeeded &&
      po.dateNeeded < now &&
      ['ordered', 'partially_delivered'].includes(po.status)
    );
    const partial = purchaseOrders.filter((po) =>
      po.status === 'partially_delivered'
    );
    const awaitingInvoice = purchaseOrders.filter((po) =>
      po.status === 'delivered' && po.linkedInvoiceIds.length === 0
    );
    const monthlySpend = purchaseOrders
      .filter((po) =>
        po.dateOrdered?.startsWith(currentMonth) &&
        ['ordered', 'partially_delivered', 'delivered', 'closed'].includes(po.status)
      )
      .reduce((s, po) => s + po.total, 0);

    return {
      active: active.length,
      pendingDelivery: pendingDelivery.length,
      totalCommitted,
      overdue: overdue.length,
      partial: partial.length,
      awaitingInvoice: awaitingInvoice.length,
      monthlySpend,
    };
  }, [purchaseOrders]);

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
      <KPICard
        label={t('kpi.activePO')}
        value={kpis.active}
        icon={<Package className="h-5 w-5" />}
      />
      <KPICard
        label={t('kpi.pendingDelivery')}
        value={kpis.pendingDelivery}
        icon={<Truck className="h-5 w-5" />}
      />
      <KPICard
        label={t('kpi.totalCommitted')}
        value={formatPOCurrencyRounded(kpis.totalCommitted)}
        icon={<DollarSign className="h-5 w-5" />}
      />
      <KPICard
        label={t('kpi.overdue')}
        value={kpis.overdue}
        icon={<AlertTriangle className="h-5 w-5" />}
        variant={kpis.overdue > 0 ? 'warning' : 'default'}
      />
      <KPICard
        label={t('kpi.partialDelivery')}
        value={kpis.partial}
        icon={<PackageOpen className="h-5 w-5" />}
      />
      <KPICard
        label={t('kpi.awaitingInvoice')}
        value={kpis.awaitingInvoice}
        icon={<FileWarning className="h-5 w-5" />}
        variant={kpis.awaitingInvoice > 0 ? 'warning' : 'default'}
      />
      <KPICard
        label={t('kpi.monthlySpend')}
        value={formatPOCurrencyRounded(kpis.monthlySpend)}
        icon={<TrendingUp className="h-5 w-5" />}
        variant="success"
      />
    </section>
  );
}
