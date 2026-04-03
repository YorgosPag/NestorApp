// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function CompanyInfo({ city, phone, email }: { city: string; phone: string; email: string }) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="px-6 space-y-4">
      <h3 className={cn("text-sm font-medium", colors.text.muted)}>{t('public.companyInfo')}</h3>
      <div className="space-y-3 text-sm">
        <div className={cn("flex items-center gap-2", colors.text.muted)}>
          <MapPin className={iconSizes.sm} />
          <span>{city}</span>
        </div>
        <div className={cn("flex items-center gap-2", colors.text.muted)}>
          <Phone className={iconSizes.sm} />
          <span>{phone}</span>
        </div>
        <div className={cn("flex items-center gap-2", colors.text.muted)}>
          <Mail className={iconSizes.sm} />
          <span>{email}</span>
        </div>
      </div>
    </div>
  );
}
