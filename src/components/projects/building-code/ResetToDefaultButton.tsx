/**
 * @related ADR-186 §8 Q3 — Reset-to-default per field
 *
 * Tiny `↺` icon button next to a numeric field. Disabled when no zone is
 * selected or the field already matches the zone default.
 */
'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ResetToDefaultButtonProps {
  /** i18n-resolved field label, used in the aria announcement. */
  fieldLabel: string;
  /** Whether the button performs a meaningful reset. */
  enabled: boolean;
  onReset(): void;
}

export function ResetToDefaultButton({
  fieldLabel,
  enabled,
  onReset,
}: ResetToDefaultButtonProps) {
  const { t } = useTranslation('buildingCode');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={!enabled}
      onClick={onReset}
      title={t('reset.tooltip')}
      aria-label={t('reset.aria', { field: fieldLabel })}
      className="h-7 w-7 p-0"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}
