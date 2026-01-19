"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FileText, Plus } from 'lucide-react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface EmptyStateProps {
  readOnly: boolean;
  onAddSection: () => void;
}

export function EmptyState({ readOnly, onAddSection }: EmptyStateProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  return (
    <Card>
      <CardContent className="text-center py-12">
        <FileText className={`${iconSizes.huge} mx-auto mb-4 text-muted-foreground/50`} />
        <h3 className="font-medium mb-2">{t('obligations.noSections')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('obligations.startByAddingSection')}
        </p>
        {!readOnly && (
          <Button onClick={onAddSection}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('obligations.addSection')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
