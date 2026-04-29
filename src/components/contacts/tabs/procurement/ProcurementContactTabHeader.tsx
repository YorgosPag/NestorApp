'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { FileText, Send, ShoppingCart, TrendingUp } from 'lucide-react';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';
import type { PurchaseOrder } from '@/types/procurement';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { computeKpis } from './procurement-tab-kpis';

interface ProcurementContactTabHeaderProps {
  quotes: Quote[];
  invites: VendorInvite[];
  purchaseOrders: PurchaseOrder[];
}

export function ProcurementContactTabHeader({
  quotes,
  invites,
  purchaseOrders,
}: ProcurementContactTabHeaderProps) {
  const { t } = useTranslation('contacts');
  const kpis = computeKpis({ quotes, invites, purchaseOrders });
  const currentYear = new Date().getFullYear();

  const dashboardStats: DashboardStat[] = [
    {
      title: t('procurementTab.kpis.openRfqs'),
      value: kpis.openRfqs,
      icon: Send,
      color: 'blue',
    },
    {
      title: t('procurementTab.kpis.activeQuotes'),
      value: kpis.activeQuotes,
      icon: FileText,
      color: 'cyan',
    },
    {
      title: t('procurementTab.kpis.recentPOs'),
      value: kpis.recentPOs,
      icon: ShoppingCart,
      color: 'green',
    },
    {
      title: t('procurementTab.kpis.totalSpendYtd', { year: currentYear }),
      value: formatCurrency(kpis.totalSpendYtd),
      icon: TrendingUp,
      color: 'orange',
    },
  ];

  return (
    <UnifiedDashboard
      stats={dashboardStats}
      columns={4}
      className=""
    />
  );
}
