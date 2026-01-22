// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

export function LimitedInfoNotice() {
  const { t } = useTranslation('properties');
  const spacing = useSpacingTokens();
  return (
    <>
      <Separator />
      <div className={`text-center ${spacing.padding.sm} text-muted-foreground`}>
        <p className="text-xs">{t('details.limitedInfo')}</p>
        <p className={`text-xs ${spacing.margin.top.sm}`}>{t('details.contactForMore')}</p>
      </div>
    </>
  );
}
