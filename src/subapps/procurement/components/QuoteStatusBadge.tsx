'use client';

import { Badge } from '@/components/ui/badge';
import { cn, getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QuoteStatus } from '@/subapps/procurement/types/quote';
import { QUOTE_STATUS_META } from '@/subapps/procurement/types/quote';

const COLOR_TO_SEMANTIC: Record<string, string> = {
  gray:   'pending',
  blue:   'planned',
  yellow: 'construction',
  orange: 'reserved',
  green:  'available',
  red:    'cancelled',
  purple: 'completed',
};

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  const { t } = useTranslation('quotes');
  const meta = QUOTE_STATUS_META[status];
  const semantic = COLOR_TO_SEMANTIC[meta.color] ?? 'pending';

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        getStatusColor(semantic, 'bg'),
        getStatusColor(semantic, 'text'),
        className,
      )}
    >
      {t(`quotes.statuses.${status}`)}
    </Badge>
  );
}
