/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * BOQ Related POs — Shows purchase orders linked to a BOQ item
 *
 * Queries POs for the project, filters by items[].boqItemId client-side.
 * Firestore cannot query embedded array field, so project-level fetch + filter.
 *
 * @module components/procurement/BOQRelatedPOs
 * @enterprise ADR-267 Phase B — BOQ Integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';
import { PO_STATUS_META } from '@/types/procurement';

// ============================================================================
// TYPES
// ============================================================================

interface BOQRelatedPOsProps {
  projectId: string;
  boqItemId: string;
}

interface LinkedPOInfo {
  po: PurchaseOrder;
  linkedItem: PurchaseOrderItem;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQRelatedPOs({ projectId, boqItemId }: BOQRelatedPOsProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const [linkedPOs, setLinkedPOs] = useState<LinkedPOInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndFilter = useCallback(async () => {
    try {
      const res = await fetch(`/api/procurement?projectId=${projectId}`);
      if (!res.ok) return;
      const json = await res.json();
      const allPOs = (json.data ?? []) as PurchaseOrder[];

      const matches: LinkedPOInfo[] = [];
      for (const po of allPOs) {
        const linkedItem = po.items.find(
          (item) => item.boqItemId === boqItemId
        );
        if (linkedItem) {
          matches.push({ po, linkedItem });
        }
      }

      setLinkedPOs(matches);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, boqItemId]);

  useEffect(() => {
    fetchAndFilter();
  }, [fetchAndFilter]);

  if (loading) {
    return (
      <section className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{t('boqRelated.title')}</span>
      </section>
    );
  }

  if (linkedPOs.length === 0) {
    return null; // Don't show section if no related POs
  }

  return (
    <section className="space-y-2 pt-3">
      <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ShoppingCart className="h-3.5 w-3.5" />
        {t('boqRelated.title')} ({linkedPOs.length})
      </h4>

      <ul className="divide-y divide-border rounded-md border text-sm">
        {linkedPOs.map(({ po, linkedItem }) => {
          const meta = PO_STATUS_META[po.status];
          return (
            <li key={po.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/procurement/${po.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{po.poNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    {meta.label.el}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>
                    {t('boqRelated.orderedQty')}: {linkedItem.quantity}
                  </span>
                  <span>
                    {t('boqRelated.receivedQty')}: {linkedItem.quantityReceived}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatEuro(linkedItem.total)}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
