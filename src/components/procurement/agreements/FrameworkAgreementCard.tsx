'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollText, Pencil, Trash2, CalendarRange, Percent, Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

interface FrameworkAgreementCardProps {
  agreement: FrameworkAgreement;
  vendorName: string | null;
  onEdit: (agreement: FrameworkAgreement) => void;
  onDelete: (agreement: FrameworkAgreement) => void;
}

const STATUS_VARIANT: Record<
  FrameworkAgreement['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  active: 'default',
  expired: 'secondary',
  terminated: 'destructive',
};

function tsToDateLabel(ts: { seconds?: number } | null): string {
  if (!ts || typeof ts.seconds !== 'number') return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString();
}

export function FrameworkAgreementCard({
  agreement,
  vendorName,
  onEdit,
  onDelete,
}: FrameworkAgreementCardProps) {
  const { t } = useTranslation('procurement');

  const validFrom = tsToDateLabel(agreement.validFrom as unknown as { seconds?: number });
  const validUntil = tsToDateLabel(agreement.validUntil as unknown as { seconds?: number });

  const discountLabel =
    agreement.discountType === 'flat'
      ? agreement.flatDiscountPercent !== null
        ? `${agreement.flatDiscountPercent}%`
        : '—'
      : t('hub.frameworkAgreements.discount.tiers', {
          count: agreement.volumeBreakpoints.length,
        });

  return (
    <Card className="flex flex-col gap-0 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <CardTitle className="text-base leading-tight truncate">
              {agreement.title}
            </CardTitle>
            <code className="text-xs font-mono text-muted-foreground">
              {agreement.agreementNumber}
            </code>
          </div>
          <ScrollText className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" aria-hidden />
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant={STATUS_VARIANT[agreement.status]} className="text-xs">
            {t(`hub.frameworkAgreements.status.${agreement.status}`)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {t(`hub.frameworkAgreements.discount.type.${agreement.discountType}`)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {vendorName && (
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-medium text-foreground">{vendorName}</span>
          </p>
        )}

        {agreement.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {agreement.description}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3 w-3" aria-hidden />
              {t('hub.frameworkAgreements.validFrom')}
            </dt>
            <dd className="font-medium">{validFrom}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3 w-3" aria-hidden />
              {t('hub.frameworkAgreements.validUntil')}
            </dt>
            <dd className="font-medium">{validUntil}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
              <Percent className="h-3 w-3" aria-hidden />
              {t('hub.frameworkAgreements.discount.label')}
            </dt>
            <dd className="font-semibold">{discountLabel}</dd>
          </div>
          {agreement.totalCommitment !== null && (
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" aria-hidden />
                {t('hub.frameworkAgreements.totalCommitment')}
              </dt>
              <dd className="font-semibold">{formatCurrency(agreement.totalCommitment)}</dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-end pt-2 border-t">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(agreement)}
              aria-label={t('hub.frameworkAgreements.edit')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(agreement)}
              aria-label={t('hub.frameworkAgreements.delete')}
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
