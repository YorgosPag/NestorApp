'use client';

/**
 * **Επιλογές (`enum`) ή μέλη αναλογίας (`ratio`)** μιας παραμέτρου (ADR-928 §5.22): ετικέτα ανά στοιχείο, προσθήκη,
 * αφαίρεση. Το κλειδί είναι ταυτότητα και δεν φαίνεται (`option_2`, `member_3`…)· ο άνθρωπος γράφει μόνο λέξεις.
 *
 * 🔑 `fixedKeys`: όταν η παράμετρος δένεται σε εμπορικό όρο, τα κλειδιά τα ορίζει ο όρος (π.χ. ΦΠΑ: «εκτός» / «εντός»)·
 *    αλλάζουν μόνο οι ετικέτες.
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { uniqueKey } from '@/subapps/procurement/subcontracts/clauses/parameter-definition-edits';
import type { LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';

export interface KeyedLabel {
  readonly key: string;
  readonly label: LocalizedText;
}

interface KeyedLabelsEditorProps {
  readonly id: string;
  readonly legend: string;
  readonly keyPrefix: 'option' | 'member';
  readonly items: readonly KeyedLabel[];
  readonly onChange: (next: readonly KeyedLabel[]) => void;
  readonly fixedKeys: boolean;
}

export function KeyedLabelsEditor({ id, legend, keyPrefix, items, onChange, fixedKeys }: KeyedLabelsEditorProps) {
  const { t } = useTranslation('procurement');
  const add = () => {
    const key = uniqueKey(`${keyPrefix}_${items.length + 1}`, new Set(items.map((item) => item.key)), 48);
    onChange([...items, { key, label: { el: '' } }]);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <ol className="m-0 list-none space-y-2 p-0">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center gap-2">
            <Input
              id={`${id}-${index}`}
              aria-label={`${legend} ${index + 1}`}
              value={item.label.el ?? ''}
              onChange={(event) => onChange(replaceAt(items, index, { ...item, label: { ...item.label, el: event.target.value } }))}
            />
            {!fixedKeys && (
              <Button type="button" size="icon" variant="ghost" aria-label={t('subcontracts.library.authoring.parameter.removeItem', { position: index + 1 })} onClick={() => onChange(removeAt(items, index))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {!fixedKeys && (
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.parameter.addItem')}</Button>
      )}
    </fieldset>
  );
}
