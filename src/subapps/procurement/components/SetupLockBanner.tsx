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
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
        <Lock className="size-4 shrink-0 text-slate-700 dark:text-slate-300" />
        <span className="text-slate-700 dark:text-slate-300">
          {t(`rfqs.setup.banner.lifecycleLocked.${statusKey}`)}
        </span>
      </div>
    );
  }

  if (lockState === 'awardLocked') {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950/30">
      <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
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
