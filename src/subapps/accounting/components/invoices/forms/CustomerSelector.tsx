'use client';

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { InvoiceCustomer } from '@/subapps/accounting/types';

interface CustomerSelectorProps {
  customer: InvoiceCustomer;
  onCustomerChange: (customer: InvoiceCustomer) => void;
}

export function CustomerSelector({ customer, onCustomerChange }: CustomerSelectorProps) {
  const { t } = useTranslation('accounting');

  const updateField = (field: keyof InvoiceCustomer, value: string | null) => {
    onCustomerChange({ ...customer, [field]: value || null });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset>
          <Label htmlFor="customerName">{t('invoices.customer')} *</Label>
          <Input
            id="customerName"
            value={customer.name}
            onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })}
            required
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerVat">ΑΦΜ</Label>
          <Input
            id="customerVat"
            value={customer.vatNumber ?? ''}
            onChange={(e) => updateField('vatNumber', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerTaxOffice">ΔΟΥ</Label>
          <Input
            id="customerTaxOffice"
            value={customer.taxOffice ?? ''}
            onChange={(e) => updateField('taxOffice', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerAddress">Διεύθυνση</Label>
          <Input
            id="customerAddress"
            value={customer.address ?? ''}
            onChange={(e) => updateField('address', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerCity">Πόλη</Label>
          <Input
            id="customerCity"
            value={customer.city ?? ''}
            onChange={(e) => updateField('city', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerPostalCode">ΤΚ</Label>
          <Input
            id="customerPostalCode"
            value={customer.postalCode ?? ''}
            onChange={(e) => updateField('postalCode', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerEmail">Email</Label>
          <Input
            id="customerEmail"
            type="email"
            value={customer.email ?? ''}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </fieldset>
      </div>
    </div>
  );
}
