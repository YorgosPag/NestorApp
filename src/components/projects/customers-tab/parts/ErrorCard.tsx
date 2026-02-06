
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized typography tokens
import { useTypography } from '@/hooks/useTypography';

interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Centralized typography tokens
  const typography = useTypography();
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(typography.card.titleCompact, 'text-destructive')}>{t('structure.error')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}
