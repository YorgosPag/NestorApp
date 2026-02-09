'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import type { InvoiceType } from '@/subapps/accounting/types';

interface InvoiceFilterState {
  fiscalYear: number;
  type: InvoiceType | '';
  paymentStatus: '' | 'unpaid' | 'partial' | 'paid';
}

interface InvoiceFiltersProps {
  filters: InvoiceFilterState;
  onFilterChange: (partial: Partial<InvoiceFilterState>) => void;
}

const INVOICE_TYPES: InvoiceType[] = [
  'service_invoice',
  'sales_invoice',
  'retail_receipt',
  'service_receipt',
  'credit_invoice',
];

export function InvoiceFilters({ filters, onFilterChange }: InvoiceFiltersProps) {
  const { t } = useTranslation('accounting');

  return (
    <nav className="flex flex-wrap gap-3">
      <div className="w-32">
        <FiscalYearPicker
          value={filters.fiscalYear}
          onValueChange={(year) => onFilterChange({ fiscalYear: year })}
        />
      </div>

      <div className="w-48">
        <Select
          value={filters.type || 'all'}
          onValueChange={(v) => onFilterChange({ type: v === 'all' ? '' : v as InvoiceType })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('invoices.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {INVOICE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`invoices.types.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select
          value={filters.paymentStatus || 'all'}
          onValueChange={(v) =>
            onFilterChange({ paymentStatus: v === 'all' ? '' : v as 'unpaid' | 'partial' | 'paid' })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('invoices.paymentStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="unpaid">{t('invoices.paymentStatuses.unpaid')}</SelectItem>
            <SelectItem value="partial">{t('invoices.paymentStatuses.partial')}</SelectItem>
            <SelectItem value="paid">{t('invoices.paymentStatuses.paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
