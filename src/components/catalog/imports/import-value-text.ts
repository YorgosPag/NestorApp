'use client';

/**
 * @fileoverview **Η εμφάνιση μιας τιμής της πρότασης** (ADR-923 §5.5 · §23.2 K4): η εισαγωγή δεν ξαναμορφοποιεί, δείχνει ό,τι
 *   βγήκε. Ο λόγος απουσίας με τις **ίδιες** λέξεις του επεξεργαστή τιμών (`NO_VALUE_REASON_KEYS`, namespace `catalog`).
 * @module components/catalog/imports/import-value-text
 *
 * 🔑 **Χωριστό αρχείο επίτηδες**: ο γεννήτορας των route slices (CHECK 3.34, ADR-744) δένει τα κλειδιά ενός αρχείου στα
 *    namespaces του. Δύο `t` από δύο namespaces στο ίδιο αρχείο ⇒ ζητούσε `catalog-import:values.noValue.*` και
 *    `catalog:mapping.*`, κλειδιά που δεν υπάρχουν. Ένα αρχείο = ένα namespace.
 */

import { useCallback } from 'react';

import { formatMinor } from '@/lib/money/money';
import type { ImportFieldValue } from '@/subapps/catalog/types/catalog-import';
import type { NoValueReason } from '@/subapps/catalog/types/product';
import { NO_VALUE_REASON_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';

function valueText(value: ImportFieldValue | null, reasonLabel: (reason: NoValueReason) => string): string {
  if (value === null) return '';
  switch (value.type) {
    case 'text': return value.text;
    case 'richText': return value.html;
    case 'number': return value.amount;
    case 'measurement': return `${value.amount} ${value.unitCode}`;
    case 'boolean': return String(value.value);
    case 'select': return value.optionCode;
    case 'multiSelect': return value.optionCodes.join(', ');
    case 'date': return value.date;
    case 'money': return formatMinor(value.minor);
    case 'priceQuantity': return String(value.quantity);
    case 'unit': return value.unitCode;
    case 'discountGroup': return value.discountGroupId ?? '';
    case 'noValueReason': return reasonLabel(value.reason);
    default: return '';
  }
}

export function useImportValueText(): (value: ImportFieldValue | null) => string {
  const { t } = useCatalogText();
  return useCallback((value: ImportFieldValue | null) => valueText(value, (reason) => t(NO_VALUE_REASON_KEYS[reason])), [t]);
}
