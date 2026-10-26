'use client';
/**
 * **«Δημιουργία παραλλαγών»** — τιμές ανά άξονα ⇒ καρτεσιανό γινόμενο (ADR-923 §5.10.4 Β4, Akeneo variant generator).
 *
 * Επιλογή: κουμπιά εναλλαγής · ναι/όχι · μέτρηση: λίστα «500 L; 0,75 m³» μέσα από τον **κοινό** κωδικοποιητή. Πριν από
 * οτιδήποτε: «N νέες · M υπάρχουν ήδη» και το όριο των 200 (ίδιος `checkDescendantBudget`). 🏆 Οι νέες γραμμές
 * μπαίνουν **στο ίδιο πλέγμα**, σημειωμένες, για συμπλήρωση (επικόλληση) πριν από την αποθήκευση — όχι δεύτερη οθόνη.
 *
 * @module components/catalog/products/variants/VariantGeneratorDialog
 */

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ToggleButton } from '@/components/ui/toggle-button';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { generateVariants, type AxisChoice } from '@/subapps/catalog/aggregate/variant-generator';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { AttributeValue, ProductValues } from '@/subapps/catalog/types/product';
import { formatAttributeValue, parseAttributeText } from '@/subapps/catalog/values/value-text-codec';

import { IssueSummary } from '../../shared/CatalogIssues';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { ValueEditorEnv } from '../../values/value-editor-types';

export interface VariantGeneratorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly axes: readonly AttributeRecord[];
  readonly existing: readonly ProductValues[];
  readonly descendantCount: number;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly registry: MeasurementRegistry;
  readonly env: ValueEditorEnv;
  readonly onGenerate: (combos: readonly ProductValues[]) => void;
}

/** Οι υποψήφιες τιμές ενός άξονα (επιλογές · ναι/όχι). Μέτρηση ⇒ γράφει ο άνθρωπος. */
function candidatesOf(attribute: AttributeRecord): AttributeValue[] | null {
  if (attribute.type === 'select') return attribute.config.options.map((option) => ({ type: 'select', optionCode: option.code }));
  if (attribute.type === 'boolean') return [{ type: 'boolean', value: true }, { type: 'boolean', value: false }];
  return null;
}

function parseList(attribute: AttributeRecord, text: string, env: ValueEditorEnv): AttributeValue[] {
  return text.split(/\s*;\s*/).filter((part) => part !== '').flatMap((part) => {
    const parsed = parseAttributeText(attribute, part, env.codec);
    return parsed.ok && parsed.value ? [parsed.value] : [];
  });
}

/** Ταυτότητα τιμής για σύγκριση επιλογών (τιμές = απλά JSON δεδομένα). */
const valueKey = (value: AttributeValue) => JSON.stringify(value);

function AxisPicker({ attribute, env, picked, text, onToggle, onText }: {
  readonly attribute: AttributeRecord;
  readonly env: ValueEditorEnv;
  readonly picked: readonly AttributeValue[];
  readonly text: string;
  readonly onToggle: (value: AttributeValue) => void;
  readonly onText: (text: string) => void;
}) {
  const { t, text: label } = useCatalogText();
  const candidates = candidatesOf(attribute);
  const name = label(attribute.labels, attribute.code);
  if (!candidates) {
    return (
      <label className="grid gap-1 text-sm">
        {name}
        <Input value={text} onChange={(event) => onText(event.target.value)} placeholder={t('variants.generator.listHint')} className="font-mono" />
      </label>
    );
  }
  return (
    <fieldset className="grid gap-1 border-0 p-0">
      <legend className="text-sm">{name}</legend>
      <span className="flex flex-wrap gap-1">
        {candidates.map((candidate) => {
          const pressed = picked.some((value) => valueKey(value) === valueKey(candidate));
          return (
            <ToggleButton key={valueKey(candidate)} size="sm" pressed={pressed} onClick={() => onToggle(candidate)}>
              {formatAttributeValue(attribute, candidate, env.codec)}
            </ToggleButton>
          );
        })}
      </span>
    </fieldset>
  );
}

function useGenerator(props: VariantGeneratorDialogProps) {
  const [picked, setPicked] = useState<Readonly<Record<string, AttributeValue[]>>>({});
  const [texts, setTexts] = useState<Readonly<Record<string, string>>>({});
  const axes = useMemo((): AxisChoice[] => props.axes.map((attribute) => ({
    attributeId: attribute.id,
    values: candidatesOf(attribute) ? picked[attribute.id] ?? [] : parseList(attribute, texts[attribute.id] ?? '', props.env),
  })), [props.axes, props.env, picked, texts]);
  const result = useMemo(() => generateVariants({
    axes, existing: props.existing, descendantCount: props.descendantCount, attributes: props.attributeById, registry: props.registry,
  }), [axes, props.existing, props.descendantCount, props.attributeById, props.registry]);
  // Πράξεις πάνω στην ΤΡΕΧΟΥΣΑ κατάσταση (functional updater): διαδοχικά κλικ στο ίδιο batch δεν σβήνουν το ένα το άλλο.
  const toggle = (attributeId: string, value: AttributeValue) => setPicked((prev) => {
    const current = prev[attributeId] ?? [];
    const next = current.some((candidate) => valueKey(candidate) === valueKey(value))
      ? current.filter((candidate) => valueKey(candidate) !== valueKey(value))
      : [...current, value];
    return { ...prev, [attributeId]: next };
  });
  const write = (attributeId: string, text: string) => setTexts((prev) => ({ ...prev, [attributeId]: text }));
  return { picked, texts, toggle, write, result };
}

export function VariantGeneratorDialog(props: VariantGeneratorDialogProps) {
  const { t } = useCatalogText();
  const { picked, texts, toggle, write, result } = useGenerator(props);
  const ready = result.combos.length > 0 && result.budget.length === 0;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('variants.generator.title')}</DialogTitle>
          <DialogDescription>{t('variants.generator.lead')}</DialogDescription>
        </DialogHeader>
        <section className="grid gap-4">
          {props.axes.map((attribute) => (
            <AxisPicker key={attribute.id} attribute={attribute} env={props.env} picked={picked[attribute.id] ?? []} text={texts[attribute.id] ?? ''}
              onToggle={(value) => toggle(attribute.id, value)} onText={(text) => write(attribute.id, text)} />
          ))}
          <p className="m-0 text-sm" role="status">{t('variants.generator.preview', { fresh: result.combos.length, existing: result.existing })}</p>
          <IssueSummary issues={result.budget} title={t('editor.issuesTitle')} />
        </section>
        <DialogFooter>
          <Button type="button" disabled={!ready} onClick={() => { props.onGenerate(result.combos); props.onOpenChange(false); }}>
            {t('variants.generator.add', { count: result.combos.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
