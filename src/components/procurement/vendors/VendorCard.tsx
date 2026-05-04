'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingUp, Clock, PackageCheck } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import type { SupplierMetrics } from '@/types/procurement';
import { getContactDisplayName, type Contact } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface VendorCardData {
  contact: Contact;
  metrics: SupplierMetrics | null;
}

interface VendorCardProps {
  data: VendorCardData;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorCard({ data }: VendorCardProps) {
  const { t } = useTranslation('procurement');
  const { contact, metrics } = data;

  const resolvedName = contact.displayName || contact.name || getContactDisplayName(contact);
  const displayName = (resolvedName && resolvedName.replace(/undefined/g, '').trim()) || contact.id || '';

  const tradeSpecialties = metrics?.tradeSpecialties ?? [];
  const hasOrders = metrics !== null && metrics.totalOrders > 0;

  return (
    <Card className="flex flex-col gap-0 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{displayName}</CardTitle>
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
        </div>
        {tradeSpecialties.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tradeSpecialties.slice(0, 3).map((code) => (
              <Badge key={code} variant="outline" className="text-xs px-1.5 py-0">
                {t(`trades.${code}`, { defaultValue: '' }) || code}
              </Badge>
            ))}
            {tradeSpecialties.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                +{tradeSpecialties.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {hasOrders ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <PackageCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              <dt className="sr-only">{t('hub.vendorMaster.totalOrders')}</dt>
              <dd className="font-medium">{metrics!.totalOrders}</dd>
              <span className="text-muted-foreground text-xs">
                {t('hub.vendorMaster.totalOrders')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              <dt className="sr-only">{t('hub.vendorMaster.onTimeRate')}</dt>
              <dd className="font-medium">{metrics!.onTimeDeliveryRate}%</dd>
              <span className="text-muted-foreground text-xs">
                {t('hub.vendorMaster.onTimeRate')}
              </span>
            </div>

            <div className="col-span-2 flex items-center gap-1.5">
              <dt className="text-muted-foreground">{t('hub.vendorMaster.totalSpend')}:</dt>
              <dd className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(metrics!.totalSpend)}
              </dd>
            </div>

            {metrics!.lastOrderDate && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                <dt className="sr-only">{t('hub.vendorMaster.lastOrder')}</dt>
                <dd>{t('hub.vendorMaster.lastOrder')}: {formatDate(metrics!.lastOrderDate)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('hub.vendorMaster.noOrders')}</p>
        )}
      </CardContent>
    </Card>
  );
}
