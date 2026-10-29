'use client';

/**
 * @fileoverview **Οι στήλες του πλέγματος γραμμών τιμοκαταλόγου** (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related price-line-rows.ts (καθαρό μοντέλο) · products/variants/variant-columns.tsx (το ίδιο ιδίωμα) ·
 *   ui/data-grid/data-grid-types.ts (μία γραμματική κειμένου ανά στήλη: `text` ⇄ `parse`)
 * @module components/catalog/pricing/price-line-columns
 *
 * 🔑 **Πληκτρολόγηση = επικόλληση από Excel**: κάθε στήλη περνά από **ένα** `parse` — «12,50» · «1.200,5» · «τεμ.» · «m²»
 *    διαβάζονται ίδια είτε γράφονται στο κελί είτε έρχονται με Ctrl+V. Άκυρο κείμενο **απορρίπτεται με λόγο**, ποτέ
 *    σιωπηλή στρογγύλευση (τρίτο δεκαδικό) ή «κοντινή» μονάδα.
 * 🔑 Ο κωδικός SKU κλειδώνει σε αποθηκευμένη γραμμή: η ταυτότητα της γραμμής **είναι** το υποκείμενο — αλλαγή SKU είναι
 *    διαγραφή + νέα γραμμή (το κάνει ο άνθρωπος ρητά), όχι σιωπηλή μετακόμιση τιμής.
 * 🔑 «Τιμή ανά 1» υπολογίζεται, δεν πληκτρολογείται: 84 € ανά 100 ⇒ 0,84 € — ο άνθρωπος βλέπει τη σύγκριση που κάνει και ο φράχτης.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

import type { DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import { majorFromMinor, MONEY_CURRENCY } from '@/lib/money/money';
import { normalizeUomText, resolveUom, UOM_CODES } from '@/lib/uom/uom-registry';
import type { UomLabelForm } from '@/lib/uom/uom-label';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { isPriceQuantity, PRICE_QUANTITIES } from '@/subapps/catalog/vocabulary/pricing';
import type { useCatalogText } from '../shared/catalog-ui-hooks';
import { minorFromEnteredText, withEnteredCode, type PriceLineRow } from './price-line-rows';

type Column = DataGridColumn<PriceLineRow>;

export interface PriceLineColumnsInput {
  readonly words: Pick<ReturnType<typeof useCatalogText>, 't' | 'text'>;
  readonly uom: (raw: string, form?: UomLabelForm) => string;
  readonly message: (issue: CatalogIssue) => string;
  /** `null` ⇒ ο τύπος τιμής δεν δέχεται ομάδες έκπτωσης (καθαρή τιμή πελάτη) — η στήλη δεν υπάρχει. */
  readonly discountGroups: readonly DiscountGroupWire[] | null;
}

/** Στήλη ↔ διαδρομή ευρήματος της επικύρωσης (ίδια με τον γραφέα). */
export const PRICE_LINE_ISSUE_PATHS: Readonly<Record<string, string>> = {
  code: 'subject',
  unit: 'unitCode',
  priceQuantity: 'priceQuantity',
  netPrice: 'netPrice',
  discountGroup: 'discountGroupId',
};

const reject = (input: PriceLineColumnsInput, code: CatalogIssue['code']) => ({ ok: false as const, issue: input.message({ code, path: '' }) });

function codeColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'code',
    header: t('pricing.lines.columns.sku'),
    label: t('pricing.lines.columns.sku'),
    width: 'lg',
    sticky: true,
    text: (row) => row.code,
    render: (row) => (
      <span className="flex items-center gap-1 font-mono">
        {row.resolution === 'pending' && row.code !== '' ? <Loader2 className="h-3 w-3 animate-spin" aria-label={t('pricing.lines.resolving')} /> : null}
        {row.code}
      </span>
    ),
    parse: (text, row) => ({ ok: true, row: withEnteredCode(row, text) }),
    lock: (row) => (row.stored !== null ? { reason: t('pricing.lines.skuLocked') } : null),
  };
}

/** Μονάδα: δέχεται κωδικό μητρώου, ψευδώνυμο ή την ετικέτα της οθόνης (σύμβολο/όνομα) — ποτέ «κοντινή». */
function unitOf(text: string, uom: PriceLineColumnsInput['uom']): string | null {
  const key = normalizeUomText(text);
  const byLabel = UOM_CODES.find((code) => normalizeUomText(uom(code)) === key || normalizeUomText(uom(code, 'name')) === key);
  return byLabel ?? resolveUom(text);
}

function unitColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'unit',
    header: t('pricing.lines.columns.unit'),
    label: t('pricing.lines.columns.unit'),
    width: 'sm',
    text: (row) => input.uom(row.unitCode),
    parse: (text, row) => {
      const unitCode = unitOf(text, input.uom);
      return unitCode === null ? reject(input, 'measurementUnitUnknown') : { ok: true, row: { ...row, unitCode } };
    },
    choices: () => UOM_CODES.map((code) => ({ text: input.uom(code), label: input.uom(code, 'name') })),
  };
}

function quantityColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'priceQuantity',
    header: t('pricing.lines.columns.priceQuantity'),
    label: t('pricing.lines.columns.priceQuantity'),
    width: 'sm',
    align: 'end',
    text: (row) => String(row.priceQuantity),
    parse: (text, row) => {
      const value = Number(text.trim().replace(/\./g, ''));
      return isPriceQuantity(value) ? { ok: true, row: { ...row, priceQuantity: value } } : reject(input, 'priceQuantityInvalid');
    },
    choices: () => PRICE_QUANTITIES.map((quantity) => ({ text: String(quantity), label: t('pricing.lines.per', { quantity }) })),
  };
}

const MONEY_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

function priceColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  return {
    id: 'netPrice',
    header: t('pricing.lines.columns.netPrice'),
    label: t('pricing.lines.columns.netPrice'),
    width: 'md',
    align: 'end',
    text: (row) => (row.netPrice === null ? '' : formatNumber(majorFromMinor(row.netPrice), MONEY_DIGITS)),
    parse: (text, row) => {
      const netPrice = minorFromEnteredText(text);
      return netPrice === null ? reject(input, 'priceAmountInvalid') : { ok: true, row: { ...row, netPrice } };
    },
    lock: (row) => (row.breakdown !== null ? { reason: t('pricing.lines.breakdownLocked') } : null),
  };
}

function discountGroupColumn(input: PriceLineColumnsInput, groups: readonly DiscountGroupWire[]): Column {
  const { t, text } = input.words;
  const byId = new Map(groups.map((group) => [group.id, group]));
  return {
    id: 'discountGroup',
    header: t('pricing.lines.columns.discountGroup'),
    label: t('pricing.lines.columns.discountGroup'),
    width: 'md',
    text: (row) => (row.discountGroupId === null ? '' : byId.get(row.discountGroupId)?.code ?? row.discountGroupId),
    render: (row) => {
      const group = row.discountGroupId === null ? null : byId.get(row.discountGroupId);
      return group ? text(group.labels, group.code) : (row.discountGroupId ?? '');
    },
    parse: (entered, row) => {
      const wanted = entered.trim().toLocaleLowerCase('el');
      if (wanted === '') return { ok: true, row: { ...row, discountGroupId: null } };
      const group = groups.find((candidate) => candidate.code.toLocaleLowerCase('el') === wanted);
      return group ? { ok: true, row: { ...row, discountGroupId: group.id } } : reject(input, 'unknownReference');
    },
    choices: () => groups.map((group) => ({ text: group.code, label: text(group.labels, group.code) })),
  };
}

function unitPriceColumn(input: PriceLineColumnsInput): Column {
  const { t } = input.words;
  const perOne = (row: PriceLineRow) =>
    row.netPrice === null ? '' : formatCurrency(majorFromMinor(row.netPrice) / row.priceQuantity, MONEY_CURRENCY, { maximumFractionDigits: 4 });
  return { id: 'perOne', header: t('pricing.lines.columns.perOne'), label: t('pricing.lines.columns.perOne'), width: 'md', align: 'end', text: perOne };
}

export function priceLineColumns(input: PriceLineColumnsInput): Column[] {
  const groups = input.discountGroups === null ? [] : [discountGroupColumn(input, input.discountGroups)];
  return [codeColumn(input), unitColumn(input), quantityColumn(input), priceColumn(input), ...groups, unitPriceColumn(input)];
}
