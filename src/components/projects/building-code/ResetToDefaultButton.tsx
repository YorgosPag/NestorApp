'use client';

import { RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ResetToDefaultButtonProps {
  fieldLabel: string;
  /** Non-null guaranteed by caller: button renders only when resettable (zoneId !== null). */
  zoneId: string;
  onReset(): void;
}

export function ResetToDefaultButton({
  fieldLabel,
  zoneId,
  onReset,
}: ResetToDefaultButtonProps) {
  const { t } = useTranslation('buildingCode');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onReset}
          aria-label={t('reset.aria', { field: fieldLabel })}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t('reset.tooltip', { zoneId })}
      </TooltipContent>
    </Tooltip>
  );
}
