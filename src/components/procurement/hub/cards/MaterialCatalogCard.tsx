'use client';

import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function MaterialCatalogCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/materials')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/materials')}
      aria-label={t('hub.materialCatalog.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Layers className="h-8 w-8 text-yellow-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t('hub.materialCatalog.title')}</CardTitle>
        <CardDescription>{t('hub.materialCatalog.description')}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
