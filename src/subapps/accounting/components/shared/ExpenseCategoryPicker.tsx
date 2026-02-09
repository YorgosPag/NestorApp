'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountCategory } from '@/subapps/accounting/types';

interface ExpenseCategoryPickerProps {
  value: AccountCategory;
  onValueChange: (category: AccountCategory) => void;
  type: 'income' | 'expense';
  disabled?: boolean;
}

const INCOME_CATEGORIES: { code: AccountCategory; label: string }[] = [
  { code: 'service_income', label: 'Αμοιβές Υπηρεσιών' },
  { code: 'construction_income', label: 'Κατασκευαστικά Έσοδα' },
  { code: 'construction_res_income', label: 'Κατασκευαστικά (Οικιστικά)' },
  { code: 'asset_sale_income', label: 'Πώληση Παγίου' },
  { code: 'other_income', label: 'Λοιπά Έσοδα' },
];

const EXPENSE_CATEGORIES: { code: AccountCategory; label: string }[] = [
  { code: 'third_party_fees', label: 'Αμοιβές Τρίτων' },
  { code: 'rent', label: 'Ενοίκια' },
  { code: 'utilities', label: 'Κοινόχρηστα/ΔΕΗ' },
  { code: 'telecom', label: 'Τηλεπικοινωνίες' },
  { code: 'fuel', label: 'Καύσιμα' },
  { code: 'vehicle_expenses', label: 'Έξοδα Οχήματος' },
  { code: 'vehicle_insurance', label: 'Ασφάλεια Οχήματος' },
  { code: 'office_supplies', label: 'Αναλώσιμα Γραφείου' },
  { code: 'software', label: 'Λογισμικό/Συνδρομές' },
  { code: 'equipment', label: 'Εξοπλισμός' },
  { code: 'travel', label: 'Μετακινήσεις/Ταξίδια' },
  { code: 'training', label: 'Εκπαίδευση' },
  { code: 'advertising', label: 'Διαφήμιση' },
  { code: 'efka', label: 'ΕΦΚΑ Εισφορές' },
  { code: 'professional_tax', label: 'Τέλος Επιτηδεύματος' },
  { code: 'bank_fees', label: 'Τραπεζικά Έξοδα' },
  { code: 'tee_fees', label: 'Εισφορές ΤΕΕ' },
  { code: 'depreciation', label: 'Αποσβέσεις' },
  { code: 'other_expense', label: 'Λοιπά Έξοδα' },
];

export function ExpenseCategoryPicker({
  value,
  onValueChange,
  type,
  disabled,
}: ExpenseCategoryPickerProps) {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as AccountCategory)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {categories.map(({ code, label }) => (
          <SelectItem key={code} value={code}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
