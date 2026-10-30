'use client';

import { useMemo } from 'react';
import { ScrollText, Calendar, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/design-system';
import { AGREEMENT_STATUS_BADGE_VARIANTS } from '@/domain/cards/agreement/agreement-card-model';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { AgreementScopeSummary } from './AgreementScopeSummary';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

interface AgreementDetailProps {
  agreement: FrameworkAgreement;
  onEdit: (agreement: FrameworkAgreement) => void;
  onDelete: (agreement: FrameworkAgreement) => void;
  onCreateNew?: () => void;
}

function daysUntil(ts: { toDate: () => Date }): number {
  const ms = ts.toDate().getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function AgreementDetail({ agreement, onEdit, onDelete, onCreateNew }: AgreementDetailProps) {
  const { t } = useTranslation('procurement');
  const { suppliers } = usePOSupplierContacts();

  const vendorName = useMemo(() => {
    const c = suppliers.find((s) => s.id === agreement.vendorContactId);
    return c ? getContactDisplayName(c) : agreement.vendorContactId;
  }, [suppliers, agreement.vendorContactId]);

  const remaining = daysUntil(agreement.validUntil);
  const isExpired = remaining < 0;

  return (
    <article className="flex flex-col gap-5">
      <EntityDetailsHeader
        icon={ScrollText}
        title={agreement.title}
        subtitle={agreement.agreementNumber}
        variant="detailed"
        titleAdornment={
          // ΙΔΙΑ παραλλαγή με την κάρτα λίστας/πλέγματος· το `Badge` δίνει το μετρημένο μελάνι (`SOLID_FILL_INK`).
          // Ως τις 2026-10-29: `getStatusColor(x,'bg')` + `getStatusColor(x,'text')` ⇒ άδειο χρωματιστό χάπι (ADR-770).
          <Badge variant={AGREEMENT_STATUS_BADGE_VARIANTS[agreement.status]} className="text-sm">
            {t(`hub.frameworkAgreements.status.${agreement.status}`)}
          </Badge>
        }
        actions={[
          ...(onCreateNew
            ? [createEntityAction('new', t('hub.frameworkAgreements.create'), onCreateNew)]
            : []),
          createEntityAction('edit', t('hub.frameworkAgreements.edit'), () => onEdit(agreement)),
          createEntityAction('delete', t('hub.frameworkAgreements.delete'), () => onDelete(agreement)),
        ]}
      />

      {agreement.description && (
        <p className="text-sm text-muted-foreground">{agreement.description}</p>
      )}

      <Separator />

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
            <span className={cn('ml-2 text-xs', isExpired ? 'text-destructive' : 'text-muted-foreground')}>
              {isExpired
                ? t('hub.frameworkAgreements.detail.expired')
                : t('hub.frameworkAgreements.detail.daysRemaining', { count: remaining })}
            </span>
          </dd>
        </div>
      </section>

      <Separator />

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

      <Separator />

      <AgreementScopeSummary scope={agreement} />
    </article>
  );
}
