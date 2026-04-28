'use client';

/**
 * PurchaseOrderDetailsHeader — Header SSoT για το right-pane του PO detail
 *
 * Stesso pattern di ContactDetailsHeader: wrappa `EntityDetailsHeader` con
 * action presets centralizzati (`createEntityAction`). Espone "+Νέα Παραγγελία"
 * sempre disponibile (pari a contacts/buildings) anche quando un PO è selezionato.
 *
 * @see ADR-267 §Phase G — Procurement Detail Header SSoT
 * @see src/components/contacts/details/ContactDetailsHeader.tsx (pattern di riferimento)
 */

import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, getStatusColor } from '@/lib/design-system';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PO_STATUS_META } from '@/types/procurement';
import type { PurchaseOrder } from '@/types/procurement';

const STATUS_SEMANTIC: Record<string, string> = {
  gray: 'pending', blue: 'planned', yellow: 'construction',
  orange: 'reserved', green: 'available', emerald: 'completed', red: 'cancelled',
};

interface PurchaseOrderDetailsHeaderProps {
  po: PurchaseOrder;
  onCreateNew?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}

export function PurchaseOrderDetailsHeader({
  po,
  onCreateNew,
  onEdit,
  onCancel,
}: PurchaseOrderDetailsHeaderProps) {
  const { t } = useTranslation('procurement');

  const statusMeta = PO_STATUS_META[po.status];
  const sem = STATUS_SEMANTIC[statusMeta.color] ?? 'pending';
  const isCancelled = po.status === 'cancelled' || po.status === 'closed';

  return (
    <EntityDetailsHeader
      icon={Package}
      title={po.poNumber}
      variant="detailed"
      titleAdornment={
        <Badge
          variant="outline"
          className={cn(
            'text-sm font-medium',
            getStatusColor(sem, 'bg'),
            getStatusColor(sem, 'text'),
          )}
        >
          {statusMeta.label.el}
        </Badge>
      }
      actions={[
        ...(onCreateNew
          ? [createEntityAction('new', t('list.createPO'), onCreateNew)]
          : []),
        ...(onEdit && !isCancelled
          ? [createEntityAction('edit', t('detail.edit'), onEdit)]
          : []),
        ...(onCancel && !isCancelled
          ? [createEntityAction('delete', t('detail.cancelPO'), onCancel)]
          : []),
      ]}
    />
  );
}
