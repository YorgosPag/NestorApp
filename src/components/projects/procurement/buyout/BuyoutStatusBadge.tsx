'use client';

/**
 * The buyout status as the screen shows it — ONE place for icon + tone + label (ADR-330 §5.1 S3.2).
 * Every status has its own ICON, so it reads without colour (CHECK 3.41 state-channel rule).
 */

import { CheckCircle2, CircleDashed, Send, ShoppingCart, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { cn, getStatusColor } from '@/lib/design-system';
import { BUYOUT_STATUS_META, type BuyoutStatus } from '@/services/procurement/buyout/project-buyout';

export const BUYOUT_STATUS_ICON: Readonly<Record<BuyoutStatus, LucideIcon>> = {
  uncovered: CircleDashed,
  sourcing: Send,
  ordering: ShoppingCart,
  committed: CheckCircle2,
};

export function buyoutToneClasses(status: BuyoutStatus): string {
  const tone = BUYOUT_STATUS_META[status].tone;
  return cn(getStatusColor(tone, 'text'), getStatusColor(tone, 'border'));
}

export function BuyoutStatusBadge({ status }: { status: BuyoutStatus }) {
  const { t } = useTranslation('procurement');
  const Icon = BUYOUT_STATUS_ICON[status];
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium whitespace-nowrap', buyoutToneClasses(status))}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(`buyout.status.${status}`)}
    </Badge>
  );
}
