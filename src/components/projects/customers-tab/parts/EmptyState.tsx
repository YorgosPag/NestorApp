
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized typography tokens
import { useTypography } from '@/hooks/useTypography';

export function EmptyState() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Centralized typography tokens
  const typography = useTypography();
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className={typography.card.titleCompact}>{t('customers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Users className={`${iconSizes.xl2} mx-auto mb-2`} />
          <p>{t('customers.emptyDescription')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
