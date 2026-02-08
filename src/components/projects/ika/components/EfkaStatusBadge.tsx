'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EfkaDeclarationStatus } from '../contracts';

interface EfkaStatusBadgeProps {
  status: EfkaDeclarationStatus;
}

const STATUS_VARIANT_MAP: Record<EfkaDeclarationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  preparation: 'secondary',
  submitted: 'default',
  active: 'default',
  amended: 'secondary',
  closed: 'outline',
};

export function EfkaStatusBadge({ status }: EfkaStatusBadgeProps) {
  const { t } = useTranslation('projects');

  return (
    <Badge variant={STATUS_VARIANT_MAP[status]}>
      {t(`ika.efka.status.${status}`)}
    </Badge>
  );
}
