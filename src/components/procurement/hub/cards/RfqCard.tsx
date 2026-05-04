'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';

export function RfqCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { rfqs, loading } = useRfqs({ status: 'active' });

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/rfqs')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/rfqs')}
      aria-label={t('hub.rfq.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <ClipboardList className="h-8 w-8 text-teal-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t('hub.rfq.title')}</CardTitle>
        <CardDescription>{t('hub.rfq.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {loading ? '—' : t('hub.rfq.activeCount', { count: rfqs.length })}
        </p>
        {!loading && rfqs.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{t('hub.rfq.noActive')}</p>
        )}
      </CardContent>
    </Card>
  );
}
