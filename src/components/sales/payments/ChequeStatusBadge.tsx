'use client';

/**
 * ChequeStatusBadge — Maps ChequeStatus to Badge variant
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ChequeStatus } from '@/types/cheque-registry';

const STATUS_VARIANT: Record<ChequeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  received: 'outline',
  in_custody: 'secondary',
  deposited: 'secondary',
  clearing: 'default',
  cleared: 'default',
  bounced: 'destructive',
  endorsed: 'outline',
  cancelled: 'destructive',
  expired: 'destructive',
  replaced: 'outline',
};

interface ChequeStatusBadgeProps {
  status: ChequeStatus;
}

export function ChequeStatusBadge({ status }: ChequeStatusBadgeProps) {
  const { t } = useTranslation('payments');

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {t(`chequeRegistry.status.${status}`)}
    </Badge>
  );
}
