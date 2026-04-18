'use client';

/**
 * Public PO Share Page Content — Read-only view (no auth)
 *
 * Accessed via /shared/po/[token].
 * Validates token via API, renders stripped PO view.
 *
 * @module components/shared/pages/PublicPOPageContent
 * @enterprise ADR-294 Batch 7 — extracted from app/shared/po/[token]/page.tsx
 * @see ADR-267 Phase B — Share Link
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart, AlertCircle, Clock, Loader2,
} from 'lucide-react';
import { cn, getStatusColor } from '@/lib/design-system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PO_STATUS_META } from '@/types/procurement';
import type { PurchaseOrder } from '@/types/procurement';
import {
  formatCurrency as formatEUR,
  formatDate as formatLocaleDate,
} from '@/lib/intl-utils';

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(n: number): string {
  return formatEUR(n, 'EUR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateOrDash(iso: string | null): string {
  if (!iso) return '—';
  return formatLocaleDate(iso);
}

// ============================================================================
// STATE TYPES
// ============================================================================

type PageState =
  | { type: 'loading' }
  | { type: 'ready'; po: PurchaseOrder }
  | { type: 'expired'; message: string }
  | { type: 'error'; message: string };

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export function PublicPOPageContent() {
  const params = useParams<{ token: string }>();
  const { t } = useTranslation('procurement');
  const [state, setState] = useState<PageState>({ type: 'loading' });

  const fetchPO = useCallback(async () => {
    try {
      const res = await fetch(`/api/procurement/public/${params.token}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        const error = json.error ?? 'Link not found';
        const isExpired = error.includes('expired');
        setState({
          type: isExpired ? 'expired' : 'error',
          message: error,
        });
        return;
      }

      setState({ type: 'ready', po: json.data });
    } catch {
      setState({ type: 'error', message: 'Failed to load purchase order' });
    }
  }, [params.token]);

  useEffect(() => {
    fetchPO();
  }, [fetchPO]);

  if (state.type === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (state.type === 'expired') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted">
        <section className="text-center space-y-3">
          <Clock className={cn('mx-auto h-12 w-12', getStatusColor('reserved', 'text'))} />
          <h1 className="text-xl font-semibold">{t('share.expires', { days: 0 })}</h1>
          <p className="text-muted-foreground">{state.message}</p>
        </section>
      </main>
    );
  }

  if (state.type === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted">
        <section className="text-center space-y-3">
          <AlertCircle className={cn('mx-auto h-12 w-12', getStatusColor('cancelled', 'text'))} />
          <h1 className="text-xl font-semibold">{t('list.emptyTitle')}</h1>
          <p className="text-muted-foreground">{state.message}</p>
        </section>
      </main>
    );
  }

  const { po } = state;
  const statusMeta = PO_STATUS_META[po.status];

  return (
    <main className="min-h-screen bg-muted py-8 px-4">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="text-center space-y-1">
          <ShoppingCart className={cn('mx-auto h-8 w-8', getStatusColor('planned', 'text'))} />
          <h1 className="text-2xl font-bold">{t('pdf.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('share.readOnly')}</p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{po.poNumber}</CardTitle>
              <Badge variant="outline">{statusMeta.label.el}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('detail.dateCreated')}</dt>
                <dd className="font-medium">{formatDateOrDash(po.dateCreated)}</dd>
              </div>
              {po.dateNeeded && (
                <div>
                  <dt className="text-muted-foreground">{t('detail.dateNeeded')}</dt>
                  <dd className="font-medium">{formatDateOrDash(po.dateNeeded)}</dd>
                </div>
              )}
              {po.deliveryAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t('detail.address')}</dt>
                  <dd className="font-medium">{po.deliveryAddress}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('detail.items')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('items.description')}</TableHead>
                  <TableHead className="text-right">{t('items.quantity')}</TableHead>
                  <TableHead>{t('items.unit')}</TableHead>
                  <TableHead className="text-right">{t('items.unitPrice')}</TableHead>
                  <TableHead className="text-right">{t('items.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatPrice(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-right">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('detail.subtotal')}</span>
                  <span className="tabular-nums">{formatPrice(po.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('detail.vat')} {po.taxRate}%</span>
                  <span className="tabular-nums">{formatPrice(po.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold text-base">
                  <span>{t('detail.total')}</span>
                  <span className="tabular-nums">{formatPrice(po.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {po.supplierNotes && (
          <Card>
            <CardHeader><CardTitle>{t('detail.notes')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{po.supplierNotes}</p>
            </CardContent>
          </Card>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-4">
          {t('share.readOnly')}
        </footer>
      </article>
    </main>
  );
}
