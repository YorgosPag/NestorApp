'use client';

import { useRouter } from '@/lib/workspace/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ProcurementRowLink,
  ProcurementTableNotice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/procurement/shared/procurement-table-parts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { PurchaseOrderStatusBadge } from '@/components/procurement/PurchaseOrderStatusBadge';
import type { PurchaseOrder } from '@/types/procurement';

interface ContactPurchaseOrdersSectionProps {
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
}

export function ContactPurchaseOrdersSection({
  purchaseOrders,
  loading,
}: ContactPurchaseOrdersSectionProps) {
  const { t } = useTranslation(['contacts', 'procurement']);
  const router = useRouter();

  const visible = purchaseOrders.filter((po) => !po.isDeleted);
  const handleView = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) router.push(getPoDetailUrl(po.projectId, po.id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t('contacts:procurementTab.sections.purchaseOrders')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ProcurementTableNotice>
            {t('procurement:list.loading')}
          </ProcurementTableNotice>
        ) : visible.length === 0 ? (
          <ProcurementTableNotice>
            {t('procurement:list.empty')}
          </ProcurementTableNotice>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('procurement:list.number')}</TableHead>
                <TableHead>{t('procurement:list.status')}</TableHead>
                <TableHead>{t('procurement:list.dateOrdered')}</TableHead>
                <TableHead className="text-right">
                  {t('procurement:list.total')}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((po) => (
                <ProcurementRowLink
                  key={po.id}
                  onClick={() => handleView(po.id)}
                >
                  <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
                  <TableCell>
                    <PurchaseOrderStatusBadge status={po.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {po.dateOrdered ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(po.total)}
                  </TableCell>
                </ProcurementRowLink>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
