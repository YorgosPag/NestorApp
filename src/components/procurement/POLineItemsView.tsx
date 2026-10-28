'use client';

/**
 * POLineItemsView — ο πίνακας ΠΡΟΒΟΛΗΣ των γραμμών μιας παραγγελίας, ΙΔΙΟΣ σε εσωτερική
 * και δημόσια σελίδα (ADR-923 §5.11 «3γ»). Ο επεξεργαστής γραμμών είναι το `PurchaseOrderItemsTable`.
 *
 * Η κατηγορία και η παραλαβή είναι προαιρετικές στήλες: η δημόσια σελίδα του προμηθευτή δεν τις δείχνει.
 *
 * @module components/procurement/POLineItemsView
 */

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PurchaseOrderItem } from '@/types/procurement';
import { formatPOCurrency } from './utils/procurement-format';
import { useUomLabel } from '@/hooks/useUomLabel';

/** What the table reads — the internal line and the public projection (ADR-923 «3γ» Α12) both fit. */
export type POLineItemViewModel = Pick<PurchaseOrderItem, 'id' | 'description' | 'quantity' | 'unit' | 'unitPrice' | 'total'>
  & Partial<Pick<PurchaseOrderItem, 'categoryCode' | 'quantityReceived'>>;

interface POLineItemsViewProps {
  items: readonly POLineItemViewModel[];
  showCategory?: boolean;
  showDelivery?: boolean;
}

export function POLineItemsView({ items, showCategory = false, showDelivery = false }: POLineItemsViewProps) {
  const { t } = useTranslation('procurement');
  const uomLabel = useUomLabel();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('items.description')}</TableHead>
          <TableHead className="text-right">{t('items.quantity')}</TableHead>
          <TableHead>{t('items.unit')}</TableHead>
          <TableHead className="text-right">{t('items.unitPrice')}</TableHead>
          <TableHead className="text-right">{t('items.total')}</TableHead>
          {showCategory && <TableHead>{t('items.category')}</TableHead>}
          {showDelivery && <TableHead className="text-right">{t('items.delivery')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.description}</TableCell>
            <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
            <TableCell>{uomLabel(item.unit)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatPOCurrency(item.unitPrice)}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">{formatPOCurrency(item.total)}</TableCell>
            {showCategory && <TableCell>{item.categoryCode}</TableCell>}
            {showDelivery && (
              <TableCell className="text-right tabular-nums">{item.quantityReceived}/{item.quantity}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
