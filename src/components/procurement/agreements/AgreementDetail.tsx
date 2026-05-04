'use client';

import { useMemo } from 'react';
import { ScrollText, Pencil, Trash2, Calendar, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';

interface AgreementDetailProps {
  agreement: FrameworkAgreement;
  onEdit: (agreement: FrameworkAgreement) => void;
  onDelete: (agreement: FrameworkAgreement) => void;
}

const STATUS_STYLE: Record<FrameworkAgreementStatus, string> = {
  draft:      'bg-gray-100 text-gray-700',
  active:     'bg-green-100 text-green-700',
  expired:    'bg-orange-100 text-orange-700',
  terminated: 'bg-red-100 text-red-700',
};

function daysUntil(ts: { toDate: () => Date }): number {
  const ms = ts.toDate().getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function AgreementDetail({ agreement, onEdit, onDelete }: AgreementDetailProps) {
  const { t } = useTranslation('procurement');
  const { suppliers } = usePOSupplierContacts();

  const vendorName = useMemo(() => {
    const c = suppliers.find((s) => s.id === agreement.vendorContactId);
    return c ? getContactDisplayName(c) : agreement.vendorContactId;
  }, [suppliers, agreement.vendorContactId]);

  const remaining = daysUntil(agreement.validUntil);
  const isExpired = remaining < 0;

  return (
    <article className="flex flex-col gap-5 p-1">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
            <ScrollText className="h-5 w-5 text-purple-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{agreement.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                {agreement.agreementNumber}
              </code>
              <span
                className={cn(
                  'text-xs rounded px-1.5 py-0.5 font-medium',
                  STATUS_STYLE[agreement.status],
                )}
              >
                {t(`hub.frameworkAgreements.status.${agreement.status}`)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onEdit(agreement)}>
            <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
            {t('hub.frameworkAgreements.edit')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(agreement)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      {agreement.description && (
        <p className="text-sm text-muted-foreground">{agreement.description}</p>
      )}

      <Separator />

      {/* Vendor + Validity */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Building2 className="h-3 w-3" aria-hidden />
            {t('hub.frameworkAgreements.detail.vendor')}
          </dt>
          <dd className="text-sm font-medium">{vendorName}</dd>
        </div>

        {agreement.totalCommitment !== null && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1">
              {t('hub.frameworkAgreements.detail.commitment')}
            </dt>
            <dd className="text-sm font-semibold">
              {formatCurrency(agreement.totalCommitment)}
            </dd>
          </div>
        )}

        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Calendar className="h-3 w-3" aria-hidden />
            {t('hub.frameworkAgreements.detail.validityPeriod')}
          </dt>
          <dd className="text-sm">
            {formatDate(agreement.validFrom.toDate())} → {formatDate(agreement.validUntil.toDate())}
            <span className={cn('ml-2 text-xs', isExpired ? 'text-red-600' : 'text-muted-foreground')}>
              {isExpired
                ? t('hub.frameworkAgreements.detail.expired')
                : t('hub.frameworkAgreements.detail.daysRemaining', { count: remaining })}
            </span>
          </dd>
        </div>
      </section>

      <Separator />

      {/* Discount Terms */}
      <section>
        <h3 className="text-sm font-medium mb-3">
          {t('hub.frameworkAgreements.detail.discountTerms')}
        </h3>

        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">
            {t(`hub.frameworkAgreements.discount.type.${agreement.discountType}`)}
          </Badge>
        </div>

        {agreement.discountType === 'flat' && agreement.flatDiscountPercent !== null && (
          <p className="text-base font-semibold">
            {t('hub.frameworkAgreements.detail.flatDiscount')}: {agreement.flatDiscountPercent}%
          </p>
        )}

        {agreement.discountType === 'volume_breakpoints' &&
          agreement.volumeBreakpoints.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">
                    {t('hub.frameworkAgreements.detail.breakpointsHeader')}
                  </th>
                  <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">
                    {t('hub.frameworkAgreements.discount.label')} %
                  </th>
                </tr>
              </thead>
              <tbody>
                {agreement.volumeBreakpoints.map((bp, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-1.5">{formatCurrency(bp.thresholdEur)}</td>
                    <td className="py-1.5 text-right font-medium">{bp.discountPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </article>
  );
}
