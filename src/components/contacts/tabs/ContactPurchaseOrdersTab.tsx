/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * Contact Purchase Orders Tab — Shows POs for a supplier contact
 *
 * Queries POs by supplierId and renders a compact table.
 * Only displayed for contacts with supplier persona.
 *
 * @module components/contacts/tabs/ContactPurchaseOrdersTab
 * @enterprise ADR-267 Phase B — Contact Integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PurchaseOrder } from '@/types/procurement';
import { PO_STATUS_META } from '@/types/procurement';
import { createStaleCache } from '@/lib/stale-cache';

const contactPurchaseOrdersCache = createStaleCache<PurchaseOrder[]>('contact-purchase-orders');

// ============================================================================
// TYPES
// ============================================================================

interface ContactPurchaseOrdersTabProps {
  contactId: string;
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactPurchaseOrdersTab({ contactId }: ContactPurchaseOrdersTabProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>(
    contactPurchaseOrdersCache.get(contactId) ?? []
  );
  const [loading, setLoading] = useState(!contactPurchaseOrdersCache.hasLoaded(contactId));

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/procurement?supplierId=${contactId}`);
      if (!res.ok) return;
      const json = await res.json();
      const fetched: PurchaseOrder[] = json.data ?? [];
      contactPurchaseOrdersCache.set(fetched, contactId);
      setOrders(fetched);
    } catch {
      // Silently fail — tab shows empty state
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <section className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 py-8 text-center">
        <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('contactTab.empty')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('contactTab.title')} ({orders.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/procurement?supplierId=${contactId}`)}
        >
          {t('contactTab.viewAll')}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </header>

      <ul className="divide-y divide-border rounded-md border">
        {orders.map((po) => {
          const meta = PO_STATUS_META[po.status];
          return (
            <li key={po.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/procurement/${po.id}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{po.poNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    {meta.label.el}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatEuro(po.total)}</span>
                  <span className="hidden sm:inline">{formatDate(po.dateCreated)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
