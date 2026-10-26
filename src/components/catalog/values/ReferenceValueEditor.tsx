'use client';
/**
 * **Αναφορές σε άλλα προϊόντα/μοντέλα** (ADR-923 §5.10.4 Β3) — αξεσουάρ, ανταλλακτικά, «αντικαθιστά» (Akeneo product links).
 *
 * Προσθήκη **με κωδικό** μέσω του ίδιου άλματος με τη λίστα (ντετερμινιστικές ταυτότητες, σε όλο τον κατάλογο).
 * Οικογένεια-στόχος (`targetFamilyCodes`) και όριο κρίνονται από τον **ίδιο** επικυρωτή με τον διακομιστή.
 *
 * @module components/catalog/values/ReferenceValueEditor
 */

import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { ValueEditorProps } from './value-editor-types';

export function ReferenceValueEditor(props: ValueEditorProps<'reference'>) {
  const { t } = useCatalogText();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState<string | null>(null);
  const targets = props.value?.targets ?? [];
  const max = props.attribute.config.maxReferences;
  const full = max !== null && targets.length >= max;
  const write = (next: typeof targets) => props.onChange(next.length === 0 ? null : { type: 'reference', targets: next });

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const target = await props.env.references.resolve(code);
    if (!target) { setMissing(code.trim()); return; }
    if (!targets.some((existing) => existing.id === target.id)) write([...targets, target]);
    setCode('');
    setMissing(null);
  };

  return (
    <section id={props.id} aria-label={props.label} aria-describedby={props.describedBy} className="grid gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {targets.map((target) => {
          const name = props.env.references.describe(target);
          return (
            <li key={target.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-xs">
              {name}
              <Button type="button" variant="ghost" size="icon" aria-label={t('values.references.remove', { name })} disabled={props.disabled}
                onClick={() => write(targets.filter((other) => other.id !== target.id))}><X className="h-3 w-3" aria-hidden /></Button>
            </li>
          );
        })}
      </ul>
      {props.disabled ? null : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void add(event)}>
          <Input aria-label={t('values.references.code')} placeholder={t('values.references.code')} value={code} disabled={full}
            onChange={(event) => { setCode(event.target.value); setMissing(null); }} className="w-56 font-mono" />
          <Button type="submit" variant="outline" size="sm" disabled={full || code.trim() === ''}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('values.references.add')}</Button>
          <p className="m-0 text-xs text-muted-foreground" role="status">{missing ? t('products.jump.notFound', { code: missing }) : ''}</p>
        </form>
      )}
    </section>
  );
}
