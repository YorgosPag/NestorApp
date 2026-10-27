'use client';
/**
 * **Κειμενικοί επεξεργαστές** — κείμενο · richText · αριθμός · μέτρηση · ημερομηνία (ADR-923 §5.10.4 Β3).
 *
 * Όλοι περνούν από τον **ίδιο** κωδικοποιητή με το πλέγμα (`value-text-codec`): «2,5 kW» σημαίνει το ίδιο εδώ και
 * στο κελί. Το κείμενο ζει τοπικά όσο γράφεις· δέσμευση στο blur / `Enter`. Αποτυχία γραμματικής ⇒ το κείμενο
 * **μένει**, με μήνυμα δίπλα — ποτέ σιωπηλή επαναφορά (Excel: «η τιμή δεν είναι έγκυρη»).
 *
 * @module components/catalog/values/TextValueEditor
 */

import { useEffect, useState, type KeyboardEvent } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { formatAttributeValue, isBareAmountText, parseAttributeText } from '@/subapps/catalog/values/value-text-codec';
import type { AttributeType } from '@/subapps/catalog/vocabulary/attribute-types';
import { cn } from '@/lib/utils';

import { useIssueMessage } from '../shared/CatalogIssues';
import type { ValueEditorProps } from './value-editor-types';

export type TextLikeType = Extract<AttributeType, 'text' | 'richText' | 'number' | 'measurement' | 'date'>;

/**
 * Η μονάδα που **υποθέτει** ένας γυμνός αριθμός — μόνο όταν το κείμενο **είναι** γυμνός αριθμός ή κενό. Ζωντανά
 * (ADR-923 §5.10.5) το «4500 W» στεκόταν δίπλα σε «kW»: η ένδειξη αντέλεγε την τιμή.
 */
function unitHintOf(props: ValueEditorProps<TextLikeType>, text: string): string | null {
  const { attribute, env } = props;
  if (attribute.type !== 'measurement' || (text.trim() !== '' && !isBareAmountText(text))) return null;
  const family = env.codec.registry.get(attribute.config.measurementFamilyCode);
  return family?.units.find((unit) => unit.code === attribute.config.defaultUnitCode)?.symbol ?? null;
}

function useCommittedText(props: ValueEditorProps<TextLikeType>) {
  const external = formatAttributeValue(props.attribute, props.value, props.env.codec);
  const [text, setText] = useState(external);
  const [issue, setIssue] = useState<CatalogIssue | null>(null);
  const [editing, setEditing] = useState(false);
  // Η τιμή άλλαξε απ' έξω (αναίρεση, άλλος χρήστης) ⇒ ακολουθεί — **όχι** όσο γράφεις.
  useEffect(() => { if (!editing) { setText(external); setIssue(null); } }, [external, editing]);
  const commit = () => {
    if (text === external) { setEditing(false); setIssue(null); return; }
    const parsed = parseAttributeText(props.attribute, text, props.env.codec);
    // Απορριπτέο ⇒ η επεξεργασία **μένει σε εκκρεμότητα**: το κείμενο δεν αντικαθίσταται από την παλιά τιμή.
    if (!parsed.ok) { setIssue({ code: parsed.issue, path: '', params: parsed.params }); return; }
    setEditing(false);
    setIssue(null);
    props.onChange(parsed.value);
  };
  return { text, issue, setText: (next: string) => { setEditing(true); setText(next); }, commit };
}

export function TextValueEditor(props: ValueEditorProps<TextLikeType>) {
  const message = useIssueMessage();
  const { text, issue, setText, commit } = useCommittedText(props);
  const unit = unitHintOf(props, text);
  const issueId = `${props.id}-parse`;
  const describedBy = [props.describedBy, issue ? issueId : null].filter(Boolean).join(' ') || undefined;
  const shared = {
    id: props.id,
    value: text,
    disabled: props.disabled,
    'aria-invalid': props.invalid || issue !== null || undefined,
    'aria-describedby': describedBy,
    onBlur: commit,
  } as const;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') commit(); };
  return (
    <span className="grid gap-1">
      <span className="flex items-center gap-2">
        {props.attribute.type === 'richText'
          ? <Textarea {...shared} rows={4} onChange={(event) => setText(event.target.value)} />
          : <Input {...shared} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown}
              inputMode={props.attribute.type === 'number' || props.attribute.type === 'measurement' ? 'decimal' : undefined}
              className={cn(props.attribute.type !== 'text' && 'font-mono')} />}
        {unit ? <span className="text-sm text-muted-foreground" aria-hidden>{unit}</span> : null}
      </span>
      {issue ? <p id={issueId} className="m-0 text-xs text-destructive">{message(issue)}</p> : null}
    </span>
  );
}
