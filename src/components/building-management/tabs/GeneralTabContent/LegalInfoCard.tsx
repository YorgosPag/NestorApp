'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function LegalInfoCard() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const typography = useTypography();
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <AlertCircle className={iconSizes.md} />
          {t('tabs.general.legalInfo.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('tabs.general.legalInfo.contractNumber')}</Label>
            <Input disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>{t('tabs.general.legalInfo.contractDate')}</Label>
            <Input type="date" disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>{t('tabs.general.legalInfo.contractFile')}</Label>
            <Input disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>{t('tabs.general.legalInfo.notary')}</Label>
            <Input disabled className="bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
