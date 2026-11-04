'use client';

/**
 * Το πεδίο μιας παραμέτρου ρήτρας — ολικός διακλαδισμός στα 10 είδη (ADR-928 §5.2 · Φ3γ). Νέο είδος χωρίς πεδίο =
 * σφάλμα μεταγλώττισης (`never`).
 *
 * 🔑 **Ακέραιες μονάδες στο μοντέλο, ανθρώπινες στην οθόνη**: ποσοστό ↔ μονάδες βάσης και ποσό ↔ λεπτά μόνο μέσω
 *    `PercentField` / `MoneyField` (`numeric-field/scaled-value.ts`, ο ΕΝΑΣ κανόνας μετατροπής).
 * 🔑 **Μία πηγή ετικετών**: οι επιλογές (ημέρα · μέρος · ορόσημο · μονάδα · επιλογή ορισμού) παίρνουν την ετικέτα από το
 *    `renderParameterValue` — η ίδια λέξη που θα τυπωθεί στο έγγραφο, στη γλώσσα της οθόνης.
 * 🔑 Άκυρη είσοδος δεν «διορθώνεται» σιωπηλά: περνά ως έχει και ο κριτής τη λέει (`parameterValueInvalid`).
 */

import { Input } from '@/components/ui/input';
import { MoneyField, NumericField, PercentField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HumanLanguage } from '@/i18n/languages';
import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import { UOM_CODES } from '@/lib/uom/uom-registry';
import { documentLocaleOf, MILESTONE_KEYS } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import {
  CLAUSE_PARTIES,
  type ClauseParameterDefinition,
  type ClauseParameterValue,
} from '@/subapps/procurement/subcontracts/types/clause-parameter';

export interface ClauseParameterInputProps {
  readonly id: string;
  readonly definition: ClauseParameterDefinition;
  readonly value: ClauseParameterValue;
  readonly onChange: (value: ClauseParameterValue) => void;
  readonly language: HumanLanguage;
  readonly describedBy?: string;
  readonly disabled?: boolean;
}

interface Choice {
  readonly value: string;
  readonly label: string;
}

const unique = (keys: readonly string[]): string[] => [...new Set(keys)];

/** Οι τιμές μιας παραμέτρου επιλογής, ως ζεύγη (κλειδί, τιμή μοντέλου). */
function choiceValuesOf(definition: ClauseParameterDefinition, current: ClauseParameterValue): ClauseParameterValue[] {
  switch (definition.kind) {
    case 'weekday': return ISO_WEEKDAYS.map((value) => ({ kind: 'weekday', value }));
    case 'party': return CLAUSE_PARTIES.map((value) => ({ kind: 'party', value }));
    case 'unit': return UOM_CODES.map((value) => ({ kind: 'unit', value }));
    case 'enum': return (definition.options ?? []).map((option) => ({ kind: 'enum', value: option.key }));
    case 'milestone': {
      const known = [definition.preferred, current].flatMap((value) => (value.kind === 'milestone' ? [value.value] : []));
      return unique([...MILESTONE_KEYS, ...known]).map((value) => ({ kind: 'milestone', value }));
    }
    default: return [];
  }
}

const keyOf = (value: ClauseParameterValue): string => String(value.value);

function ChoiceInput({ id, definition, value, onChange, language, describedBy, disabled }: ClauseParameterInputProps) {
  const locale = documentLocaleOf(language);
  const values = choiceValuesOf(definition, value);
  const choices: Choice[] = values.map((candidate) => ({ value: keyOf(candidate), label: renderParameterValue(candidate, definition, locale) }));
  return (
    <Select value={keyOf(value)} onValueChange={(key) => { const next = values.find((candidate) => keyOf(candidate) === key); if (next) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id} aria-describedby={describedBy}><SelectValue /></SelectTrigger>
      <SelectContent>{choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** Ποσοστό · ποσό · ημέρες: ο άνθρωπος γράφει %, €, ημέρες· το μοντέλο κρατά μονάδες βάσης, λεπτά, ακέραιο. */
function NumericInput({ id, value, onChange, describedBy, disabled }: ClauseParameterInputProps) {
  const field = { id, 'aria-describedby': describedBy, disabled };
  if (value.kind === 'percent') return <PercentField {...field} value={value.value} onValueChange={(next) => onChange({ kind: 'percent', value: next })} />;
  if (value.kind === 'money') return <MoneyField {...field} value={value.value} onValueChange={(next) => onChange({ kind: 'money', value: next })} />;
  return <NumericField {...field} value={Number(value.value)} onValueChange={(next) => onChange({ kind: 'days', value: next })} />;
}

function RatioInput({ id, definition, value, onChange, language, disabled }: ClauseParameterInputProps) {
  if (value.kind !== 'ratio') return null;
  const members = definition.terms ?? value.value.map((_, index) => ({ key: String(index), label: { el: String(index + 1) } }));
  return (
    <fieldset id={id} className="flex flex-wrap items-end gap-2" disabled={disabled}>
      {members.map((member, index) => (
        <NumericField
          key={member.key}
          label={localizedIn(member.label, language)}
          value={value.value[index] ?? 0}
          onValueChange={(part) => onChange({ kind: 'ratio', value: value.value.map((old, at) => (at === index ? part : old)) })}
          className="w-20"
        />
      ))}
    </fieldset>
  );
}

export function ClauseParameterInput(props: ClauseParameterInputProps) {
  const { value } = props;
  switch (value.kind) {
    case 'percent':
    case 'money':
    case 'days':
      return <NumericInput {...props} />;
    case 'ratio':
      return <RatioInput {...props} />;
    case 'text':
      return <Input id={props.id} value={value.value} onChange={(event) => props.onChange({ kind: 'text', value: event.target.value })} aria-describedby={props.describedBy} disabled={props.disabled} />;
    case 'weekday':
    case 'milestone':
    case 'unit':
    case 'enum':
    case 'party':
      return <ChoiceInput {...props} />;
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}
