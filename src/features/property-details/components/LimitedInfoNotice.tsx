// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function LimitedInfoNotice() {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  return (
    <>
      <Separator />
      <div className={cn("text-center px-2 py-1", colors.text.muted)}>
        <p className="text-xs">{t('details.limitedInfo')}</p>
        <p className="text-xs mt-0.5">{t('details.contactForMore')}</p>
      </div>
    </>
  );
}
