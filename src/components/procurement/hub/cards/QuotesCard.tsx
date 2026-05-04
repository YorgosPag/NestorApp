'use client';

import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';

const PENDING_STATUSES = new Set(['submitted', 'under_review']);

export function QuotesCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { quotes, loading } = useQuotes();

  const pendingCount = quotes.filter((q) => PENDING_STATUSES.has(q.status)).length;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/quotes')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/quotes')}
      aria-label={t('hub.quotes.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <FileText className="h-8 w-8 text-orange-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t('hub.quotes.title')}</CardTitle>
        <CardDescription>{t('hub.quotes.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {loading ? '—' : t('hub.quotes.pendingCount', { count: pendingCount })}
        </p>
        {!loading && pendingCount === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{t('hub.quotes.noPending')}</p>
        )}
      </CardContent>
    </Card>
  );
}
