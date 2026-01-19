// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

export function LimitedInfoNotice() {
  const { t } = useTranslation('properties');
  return (
    <>
      <Separator />
      <div className="text-center p-4 text-muted-foreground">
        <p className="text-xs">{t('details.limitedInfo')}</p>
        <p className="text-xs mt-1">{t('details.contactForMore')}</p>
      </div>
    </>
  );
}
