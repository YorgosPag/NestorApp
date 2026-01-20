// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

export function BuyerMismatchAlert() {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();

  return (
    <Alert variant="destructive">
      <AlertCircle className={iconSizes.sm} />
      <AlertTitle>{t('alerts.warning')}</AlertTitle>
      <AlertDescription>
        {t('alerts.buyerMismatch')}
      </AlertDescription>
    </Alert>
  );
}
