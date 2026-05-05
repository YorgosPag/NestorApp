'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressFieldTooltip } from './AddressFieldTooltip';

interface AddressConfidenceMeterProps {
  confidence: number;
  className?: string;
}

function getMeterColorClass(confidence: number): string {
  if (confidence >= 0.85) return 'bg-green-500';
  if (confidence >= 0.70) return 'bg-yellow-400';
  if (confidence >= 0.50) return 'bg-orange-400';
  return 'bg-red-500';
}

export function AddressConfidenceMeter({ confidence, className }: AddressConfidenceMeterProps) {
  const { t } = useTranslation('addresses');
  const clamped = Math.max(0, Math.min(1, confidence));
  const percent = Math.round(clamped * 100);
  const ariaLabel = t('editor.confidence.ariaLabel', { percent });

  return (
    <AddressFieldTooltip content={ariaLabel}>
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t('editor.confidence.label')}
        </span>
        <div
          role="meter"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={ariaLabel}
          className="relative h-2 w-24 rounded-full bg-muted overflow-hidden"
        >
          {/* width is a computed value — inline style necessary for dynamic percentage */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
              getMeterColorClass(clamped),
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
      </div>
    </AddressFieldTooltip>
  );
}
