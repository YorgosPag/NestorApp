'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageUnit } from '@/types/storage';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageFormFooterProps {
  onCancel: () => void;
  unit: StorageUnit | null;
}

export function StorageFormFooter({ onCancel, unit }: StorageFormFooterProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();

  return (
    <div className="p-6 border-t bg-muted/30 sticky bottom-0">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t('storage.form.footer.requiredFields')}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('storage.form.footer.cancel')}
          </Button>
          <Button type="submit">
            <Save className={`${iconSizes.sm} mr-2`} />
            {unit ? t('storage.form.footer.update') : t('storage.form.footer.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
