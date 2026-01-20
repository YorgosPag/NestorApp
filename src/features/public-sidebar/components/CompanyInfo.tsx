// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

export function CompanyInfo({ city, phone, email }: { city: string; phone: string; email: string }) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();

  return (
    <div className="px-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">{t('public.companyInfo')}</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className={iconSizes.sm} />
          <span>{city}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className={iconSizes.sm} />
          <span>{phone}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className={iconSizes.sm} />
          <span>{email}</span>
        </div>
      </div>
    </div>
  );
}
