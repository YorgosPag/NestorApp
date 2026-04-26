'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ComparisonPanelStub() {
  const { t } = useTranslation('quotes');

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <BarChart2 className="h-5 w-5" />
          {t('comparison.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('comparison.description')}</p>
        <p className="text-sm font-medium text-muted-foreground">
          {t('comparison.comingSoon')}
        </p>
      </CardContent>
    </Card>
  );
}
