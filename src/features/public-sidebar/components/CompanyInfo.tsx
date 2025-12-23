'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function CompanyInfo({ city, phone, email }: { city: string; phone: string; email: string }) {
  const iconSizes = useIconSizes();

  return (
    <div className="px-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Στοιχεία Εταιρείας</h3>
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
