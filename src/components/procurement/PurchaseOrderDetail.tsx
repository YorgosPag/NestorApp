'use client';

/**
 * PurchaseOrderDetail — Read-only PO view with status actions
 *
 * Shows PO header, line items, totals, notes, and action buttons.
 * Responsive layout.
 *
 * @see ADR-267 §8.4 (PO Detail View)
 */

import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/design-system';
import {
  CheckCircle, Send, PackageCheck, XCircle, Copy, Edit, Clipboard, Loader2,
} from 'lucide-react';
import type { PurchaseOrder } from '@/types/procurement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PurchaseOrderActions } from './PurchaseOrderActions';
import { POTotalsSummary } from './POTotalsSummary';
import { POLineItemsView } from './POLineItemsView';
import { PurchaseOrderDetailsHeader } from './PurchaseOrderDetailsHeader';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { formatPOCurrency, formatPODate } from './utils/procurement-format';
import { useUomLabel } from '@/hooks/useUomLabel';

const ActivityTab = lazy(() =>
  import('@/components/shared/audit/ActivityTab').then((m) => ({ default: m.ActivityTab }))
);

interface PurchaseOrderDetailProps {
  po: PurchaseOrder;
  onApprove?: () => void;
  onMarkOrdered?: () => void;
  onRecordDelivery?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onCreateNew?: () => void;
  onExportPDF?: () => void;
  onCopyText?: () => void;
}

export function PurchaseOrderDetail({
  po, onApprove, onMarkOrdered, onRecordDelivery, onClose,
  onCancel, onEdit, onDuplicate, onCreateNew,
  onExportPDF: _onExportPDF, onCopyText,
}: PurchaseOrderDetailProps) {
  const { t } = useTranslation('procurement');
  const uomLabel = useUomLabel();

  // Resolve IDs → display names
  const { projects } = useFirestoreProjects();
  const { buildings } = useFirestoreBuildings();
  const supplierContact = useContactById(po.supplierId);

  const projectName = projects.find((p) => p.id === po.projectId)?.name ?? po.projectId;
  const supplierName = supplierContact
    ? getContactDisplayName(supplierContact)
    : po.supplierId;
  const buildingName = po.buildingId
    ? (buildings.find((b) => b.id === po.buildingId)?.name ?? po.buildingId)
    : null;

  const showDelivery = ['ordered', 'partially_delivered', 'delivered'].includes(po.status);

  return (
    <div className="space-y-6">
      {/* SSoT detail header — title + status pill + entity actions */}
      <PurchaseOrderDetailsHeader
        po={po}
        onCreateNew={onCreateNew}
        onEdit={onEdit}
        onCancel={onCancel}
      />

      {/* Phase B: Actions toolbar (PDF, Email, Share) */}
      <PurchaseOrderActions po={po} />

      {/* Header — supplier / project / dates / address */}
      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('detail.supplier')}</dt>
              <dd className="font-medium">{supplierName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.project')}</dt>
              <dd className="font-medium">{projectName}</dd>
            </div>
            {buildingName && (
              <div>
                <dt className="text-muted-foreground">{t('form.building')}</dt>
                <dd className="font-medium">{buildingName}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('detail.dateCreated')}</dt>
              <dd className="font-medium">{formatPODate(po.dateCreated)}</dd>
            </div>
            {po.dateNeeded && (
              <div>
                <dt className="text-muted-foreground">{t('detail.dateNeeded')}</dt>
                <dd className="font-medium">{formatPODate(po.dateNeeded)}</dd>
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
            <POLineItemsView items={po.items} showCategory showDelivery={showDelivery} />
          </div>

          <div className="md:hidden space-y-2">
            {po.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">{item.description}</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{item.quantity} {uomLabel(item.unit)} × {formatPOCurrency(item.unitPrice)}</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatPOCurrency(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <POTotalsSummary
            totals={{
              subtotal: po.subtotal,
              discountAmount: po.faDiscountAmount,
              taxableAmount: po.taxableAmount,
              taxAmount: po.taxAmount,
              total: po.total,
            }}
            taxRate={po.taxRate}
          />
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

      {/* Phase B: Activity Tab */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <p className="text-sm text-muted-foreground py-4">
            {t('activity.noHistory')}
          </p>
        </TabsContent>
        <TabsContent value="activity">
          <Suspense fallback={<Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />}>
            <ActivityTab entityType="purchase_order" entityId={po.id} />
          </Suspense>
        </TabsContent>
      </Tabs>

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
