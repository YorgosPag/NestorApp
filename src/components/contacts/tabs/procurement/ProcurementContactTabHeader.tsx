'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { FileText, Send, ShoppingCart, TrendingUp } from 'lucide-react';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';
import type { PurchaseOrder } from '@/types/procurement';
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

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <KpiTile
          icon={<Send className="h-4 w-4" />}
          label={t('procurementTab.kpis.openRfqs')}
          value={String(kpis.openRfqs)}
        />
        <KpiTile
          icon={<FileText className="h-4 w-4" />}
          label={t('procurementTab.kpis.activeQuotes')}
          value={String(kpis.activeQuotes)}
        />
        <KpiTile
          icon={<ShoppingCart className="h-4 w-4" />}
          label={t('procurementTab.kpis.recentPOs')}
          value={String(kpis.recentPOs)}
        />
        <KpiTile
          icon={<TrendingUp className="h-4 w-4" />}
          label={t('procurementTab.kpis.totalSpendYtd', { year: currentYear })}
          value={formatCurrency(kpis.totalSpendYtd)}
        />
      </CardContent>
    </Card>
  );
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function KpiTile({ icon, label, value }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}
