/**
 * @fileoverview **Καθαρές πράξεις πάνω στους ορισμούς παραμέτρων** του επεξεργαστή ρήτρας (ADR-928 §5.22 · Φ3γ-0b-1).
 * @module subapps/procurement/subcontracts/clauses/parameter-definition-edits
 *
 * 🔑 Ο κριτής είναι **ένας** (`validateParameterDefinitions`)· εδώ μόνο πράξεις που παράγουν σχήμα που **μπορεί** να
 *    περάσει, και αφήνουν στον άνθρωπο μόνο όσα πρέπει να αποφασίσει (ετικέτα, επιλογές, μέλη αναλογίας).
 * 🔑 **Αλλαγή είδους = νέο σχήμα** (όπως `term-edits`): νέα προτιμώμενη του είδους, ζώνη `null`, πηγή «ρήτρα», και
 *    χάνονται επιλογές/μέλη που δεν ανήκουν στο νέο είδος. Ποτέ τιμή άλλου είδους που ο κριτής θα έλεγε άκυρη.
 * 🔑 **Δέσιμο σε όρο μόνο ίδιου είδους** (`bindingsForKind`), από τον **ίδιο** πίνακα `COMMERCIAL_TERM_BINDINGS` που
 *    κρίνει ο κριτής. Για `enum`, οι επιλογές γίνονται ακριβώς τα κλειδιά που απαιτεί ο όρος (οι ετικέτες κρατιούνται).
 * 🔑 **Το κλειδί είναι ταυτότητα, όχι ετικέτα.** Γεννιέται μία φορά από την ετικέτα (λατινικά, `CLAUSE_PARAMETER_KEY`)·
 *    η ετικέτα αλλάζει ελεύθερα. Μετονομασία κλειδιού ξαναγράφει **κάθε** αναφορά του σώματος — και επιτρέπεται μόνο
 *    σε παράμετρο που δεν υπάρχει στη βάση (`lockedParameterKeys` στο `clause-draft.ts`): οι τιμές των συμφωνητικών και
 *    οι μεταφράσεις που κληρονομεί η νέα έκδοση δείχνουν με αυτό το κλειδί.
 */

import { transliterateGreekToLatin } from '@/utils/greek-text';
import {
  COMMERCIAL_TERM_BINDING_KEYS,
  type ClauseParameterDefinition,
  type ClauseParameterKind,
  type ClauseParameterValue,
  type CommercialTermBindingKey,
  type LocalizedText,
} from '../types/clause-parameter';
import type { ClauseBlock, ClauseBody, ClauseInline } from '../types/clause';
import { COMMERCIAL_TERM_BINDINGS } from './commercial-term-bindings';
import { CLAUSE_PARAMETER_KEY } from './validate-parameter-definition';
import { referencedParameterKeys } from './validate-clause-body';

const PARAMETER_KEY_MAX = 48;

/** Λατινικό κλειδί από ανθρώπινο κείμενο: «Ποσοστό κράτησης» ⇒ `pososto_kratisis`. Κενό ⇒ `fallback`. */
export function latinKeyOf(text: string, fallback: string, maxLength: number): string {
  const slug = transliterateGreekToLatin(text)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength)
    .replace(/_+$/g, '');
  if (slug.length === 0) return fallback;
  return /^[a-z]/.test(slug) ? slug : `${fallback}_${slug}`.slice(0, maxLength);
}

/** Το πρώτο ελεύθερο από `base`, `base_2`, `base_3`… — ποτέ σύγκρουση με όσα υπάρχουν. */
export function uniqueKey(base: string, taken: ReadonlySet<string>, maxLength: number): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function parameterKeyFromLabel(label: string, taken: ReadonlySet<string>): string {
  return uniqueKey(latinKeyOf(label, 'param', PARAMETER_KEY_MAX), taken, PARAMETER_KEY_MAX);
}

const EMPTY_LABEL: LocalizedText = { el: '' };

/** Η προεπιλεγμένη τιμή κάθε είδους — η πιο ουδέτερη που ο άνθρωπος θα αλλάξει (ολικός `switch`). */
export function defaultValueOf(kind: ClauseParameterKind): ClauseParameterValue {
  switch (kind) {
    case 'percent': return { kind, value: 0 };
    case 'money': return { kind, value: 0 };
    case 'days': return { kind, value: 0 };
    case 'ratio': return { kind, value: [1, 1] };
    case 'weekday': return { kind, value: 5 };
    case 'milestone': return { kind, value: 'structure.frame_complete' };
    case 'unit': return { kind, value: 'm2' };
    case 'enum': return { kind, value: '' };
    case 'party': return { kind, value: 'subcontractor' };
    case 'text': return { kind, value: '' };
  }
}

/** Τα πεδία που ανήκουν μόνο σε ορισμένα είδη: μέλη αναλογίας (`ratio`) και επιλογές (`enum`). */
function kindExtras(kind: ClauseParameterKind): Pick<ClauseParameterDefinition, 'terms' | 'options'> {
  if (kind === 'ratio') return { terms: [{ key: 'a', label: EMPTY_LABEL }, { key: 'b', label: EMPTY_LABEL }] };
  if (kind === 'enum') return { options: [] };
  return {};
}

export interface NewParameterInput {
  readonly label: string;
  readonly kind: ClauseParameterKind;
  /** Τιμή που ήρθε από το κείμενο («Κάνε το παράμετρο»)· αλλιώς η προεπιλογή του είδους. */
  readonly preferred?: ClauseParameterValue;
}

export function newParameterDefinition(input: NewParameterInput, taken: ReadonlySet<string>): ClauseParameterDefinition {
  const preferred = input.preferred?.kind === input.kind ? input.preferred : defaultValueOf(input.kind);
  return {
    key: parameterKeyFromLabel(input.label, taken),
    kind: input.kind,
    label: { el: input.label },
    source: { kind: 'clause' },
    preferred,
    tolerance: null,
    ...kindExtras(input.kind),
  };
}

/** Αλλαγή είδους = νέο σχήμα (κρατά κλειδί και ετικέτα). Ίδιο είδος ⇒ ο ίδιος ορισμός. */
export function withKind(definition: ClauseParameterDefinition, kind: ClauseParameterKind): ClauseParameterDefinition {
  if (definition.kind === kind) return definition;
  return { key: definition.key, label: definition.label, kind, source: { kind: 'clause' }, preferred: defaultValueOf(kind), tolerance: null, ...kindExtras(kind) };
}

/** Οι όροι που μπορεί να δέσει παράμετρος αυτού του είδους — ο ίδιος πίνακας με τον κριτή. */
export function bindingsForKind(kind: ClauseParameterKind): readonly CommercialTermBindingKey[] {
  return COMMERCIAL_TERM_BINDING_KEYS.filter((term) => COMMERCIAL_TERM_BINDINGS[term].kind === kind);
}

/** Πηγή τιμής: ρήτρα, ή όρος **ίδιου είδους** (αλλιώς ο ορισμός μένει ως έχει). */
export function withSource(definition: ClauseParameterDefinition, term: CommercialTermBindingKey | null): ClauseParameterDefinition {
  if (term === null) return { ...definition, source: { kind: 'clause' } };
  const spec = COMMERCIAL_TERM_BINDINGS[term];
  if (spec.kind !== definition.kind) return definition;
  const bound: ClauseParameterDefinition = { ...definition, source: { kind: 'term', term } };
  if (!spec.optionKeys) return bound;
  const labelOf = (key: string) => definition.options?.find((option) => option.key === key)?.label ?? EMPTY_LABEL;
  const options = spec.optionKeys.map((key) => ({ key, label: labelOf(key) }));
  const preferred = bound.preferred.kind === 'enum' && spec.optionKeys.includes(bound.preferred.value)
    ? bound.preferred
    : { kind: 'enum' as const, value: spec.optionKeys[0] };
  return { ...bound, options, preferred, tolerance: null };
}

// ── Σώμα ↔ παράμετροι ─────────────────────────────────────────────────────────

function renamedRun(run: readonly ClauseInline[], from: string, to: string): ClauseInline[] {
  return run.map((inline) => (inline.kind === 'param' && inline.key === from ? { kind: 'param', key: to } : inline));
}

function renamedBlock(block: ClauseBlock, from: string, to: string): ClauseBlock {
  return block.kind === 'paragraph'
    ? { kind: 'paragraph', inlines: renamedRun(block.inlines, from, to) }
    : { ...block, items: block.items.map((item) => renamedRun(item, from, to)) };
}

/** Νέο κλειδί σε ορισμό **και** σε κάθε αναφορά του σώματος. Άκυρο ή πιασμένο κλειδί ⇒ τίποτα δεν αλλάζει. */
export function renameParameter(
  body: ClauseBody,
  parameters: readonly ClauseParameterDefinition[],
  from: string,
  to: string,
): { readonly body: ClauseBody; readonly parameters: readonly ClauseParameterDefinition[] } {
  const taken = parameters.some((parameter) => parameter.key === to);
  if (from === to || taken || !CLAUSE_PARAMETER_KEY.test(to)) return { body, parameters };
  return {
    body: { ...body, blocks: body.blocks.map((block) => renamedBlock(block, from, to)) },
    parameters: parameters.map((parameter) => (parameter.key === from ? { ...parameter, key: to } : parameter)),
  };
}

/** Οι ορισμοί που δεν τυπώνονται πουθενά στο σώμα — ο κριτής τους λέει `parameterUnreferenced`. */
export function unreferencedParameters(body: ClauseBody, parameters: readonly ClauseParameterDefinition[]): readonly string[] {
  const referenced = referencedParameterKeys(body);
  return parameters.filter((parameter) => !referenced.has(parameter.key)).map((parameter) => parameter.key);
}

/** «Αφαίρεση αχρησιμοποίητων»: μόνο όσοι δεν τυπώνονται — ποτέ ορισμός που το σώμα χρειάζεται. */
export function withoutUnreferenced(body: ClauseBody, parameters: readonly ClauseParameterDefinition[]): readonly ClauseParameterDefinition[] {
  const referenced = referencedParameterKeys(body);
  return parameters.filter((parameter) => referenced.has(parameter.key));
}

/** Αφαίρεση **μίας** παραμέτρου — μόνο αν δεν τυπώνεται (αλλιώς το σώμα θα έδειχνε σε ανύπαρκτη). */
export function removeParameterFrom(body: ClauseBody, parameters: readonly ClauseParameterDefinition[], key: string): readonly ClauseParameterDefinition[] {
  return referencedParameterKeys(body).has(key) ? parameters : parameters.filter((parameter) => parameter.key !== key);
}
