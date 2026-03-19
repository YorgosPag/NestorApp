'use client';

/**
 * @fileoverview Transaction Chain Card — ADR-198 §5
 * @description Εμφανίζει τα λογιστικά παραστατικά (invoices) μιας πώλησης
 * @pattern Enterprise card with Firestore invoice list
 */

import React, { useEffect, useState } from 'react';
import { Receipt, FileText, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDate as formatDateIntl } from '@/lib/intl-utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

// =============================================================================
// TYPES
// =============================================================================

interface TransactionChainCardProps {
  unitId: string;
}

interface InvoiceSummary {
  invoiceId: string;
  type: string;
  series: string;
  number: number;
  issueDate: string;
  totalGrossAmount: number;
  paymentStatus: string;
}

/** apiClient.get() αυτόματα unwraps canonical { success, data } → επιστρέφει μόνο data */
interface InvoiceListResponse {
  items: InvoiceSummary[];
  hasNext: boolean;
  totalShown: number;
  pageSize: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(isoDate: string): string {
  try {
    return formatDateIntl(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

// Invoice type label resolved via i18n in render (sales.saleInfo.invoiceType.*)

function getInvoiceIcon(type: string): React.ElementType {
  switch (type) {
    case 'credit_invoice': return CreditCard;
    default: return FileText;
  }
}

function getPaymentBadgeClass(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
}

// Payment status label resolved via i18n in render (sales.saleInfo.paymentStatus.*)

// =============================================================================
// COMPONENT
// =============================================================================

export function TransactionChainCard({ unitId }: TransactionChainCardProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchInvoices() {
      try {
        const response = await apiClient.get<InvoiceListResponse>(
          `${API_ROUTES.ACCOUNTING.INVOICES.LIST}?unitId=${encodeURIComponent(unitId)}`
        );
        if (!cancelled && response.items) {
          setInvoices(response.items);
        }
      } catch {
        // Graceful — αν δεν υπάρχουν invoices ή λογιστική, δεν εμφανίζεται
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInvoices();
    return () => { cancelled = true; };
  }, [unitId]);

  // Μην εμφανίζεις τίποτα αν δεν υπάρχουν invoices
  if (loading || invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Receipt className={`${iconSizes.sm} text-indigo-600`} />
          {t('sales.saleInfo.invoices')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <ul className="space-y-2" role="list">
          {invoices.map((inv) => {
            const Icon = getInvoiceIcon(inv.type);
            return (
              <li
                key={inv.invoiceId}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Icon className={`${iconSizes.sm} text-muted-foreground flex-shrink-0`} />
                  <span className="font-medium">
                    {t(`sales.saleInfo.invoiceType.${inv.type}`)} {inv.series}-{inv.number}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(inv.issueDate)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {inv.type === 'credit_invoice' ? '−' : ''}
                    {formatCurrency(inv.totalGrossAmount)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getPaymentBadgeClass(inv.paymentStatus)}`}>
                    {t(`sales.saleInfo.paymentStatus.${inv.paymentStatus}`)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
