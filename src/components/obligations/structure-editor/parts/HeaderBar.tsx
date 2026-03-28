// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
"use client";

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface HeaderBarProps {
  sectionsCount: number;
  readOnly: boolean;
  onAddSection: () => void;
}

export function HeaderBar({ sectionsCount, readOnly, onAddSection }: HeaderBarProps) {
  const { t } = useTranslation('obligations');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-lg">{t('structure.title')}</h3>
        <p className={cn("text-sm", colors.text.muted)}>
          {t('structure.sectionCount', { count: sectionsCount })}
        </p>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={onAddSection} className="flex items-center gap-2">
            <Plus className={iconSizes.sm} />
            {t('structure.newSection')}
          </Button>
        </div>
      )}
    </div>
  );
}

