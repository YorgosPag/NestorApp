'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Archive } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function EmptyList() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Archive className={`${iconSizes.xl2} text-muted-foreground mx-auto mb-4`} />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('emptyList.noUnitsFound')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('emptyList.noUnitsDescription')}
        </p>
      </CardContent>
    </Card>
  );
}
