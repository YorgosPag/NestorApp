/**
 * @fileoverview **Η τιμή μιας παραμέτρου ρήτρας ως κείμενο** στη γλώσσα του εγγράφου (ADR-928 §5.2 · §5.17).
 * @module subapps/procurement/subcontracts/document/render-parameter-value
 *
 * 🔑 Ολικός `switch` στα 10 είδη: νέο είδος χωρίς απόδοση = σφάλμα μεταγλώττισης. Επιλογές `enum` και μέλη `ratio`
 *    παίρνουν την ετικέτα του **ορισμού** στη γλώσσα του εγγράφου (με εφεδρεία το ελληνικό, που υπάρχει πάντα).
 */

import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue, LocalizedText } from '../types/clause-parameter';
import type { DocumentLocale } from './document-locale';

/** Το κείμενο στη γλώσσα του εγγράφου, αλλιώς το ελληνικό (η αυθεντία είναι πάντα παρούσα). */
export function localizedIn(text: LocalizedText, language: string): string {
  return text[language] ?? text[CLAUSE_AUTHORITATIVE_LANGUAGE] ?? '';
}

function enumLabel(definition: ClauseParameterDefinition | undefined, key: string, language: string): string {
  const option = definition?.options?.find((candidate) => candidate.key === key);
  return option ? localizedIn(option.label, language) : key;
}

function ratioText(definition: ClauseParameterDefinition | undefined, parts: readonly number[], locale: DocumentLocale): string {
  const ratio = parts.map((part) => locale.number(part)).join(':');
  const members = definition?.terms?.map((member) => localizedIn(member.label, locale.language));
  return members && members.length === parts.length ? `${members.join(':')} = ${ratio}` : ratio;
}

/** Ετικέτα ορόσημου έργου· χωρίς ετικέτα ⇒ φαίνεται το κλειδί (ορατή απουσία). */
export function milestoneLabel(key: string, locale: DocumentLocale): string {
  const phrased = locale.phrase(`milestones.${key}`);
  return phrased === `milestones.${key}` ? key : phrased;
}

export function renderParameterValue(
  value: ClauseParameterValue,
  definition: ClauseParameterDefinition | undefined,
  locale: DocumentLocale,
): string {
  switch (value.kind) {
    case 'percent': return locale.percent(value.value);
    case 'money': return locale.money(value.value);
    case 'days': return locale.phrase('parameter.days', { count: value.value });
    case 'ratio': return ratioText(definition, value.value, locale);
    case 'weekday': return locale.phrase(`parameter.weekday.${value.value}`);
    case 'milestone': return milestoneLabel(value.value, locale);
    case 'unit': return locale.unit(value.value);
    case 'enum': return enumLabel(definition, value.value, locale.language);
    case 'party': return locale.phrase(`parameter.party.${value.value}`);
    case 'text': return value.value;
  }
}
