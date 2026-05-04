'use client';

import { useRouter } from 'next/navigation';
import { ScrollText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFrameworkAgreements } from '@/hooks/procurement/useFrameworkAgreements';

export function FrameworkAgreementsCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { agreements, loading } = useFrameworkAgreements();

  const activeCount = agreements.filter((a) => a.status === 'active').length;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/agreements')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/agreements')}
      aria-label={t('hub.frameworkAgreements.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <ScrollText className="h-8 w-8 text-purple-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t('hub.frameworkAgreements.title')}</CardTitle>
        <CardDescription>{t('hub.frameworkAgreements.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {loading ? '—' : t('hub.frameworkAgreements.activeCount', { count: activeCount })}
        </p>
        {!loading && activeCount === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('hub.frameworkAgreements.noActive')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
