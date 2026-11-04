/**
 * @fileoverview **Σύγκριση δύο εκδόσεων ρήτρας σε δύο κανάλια**: κείμενο λέξη-προς-λέξη **και** παράμετροι με ζώνες
 *   (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/clause-version-diff
 *
 * 🔑 Το κείμενο συγκρίνεται **όπως τυπώνεται**: ίδιος `renderClauseBlocks`, με τις προτιμώμενες τιμές κάθε έκδοσης.
 *    Έτσι «κράτηση {rate}» με 5% → 10% φαίνεται ως αλλαγή λέξης στο κείμενο, και η ίδια αλλαγή ως αλλαγή παραμέτρου.
 * 🔑 Οι παράμετροι κρίνονται με τον **ίδιο** `toleranceVerdict` του γραφέα. Το κρίσιμο ερώτημα για όποιον εγκρίνει:
 *    «η μέχρι σήμερα συνηθισμένη τιμή, με τους νέους κανόνες, είναι ακόμη ελεύθερη;» (`previousPreferredUnderNew`).
 * 🔑 Ισότητα με `canonicalJson` (ταξινομημένα κλειδιά): η σειρά πεδίων στο Firestore δεν γεννά ψευδή αλλαγή.
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import { toleranceVerdict } from '../clauses/tolerance-verdict';
import type { DocumentLocale } from '../document/document-locale';
import type { DocumentBlock, DocumentInline } from '../document/document-types';
import { renderClauseBlocks } from '../document/render-clause-body';
import type { ClauseBody } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue, ToleranceVerdict } from '../types/clause-parameter';
import { diffText, type TextDiffPart } from './text-diff';

/** Ό,τι χρειάζεται η σύγκριση από μια έκδοση (έκδοση βιβλιοθήκης ή μετάφραση με τις παραμέτρους της). */
export interface ComparableClause {
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
}

export const PARAMETER_ASPECTS = ['kind', 'label', 'source', 'preferred', 'tolerance', 'choices'] as const;
export type ParameterAspect = (typeof PARAMETER_ASPECTS)[number];

export type ParameterChange =
  | { readonly change: 'added'; readonly key: string; readonly after: ClauseParameterDefinition }
  | { readonly change: 'removed'; readonly key: string; readonly before: ClauseParameterDefinition }
  | {
      readonly change: 'changed';
      readonly key: string;
      readonly before: ClauseParameterDefinition;
      readonly after: ClauseParameterDefinition;
      readonly aspects: readonly ParameterAspect[];
      /** Η παλιά προτιμώμενη τιμή κρινόμενη με τους **νέους** κανόνες — `null` όταν άλλαξε το είδος. */
      readonly previousPreferredUnderNew: ToleranceVerdict | null;
    };

export interface ClauseVersionDiff {
  readonly text: readonly TextDiffPart[];
  readonly parameters: readonly ParameterChange[];
}

const inlineText = (inlines: readonly DocumentInline[]): string => inlines.map((inline) => inline.text).join('');

function blockText(block: DocumentBlock): string {
  if (block.kind === 'paragraph') return inlineText(block.inlines);
  return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '•'} ${inlineText(item)}`).join('\n');
}

/** Το κείμενο της ρήτρας όπως τυπώνεται, με τις προτιμώμενες τιμές — επικεφαλίδα και μπλοκ σε χωριστές παραγράφους. */
export function clausePrintedText(clause: ComparableClause, locale: DocumentLocale): string {
  const values: Record<string, ClauseParameterValue> = Object.fromEntries(clause.parameters.map((parameter) => [parameter.key, parameter.preferred]));
  const blocks = renderClauseBlocks(clause.body.blocks, { parameters: clause.parameters, values }, locale);
  return [clause.body.heading, ...blocks.map(blockText)].filter((part) => part.length > 0).join('\n\n');
}

const same = (a: unknown, b: unknown): boolean => canonicalJson(a ?? null) === canonicalJson(b ?? null);

const ASPECT_READERS: Readonly<Record<ParameterAspect, (definition: ClauseParameterDefinition) => unknown>> = {
  kind: (definition) => definition.kind,
  label: (definition) => definition.label,
  source: (definition) => definition.source,
  preferred: (definition) => definition.preferred,
  tolerance: (definition) => definition.tolerance,
  choices: (definition) => [definition.terms, definition.options],
};

function changedParameter(before: ClauseParameterDefinition, after: ClauseParameterDefinition): ParameterChange | null {
  const aspects = PARAMETER_ASPECTS.filter((aspect) => !same(ASPECT_READERS[aspect](before), ASPECT_READERS[aspect](after)));
  if (aspects.length === 0) return null;
  const previousPreferredUnderNew = before.preferred.kind === after.kind ? toleranceVerdict(after, before.preferred) : null;
  return { change: 'changed', key: after.key, before, after, aspects, previousPreferredUnderNew };
}

/** Οι αλλαγές παραμέτρων, στη σειρά της νέας έκδοσης και μετά όσες αφαιρέθηκαν. */
export function diffParameters(
  before: readonly ClauseParameterDefinition[],
  after: readonly ClauseParameterDefinition[],
): ParameterChange[] {
  const previous = new Map(before.map((parameter) => [parameter.key, parameter]));
  const nextKeys = new Set(after.map((parameter) => parameter.key));
  const forward = after.flatMap((parameter): ParameterChange[] => {
    const old = previous.get(parameter.key);
    if (!old) return [{ change: 'added', key: parameter.key, after: parameter }];
    const changed = changedParameter(old, parameter);
    return changed ? [changed] : [];
  });
  const removed = before.filter((parameter) => !nextKeys.has(parameter.key)).map((parameter): ParameterChange => ({ change: 'removed', key: parameter.key, before: parameter }));
  return [...forward, ...removed];
}

/** Η πλήρης σύγκριση. `before = null` (πρώτη έκδοση) ⇒ όλα «προστέθηκαν». */
export function diffClauseVersions(before: ComparableClause | null, after: ComparableClause, locale: DocumentLocale): ClauseVersionDiff {
  return {
    text: diffText(before ? clausePrintedText(before, locale) : '', clausePrintedText(after, locale)),
    parameters: diffParameters(before?.parameters ?? [], after.parameters),
  };
}
