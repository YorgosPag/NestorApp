'use client';

/**
 * PurchaseOrderDetail — Read-only PO view with status actions
 *
 * Shows PO header, line items, totals, notes, and action buttons.
 * Responsive layout.
 *
 * @see ADR-267 §8.4 (PO Detail View)
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn, getStatusColor } from '@/lib/design-system';
import {
  CheckCircle, Send, PackageCheck, XCircle, FileText, Copy, Edit, Clipboard,
} from 'lucide-react';
import { PO_STATUS_META } from '@/types/procurement';
import type { PurchaseOrder } from '@/types/procurement';
import { useTranslation } from '@/i18n/hooks/useTranslation';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('el-GR');
}

const STATUS_SEMANTIC: Record<string, string> = {
  gray: 'pending', blue: 'planned', yellow: 'construction',
  orange: 'reserved', green: 'available', emerald: 'completed', red: 'cancelled',
};

interface PurchaseOrderDetailProps {
  po: PurchaseOrder;
  onApprove?: () => void;
  onMarkOrdered?: () => void;
  onRecordDelivery?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onExportPDF?: () => void;
  onCopyText?: () => void;
}

export function PurchaseOrderDetail({
  po, onApprove, onMarkOrdered, onRecordDelivery, onClose,
  onCancel, onEdit, onDuplicate, onExportPDF, onCopyText,
}: PurchaseOrderDetailProps) {
  const { t } = useTranslation('procurement');
  const statusMeta = PO_STATUS_META[po.status];
  const sem = STATUS_SEMANTIC[statusMeta.color] ?? 'pending';
  const showDelivery = ['ordered', 'partially_delivered', 'delivered'].includes(po.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">{po.poNumber}</CardTitle>
            <Badge variant="outline" className={cn('text-sm font-medium', getStatusColor(sem, 'bg'), getStatusColor(sem, 'text'))}>
              {statusMeta.label.el}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('detail.supplier')}</dt>
              <dd className="font-medium">{po.supplierId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.project')}</dt>
              <dd className="font-medium">{po.projectId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.dateCreated')}</dt>
              <dd className="font-medium">{formatDate(po.dateCreated)}</dd>
            </div>
            {po.dateNeeded && (
              <div>
                <dt className="text-muted-foreground">{t('detail.dateNeeded')}</dt>
                <dd className="font-medium">{formatDate(po.dateNeeded)}</dd>
              </div>
            )}
            {po.deliveryAddress && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t('detail.address')}</dt>
                <dd className="font-medium">{po.deliveryAddress}</dd>
              </div>
            )}
            {po.paymentTermsDays != null && (
              <div>
                <dt className="text-muted-foreground">{t('detail.paymentTerms')}</dt>
                <dd className="font-medium">{po.paymentTermsDays} {t('detail.paymentDays')}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.items')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('items.description')}</TableHead>
                  <TableHead className="text-right">{t('items.quantity')}</TableHead>
                  <TableHead>{t('items.unit')}</TableHead>
                  <TableHead className="text-right">{t('items.unitPrice')}</TableHead>
                  <TableHead className="text-right">{t('items.total')}</TableHead>
                  <TableHead>{t('items.category')}</TableHead>
                  {showDelivery && <TableHead className="text-right">{t('items.delivery')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.total)}</TableCell>
                    <TableCell>{item.categoryCode}</TableCell>
                    {showDelivery && (
                      <TableCell className="text-right tabular-nums">{item.quantityReceived}/{item.quantity}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-2">
            {po.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">{item.description}</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.subtotal')}</span>
                <span className="tabular-nums">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.vat')} {po.taxRate}%</span>
                <span className="tabular-nums">{formatCurrency(po.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-base">
                <span>{t('detail.total')}</span>
                <span className="tabular-nums">{formatCurrency(po.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(po.supplierNotes || po.internalNotes) && (
        <Card>
          <CardHeader><CardTitle>{t('detail.notes')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {po.supplierNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('detail.supplierNotesPdf')}</p>
                <p className="text-sm whitespace-pre-wrap">{po.supplierNotes}</p>
              </div>
            )}
            {po.internalNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('detail.internalNotes')}</p>
                <p className="text-sm whitespace-pre-wrap">{po.internalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <nav className={cn(
        'flex flex-wrap gap-2',
        'sticky bottom-0 bg-background/95 py-3 backdrop-blur-sm',
        'md:static md:bg-transparent md:py-0 md:backdrop-blur-none',
      )}>
        {po.status === 'draft' && onApprove && (
          <Button onClick={onApprove}><CheckCircle className="mr-1.5 h-4 w-4" />{t('detail.approve')}</Button>
        )}
        {po.status === 'approved' && onMarkOrdered && (
          <Button onClick={onMarkOrdered}><Send className="mr-1.5 h-4 w-4" />{t('detail.markOrdered')}</Button>
        )}
        {['ordered', 'partially_delivered'].includes(po.status) && onRecordDelivery && (
          <Button onClick={onRecordDelivery}><PackageCheck className="mr-1.5 h-4 w-4" />{t('detail.recordDelivery')}</Button>
        )}
        {po.status === 'delivered' && onClose && (
          <Button onClick={onClose}><CheckCircle className="mr-1.5 h-4 w-4" />{t('detail.close')}</Button>
        )}
        {['draft', 'approved'].includes(po.status) && onEdit && (
          <Button variant="outline" onClick={onEdit}><Edit className="mr-1.5 h-4 w-4" />{t('detail.edit')}</Button>
        )}
        {onDuplicate && (
          <Button variant="outline" onClick={onDuplicate}><Copy className="mr-1.5 h-4 w-4" />{t('detail.duplicate')}</Button>
        )}
        {onExportPDF && (
          <Button variant="outline" onClick={onExportPDF}><FileText className="mr-1.5 h-4 w-4" />{t('detail.pdf')}</Button>
        )}
        {onCopyText && (
          <Button variant="outline" onClick={onCopyText}><Clipboard className="mr-1.5 h-4 w-4" />{t('detail.copyText')}</Button>
        )}
        {['draft', 'approved', 'ordered'].includes(po.status) && onCancel && (
          <Button variant="destructive" onClick={onCancel} className="ml-auto"><XCircle className="mr-1.5 h-4 w-4" />{t('detail.cancelPO')}</Button>
        )}
      </nav>
    </div>
  );
}
