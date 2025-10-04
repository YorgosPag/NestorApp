'use client';

import { MapPin, Phone, Mail } from 'lucide-react';

export function CompanyInfo({ city, phone, email }: { city: string; phone: string; email: string }) {
  return (
    <div className="px-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Στοιχεία Εταιρείας</h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{city}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{phone}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{email}</span>
        </div>
      </div>
    </div>
  );
}
