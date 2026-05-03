'use client';

import { useRouter } from 'next/navigation';
import { Users2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';

export function VendorMasterCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { suppliers, loading } = usePOSupplierContacts();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/vendors')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/vendors')}
      aria-label={t('hub.vendorMaster.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Users2 className="h-8 w-8 text-green-600" aria-hidden />
          <Badge variant="secondary" className="text-xs">{t('hub.vendorMaster.phase')}</Badge>
        </div>
        <CardTitle className="text-lg">{t('hub.vendorMaster.title')}</CardTitle>
        <CardDescription>{t('hub.vendorMaster.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {loading ? '—' : t('hub.vendorMaster.supplierCount', { count: suppliers.length })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('hub.vendorMaster.comingSoon')}</p>
      </CardContent>
    </Card>
  );
}
