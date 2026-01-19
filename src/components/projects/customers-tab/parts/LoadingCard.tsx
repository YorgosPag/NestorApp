
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function LoadingCard() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('customers.title')}</CardTitle>
        <CardDescription>{t('structure.loadingCustomers')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
