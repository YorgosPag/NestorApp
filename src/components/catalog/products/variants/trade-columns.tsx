'use client';
/**
 * **Οι στήλες ταυτότητας εμπορίου του πλέγματος παραλλαγών** — GTIN · MPN · «Χωρίς GTIN» (ADR-934 Σ1β).
 *
 * Όπως η στήλη «Barcode» ανά παραλλαγή του Shopify: ένα GTIN **ανά εμπορεύσιμη μονάδα** (φύλλο). Κάθε κελί περνά από τον
 * **έναν** αναλυτή (`parseGtin`) ⇒ η επικόλληση από Excel κρίνεται όπως το πληκτρολογημένο, και ό,τι απορρίπτεται
 * ανακοινώνεται (ποτέ σιωπηλή «διόρθωση» ψηφίου). Οι αλλαγές περνούν από τις καθαρές πράξεις του `trade-identity`: GTIN
 * σβήνει το «χωρίς GTIN» και αντίστροφα. Ο **id** κάθε στήλης είναι το όνομα του πεδίου (`cellIssues` → `variants.<id>.gtin`).
 *
 * @module components/catalog/products/variants/trade-columns
 */

import { Badge } from '@/components/ui/badge';
import type { DataGridColumn, DataGridParse } from '@/components/ui/data-grid/data-grid-types';
import { parseGtin } from '@/lib/validation/gtin';
import { tradeWarningsOf } from '@/subapps/catalog/derived/trade-keys';
import { NO_VALUE_REASONS, type NoValueReason } from '@/subapps/catalog/types/product';
import { tradeIdentityOf, writeGtin, writeMpn, writeNoGtinReason } from '@/subapps/catalog/values/trade-identity';

import type { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { VariantColumnsInput } from './variant-columns';
import type { VariantRow } from './variant-rows';

type Column = DataGridColumn<VariantRow>;
/** Οι λέξεις του καταλόγου (`useCatalogText` ⇒ namespace `catalog`, ADR-744 §18) — δανεισμένες από τον καλούντα. */
type CatalogWords = Pick<ReturnType<typeof useCatalogText>, 't'>;

const withDefinition = (row: VariantRow, definition: VariantRow['definition']): DataGridParse<VariantRow> => ({ ok: true, row: { ...row, definition } });

function gtinColumn(input: VariantColumnsInput): Column {
  const { t }: CatalogWords = input.words;
  const text = (row: VariantRow) => tradeIdentityOf(row.definition).gtin ?? '';
  return {
    id: 'gtin',
    header: t('trade.gtin'),
    label: t('trade.gtin'),
    width: 'md',
    text,
    render: (row) => {
      const warnings = tradeWarningsOf(row.definition);
      if (warnings.length === 0) return text(row);
      return (
        <span className="inline-flex items-center gap-2">
          {text(row)}
          <Badge variant="warning">{warnings[0].code === 'gtinNotMatchable' ? t('trade.internalCode') : t('trade.packagingCode')}</Badge>
        </span>
      );
    },
    parse: (entered, row) => {
      if (entered.trim() === '') return withDefinition(row, writeGtin(row.definition, null));
      const parsed = parseGtin(entered);
      if (parsed.kind === 'invalid') return { ok: false, issue: input.message({ code: 'gtinInvalid', path: '', params: { reason: parsed.reason } }) };
      return withDefinition(row, writeGtin(row.definition, parsed.digits));
    },
  };
}

function mpnColumn(input: VariantColumnsInput): Column {
  const { t }: CatalogWords = input.words;
  return {
    id: 'mpn',
    header: t('trade.mpn'),
    label: t('trade.mpn'),
    width: 'md',
    text: (row) => tradeIdentityOf(row.definition).mpn ?? '',
    parse: (entered, row) => withDefinition(row, writeMpn(row.definition, entered)),
  };
}

/** Κείμενο του κελιού → λόγος: ο κωδικός **ή** η λέξη της οθόνης (επικόλληση από ό,τι αντέγραψε ο άνθρωπος). */
function reasonOf(entered: string, labelOf: (reason: NoValueReason) => string): NoValueReason | null | undefined {
  const folded = entered.trim().toLocaleLowerCase();
  if (folded === '') return null;
  return NO_VALUE_REASONS.find((reason) => reason.toLowerCase() === folded || labelOf(reason).toLocaleLowerCase() === folded);
}

function noGtinColumn(input: VariantColumnsInput): Column {
  const { t }: CatalogWords = input.words;
  const labelOf = (reason: NoValueReason) => t(`values.noValue.${reason}`);
  const text = (row: VariantRow) => {
    const { noGtinReason } = tradeIdentityOf(row.definition);
    return noGtinReason === null ? '' : labelOf(noGtinReason);
  };
  return {
    id: 'noGtinReason',
    header: t('trade.noGtinReason'),
    label: t('trade.noGtinReason'),
    width: 'md',
    text,
    parse: (entered, row) => {
      const reason = reasonOf(entered, labelOf);
      if (reason === undefined) return { ok: false, issue: t('trade.noGtinHelp') };
      return withDefinition(row, writeNoGtinReason(row.definition, reason, row.stored));
    },
    choices: () => NO_VALUE_REASONS.map((reason) => ({ text: labelOf(reason), label: labelOf(reason) })),
  };
}

/** Οι τρεις στήλες, με τη σειρά του Google Merchant: GTIN → MPN → «χωρίς αναγνωριστικό». */
export function tradeColumns(input: VariantColumnsInput): Column[] {
  return [gtinColumn(input), mpnColumn(input), noGtinColumn(input)];
}
