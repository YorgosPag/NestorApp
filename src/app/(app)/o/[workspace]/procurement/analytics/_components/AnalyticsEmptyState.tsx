'use client';

/**
 * AnalyticsEmptyState — Zero-data CTA for the spend analytics page.
 *
 * @see ADR-331 §4 D17
 */

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NEW_PO_PATH = '/procurement/new';

export function AnalyticsEmptyState() {
  const { t } = useTranslation('procurement');

  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-12 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{t('analytics.empty.title')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t('analytics.empty.description')}</p>
      <Button asChild size="sm" className="mt-2">
        <Link href={NEW_PO_PATH}>{t('analytics.empty.cta')}</Link>
      </Button>
    </section>
  );
}
