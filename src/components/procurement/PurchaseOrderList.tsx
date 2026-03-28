'use client';

/**
 * PurchaseOrderList — PO list with "Requires Action" section + filters
 *
 * Desktop: full table. Mobile: card list.
 * Section 1: Pinned "Requires Action" items.
 * Section 2: Full list sorted by dateCreated DESC.
 *
 * @see ADR-267 §8.3 (PO List View)
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, getStatusColor } from '@/lib/design-system';
import { Plus, Search, Eye, Copy, AlertTriangle } from 'lucide-react';
import { PO_STATUS_META } from '@/types/procurement';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const meta = PO_STATUS_META[status];
  const statusColorMapping: Record<string, string> = {
    gray: 'pending',
    blue: 'planned',
    yellow: 'construction',
    orange: 'reserved',
    green: 'available',
    emerald: 'completed',
    red: 'cancelled',
  };

  const semanticStatus = statusColorMapping[meta.color] ?? 'pending';

  return (
    <Badge variant="outline" className={cn(
      'font-medium',
      getStatusColor(semanticStatus, 'bg'),
      getStatusColor(semanticStatus, 'text'),
    )}>
      {meta.label.el}
    </Badge>
  );
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('el-GR');
}

// ============================================================================
// COMPONENT
// ============================================================================

interface PurchaseOrderListProps {
  purchaseOrders: PurchaseOrder[];
  actionRequired: PurchaseOrder[];
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onCreateNew: () => void;
  onViewPO: (poId: string) => void;
  onDuplicate: (poId: string) => void;
}

export function PurchaseOrderList({
  purchaseOrders,
  actionRequired,
  loading,
  searchValue,
  onSearchChange,
  onCreateNew,
  onViewPO,
  onDuplicate,
}: PurchaseOrderListProps) {
  const { t } = useTranslation('procurement');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('list.search', 'Αναζήτηση PO, προμηθευτή, υλικού...')}
            className="pl-9"
          />
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('list.createPO', 'Νέα Παραγγελία')}
        </Button>
      </div>

      {/* Section 1: Requires Action */}
      {actionRequired.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {t('list.requiresAction', 'Απαιτούν ενέργεια')}
              <Badge variant="secondary" className="ml-auto">
                {actionRequired.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <POTable
              items={actionRequired}
              onView={onViewPO}
              onDuplicate={onDuplicate}
              highlight
            />
          </CardContent>
        </Card>
      )}

      {/* Section 2: All POs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            {t('list.allOrders', 'Όλες οι παραγγελίες')}
            <Badge variant="secondary" className="ml-auto">
              {purchaseOrders.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <EmptyState onCreateNew={onCreateNew} />
          ) : (
            <POTable
              items={purchaseOrders}
              onView={onViewPO}
              onDuplicate={onDuplicate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PO TABLE (Desktop) / CARDS (Mobile)
// ============================================================================

function POTable({
  items,
  onView,
  onDuplicate,
  highlight = false,
}: {
  items: PurchaseOrder[];
  onView: (id: string) => void;
  onDuplicate: (id: string) => void;
  highlight?: boolean;
}) {
  const { t } = useTranslation('procurement');

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>{t('list.supplier')}</TableHead>
              <TableHead>{t('list.status')}</TableHead>
              <TableHead className="text-right">{t('list.total')}</TableHead>
              <TableHead>{t('list.dateCreated')}</TableHead>
              <TableHead>{t('list.dateNeeded')}</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((po) => (
              <TableRow
                key={po.id}
                className={cn(
                  'cursor-pointer',
                  highlight && 'bg-amber-50/50 dark:bg-amber-950/20'
                )}
                onClick={() => onView(po.id)}
              >
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {po.supplierId}
                </TableCell>
                <TableCell>
                  <StatusBadge status={po.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(po.total)}
                </TableCell>
                <TableCell>{formatDate(po.dateCreated)}</TableCell>
                <TableCell>{formatDate(po.dateNeeded)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onView(po.id); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onDuplicate(po.id); }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {items.map((po) => (
          <article
            key={po.id}
            className={cn(
              'rounded-lg border p-3 space-y-1.5',
              highlight && 'border-amber-300 dark:border-amber-700',
            )}
            onClick={() => onView(po.id)}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{po.poNumber}</span>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {po.supplierId}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span>{formatDate(po.dateCreated)}</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(po.total)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  const { t } = useTranslation('procurement');

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Plus className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">
        {t('list.emptyTitle', 'Δεν υπάρχουν παραγγελίες')}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {t('list.emptyDescription', 'Δημιουργήστε την πρώτη παραγγελία αγοράς για να ξεκινήσετε.')}
      </p>
      <Button onClick={onCreateNew} className="mt-4">
        <Plus className="mr-1.5 h-4 w-4" />
        {t('list.createFirst', 'Δημιουργία Πρώτης Παραγγελίας')}
      </Button>
    </div>
  );
}
