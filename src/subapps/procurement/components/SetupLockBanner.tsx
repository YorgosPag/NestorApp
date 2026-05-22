'use client';

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';

interface SetupLockBannerProps {
  lockState: SetupLockState;
  vendorName?: string;
  poNumber?: string;
  rfqStatus?: 'closed' | 'cancelled' | 'archived';
  onRevertAward?: () => void;
  onViewPo?: () => void;
  onCancelPo?: () => void;
}

export function SetupLockBanner({
  lockState,
  vendorName,
  poNumber,
  rfqStatus,
  onRevertAward,
  onViewPo,
  onCancelPo,
}: SetupLockBannerProps) {
  const { t } = useTranslation('quotes');

  if (lockState === 'unlocked') return null;

  if (lockState === 'lifecycleLocked') {
    const statusKey = rfqStatus ?? 'closed';
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
        <Lock className="size-4 shrink-0 text-foreground" />
        <span className="text-foreground">
          {t(`rfqs.setup.banner.lifecycleLocked.${statusKey}`)}
        </span>
      </div>
    );
  }

  if (lockState === 'awardLocked') {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--bg-warning))]/60 bg-[hsl(var(--bg-warning))]/40 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Lock className="size-4 shrink-0" />
          <span>{t('rfqs.setup.banner.awardLocked', { vendor: vendorName ?? '—' })}</span>
        </div>
        {onRevertAward && (
          <Button size="sm" variant="outline" onClick={onRevertAward}>
            {t('rfqs.setup.banner.revertAward')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--bg-error))]/60 bg-[hsl(var(--bg-error))]/40 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-destructive">
        <Lock className="size-4 shrink-0" />
        <span>{t('rfqs.setup.banner.poLocked', { poNumber: poNumber ?? '—' })}</span>
      </div>
      <div className="flex gap-2">
        {onViewPo && (
          <Button size="sm" variant="outline" onClick={onViewPo}>
            {t('rfqs.setup.banner.viewPo')}
          </Button>
        )}
        {onCancelPo && (
          <Button size="sm" variant="destructive" onClick={onCancelPo}>
            {t('rfqs.setup.banner.cancelPo')}
          </Button>
        )}
      </div>
    </div>
  );
}
