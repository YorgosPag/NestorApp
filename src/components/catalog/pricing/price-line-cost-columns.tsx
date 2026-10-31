'use client';

/**
 * @fileoverview **Οι στήλες του τιμοκαταλόγου κόστους** — εργασίες ΑΤΟΕ με ανάλυση (ADR-923 §5.11 «3ε» · ADR-175 §4.1.3).
 * @related price-line-columns.tsx (κοινές στήλες · ίδια γραμματική `parse`) · price-line-rows.ts (καθαρό μοντέλο)
 * @module components/catalog/pricing/price-line-cost-columns
 *
 * 🔑 Η τιμή **παράγεται** από υλικό + εργασία + εξοπλισμό (rate build-up): δεν υπάρχει κελί να πληκτρολογηθεί.
 * 🔑 Κωδικός και περιοχή είναι η ταυτότητα της γραμμής ⇒ κλειδώνουν σε αποθηκευμένη, όπως ο κωδικός SKU.
 * 🔑 Η επικόλληση από Excel δουλεύει όπως στις πωλήσεις: κάθε στήλη περνά από **ένα** `parse`, και το «ΟΙΚ-4.01» με ελληνικά
 *    γράμματα γίνεται `OIK-4.01`, ώστε να βρίσκει τη γραμμή BIM.
 */

import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import { majorFromMinor, MONEY_CURRENCY, type MinorAmount } from '@/lib/money/money';
import { basisPointsFromPercent, effectivePercent } from '@/lib/pricing/discount-rule';
import { parseEnteredAmount } from '@/subapps/catalog/values/decimal-amount';
import {
  MONEY_DIGITS,
  quantityColumn,
  reject,
  unitColumn,
  type PriceLineColumn as Column,
  type PriceLineColumnsInput,
} from './price-line-columns';
import { EMPTY_BREAKDOWN, breakdownTotal, minorFromEnteredText, withBreakdown, withCostSubject, type PriceLineRow } from './price-line-rows';

type BreakdownPart = 'material' | 'labor' | 'equipment';

const moneyOf = (amount: MinorAmount): string => formatNumber(majorFromMinor(amount), MONEY_DIGITS);

function atoeColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'code',
    header: t('pricing.lines.columns.atoe'),
    label: t('pricing.lines.columns.atoe'),
    width: 'md',
    sticky: true,
    text: (row) => row.code,
    parse: (text, row) => ({ ok: true, row: withCostSubject(row, text, row.region) }),
    lock: (row) => (row.stored !== null ? { reason: t('pricing.lines.skuLocked') } : null),
  };
}

function regionColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'region',
    header: t('pricing.lines.columns.region'),
    label: t('pricing.lines.columns.region'),
    width: 'md',
    text: (row) => row.region ?? '',
    parse: (text, row) => ({ ok: true, row: withCostSubject(row, row.code, text) }),
    lock: (row) => (row.stored !== null ? { reason: t('pricing.lines.skuLocked') } : null),
  };
}

function descriptionColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'description',
    header: t('pricing.lines.columns.description'),
    label: t('pricing.lines.columns.description'),
    width: 'lg',
    text: (row) => row.breakdown?.description ?? '',
    parse: (text, row) => ({ ok: true, row: withBreakdown(row, { description: text.trim() === '' ? null : text.trim() }) }),
  };
}

function partColumn(input: PriceLineColumnsInput, part: BreakdownPart, title: string): Column {
  return {
    id: part,
    header: title,
    label: title,
    width: 'md',
    align: 'end',
    text: (row) => moneyOf((row.breakdown ?? EMPTY_BREAKDOWN)[part]),
    parse: (text, row) => {
      const amount = minorFromEnteredText(text);
      return amount === null ? reject(input, 'priceAmountInvalid') : { ok: true, row: withBreakdown(row, { [part]: amount }) };
    },
  };
}

function wasteColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'waste',
    header: t('pricing.lines.columns.waste'),
    label: t('pricing.lines.columns.waste'),
    width: 'sm',
    align: 'end',
    text: (row) => formatNumber(effectivePercent([(row.breakdown ?? EMPTY_BREAKDOWN).defaultWasteBp])),
    parse: (text, row) => {
      const parsed = parseEnteredAmount(text);
      const bp = parsed === null ? null : basisPointsFromPercent(parsed.value);
      return bp === null ? reject(input, 'discountStepInvalid') : { ok: true, row: withBreakdown(row, { defaultWasteBp: bp }) };
    },
  };
}

function totalColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  const total = (row: PriceLineRow) => formatCurrency(majorFromMinor(breakdownTotal(row.breakdown ?? EMPTY_BREAKDOWN)), MONEY_CURRENCY);
  return { id: 'netPrice', header: t('pricing.lines.columns.total'), label: t('pricing.lines.columns.total'), width: 'md', align: 'end', text: total };
}

export function costLineColumns(input: PriceLineColumnsInput): Column[] {
  const { t } = input.words;
  return [
    atoeColumn(input),
    descriptionColumn(input),
    regionColumn(input),
    unitColumn(input),
    quantityColumn(input),
    partColumn(input, 'material', t('pricing.lines.columns.material')),
    partColumn(input, 'labor', t('pricing.lines.columns.labor')),
    partColumn(input, 'equipment', t('pricing.lines.columns.equipment')),
    wasteColumn(input),
    totalColumn(input),
  ];
}
