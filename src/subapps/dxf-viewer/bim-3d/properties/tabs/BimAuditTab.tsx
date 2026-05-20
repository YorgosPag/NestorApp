"use client";

/**
 * BimAuditTab — audit timeline for a selected BIM entity.
 *
 * Thin wrapper over ActivityTab SSoT (ADR-195).
 * EntityType: 'wall' | 'column' | 'beam' | 'slab' — already in AuditEntityType union.
 *
 * ADR-366 B.2.Q4.
 */

import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import type { AuditEntityType } from '@/types/audit-trail';

const BIM_AUDIT_TYPES: ReadonlySet<string> = new Set(['wall', 'column', 'beam', 'slab']);

interface BimAuditTabProps {
  bimId: string;
  bimType: string;
}

export function BimAuditTab({ bimId, bimType }: BimAuditTabProps) {
  if (!BIM_AUDIT_TYPES.has(bimType)) return null;

  return (
    <ActivityTab
      entityType={bimType as AuditEntityType}
      entityId={bimId}
    />
  );
}
