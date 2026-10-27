'use client';
/**
 * **Οι στήλες του πλέγματος παραλλαγών** (ADR-923 §5.10.4 Β4).
 *
 * Κάθε κελί περνά από τον **κοινό** κωδικοποιητή (`value-text-codec`) στη θέση **κανάλι × γλώσσα** της οθόνης — ό,τι
 * επικολλάς από Excel διαβάζεται όπως το πληκτρολογημένο στο πεδίο του επεξεργαστή. Τύποι χωρίς κειμενική μορφή
 * (αναφορά · πίνακας) κλειδώνουν με λόγο («μέσω του επεξεργαστή»)· ο **άξονας** αποθηκευμένης γραμμής κλειδώνει (η ταυτότητά
 * της — ADR-923 §5.10.5). Η πληρότητα κάθε γραμμής, ζωντανά, μόνο για ανάγνωση.
 *
 * @module components/catalog/products/variants/variant-columns
 */

import { Badge } from '@/components/ui/badge';
import type { DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { writeHolderValue } from '@/subapps/catalog/values/holder-edit';
import { readSlot } from '@/subapps/catalog/values/value-shape';
import { formatAttributeValue, hasTextForm, parseAttributeText } from '@/subapps/catalog/values/value-text-codec';

import type { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';
import type { VariantRow } from './variant-rows';

type Column = DataGridColumn<VariantRow>;

export interface VariantColumnsInput {
  readonly columnIds: readonly string[];
  readonly axisIds: readonly string[];
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
  readonly message: (issue: CatalogIssue) => string;
  readonly percentOf: (row: VariantRow) => number | null;
  readonly words: Pick<ReturnType<typeof useCatalogText>, 't' | 'text'>;
}

function attributeColumn(id: string, attribute: AttributeRecord, input: VariantColumnsInput): Column {
  const { scope, env, words } = input;
  const label = words.text(attribute.labels, attribute.code);
  const reasonText = (row: VariantRow) => {
    const reason = row.definition.noValueReasons[id];
    return reason ? words.t(`values.noValue.${reason}`) : null;
  };
  return {
    id,
    header: input.axisIds.includes(id) ? words.t('variants.axisHeader', { label }) : label,
    label,
    width: attribute.type === 'text' || attribute.type === 'richText' ? 'lg' : 'md',
    align: attribute.type === 'number' || attribute.type === 'measurement' ? 'end' : 'start',
    sticky: input.axisIds[0] === id,
    text: (row) => formatAttributeValue(attribute, readSlot(row.definition.values[id], attribute, scope.channel, scope.locale), env.codec),
    render: (row) => reasonText(row) ?? formatAttributeValue(attribute, readSlot(row.definition.values[id], attribute, scope.channel, scope.locale), env.codec),
    parse: (text, row) => {
      const parsed = parseAttributeText(attribute, text, env.codec);
      if (!parsed.ok) return { ok: false, issue: input.message({ code: parsed.issue, path: '', params: parsed.params }) };
      return { ok: true, row: { ...row, definition: writeHolderValue(row.definition, id, attribute, scope.channel, scope.locale, parsed.value) } };
    },
    lock: (row) => {
      if (!hasTextForm(attribute.type)) return { reason: words.t('variants.useEditor') };
      return input.axisIds.includes(id) && row.stored !== null ? { reason: words.t('values.axisLocked') } : null;
    },
    choices: attribute.type === 'select'
      ? () => attribute.config.options.map((option) => ({ text: option.code, label: words.text(option.labels, option.code) }))
      : undefined,
    toggle: attribute.type === 'boolean'
      ? (row) => {
        const current = readSlot(row.definition.values[id], attribute, scope.channel, scope.locale);
        const next = current?.type === 'boolean' ? !current.value : true;
        return { ...row, definition: writeHolderValue(row.definition, id, attribute, scope.channel, scope.locale, { type: 'boolean', value: next }) };
      }
      : undefined,
  };
}

function completenessColumn(input: VariantColumnsInput): Column {
  const { t } = input.words;
  return {
    id: '__completeness',
    header: t('products.columns.completeness'),
    label: t('products.columns.completeness'),
    width: 'sm',
    align: 'end',
    text: (row) => { const percent = input.percentOf(row); return percent === null ? '' : `${percent}%`; },
    render: (row) => {
      const percent = input.percentOf(row);
      if (percent === null) return null;
      return <Badge variant={percent >= 100 ? 'success' : percent > 0 ? 'warning' : 'destructive'}>{`${percent}%`}</Badge>;
    },
  };
}

export function variantColumns(input: VariantColumnsInput): Column[] {
  const columns = input.columnIds.flatMap((id) => {
    const attribute = input.attributeById.get(id);
    return attribute ? [attributeColumn(id, attribute, input)] : [];
  });
  return [...columns, completenessColumn(input)];
}
