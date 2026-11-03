/**
 * @fileoverview **Σώμα ρήτρας → μπλοκ εγγράφου** (ADR-928 §5.2 · §5.17): κάθε κόμβος `param` γίνεται η
 *   αποδοσμένη τιμή της παραμέτρου στη γλώσσα του εγγράφου.
 * @module subapps/procurement/subcontracts/document/render-clause-body
 *
 * 🔑 Τίποτα δεν αναλύεται: το σώμα είναι ήδη δέντρο (κείμενο | παράμετρος), άρα τίποτα δεν εγχέεται.
 * 🔑 Λείπουσα τιμή ⇒ ορατό «[τιμή που λείπει]» με `missing: true`, ποτέ σιωπηλό κενό μέσα σε νομικό κείμενο.
 */

import type { ClauseBlock, ClauseInline } from '../types/clause';
import type { ClauseParameterDefinition, ClauseParameterValue } from '../types/clause-parameter';
import type { DocumentLocale } from './document-locale';
import type { DocumentBlock, DocumentInline } from './document-types';
import { renderParameterValue } from './render-parameter-value';

export interface ClauseValues {
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly values: Readonly<Record<string, ClauseParameterValue>>;
}

function renderInline(inline: ClauseInline, context: ClauseValues, locale: DocumentLocale): DocumentInline {
  if (inline.kind === 'text') return inline;
  const value = context.values[inline.key];
  if (value === undefined) return { kind: 'value', text: locale.phrase('parameter.missing'), missing: true };
  const definition = context.parameters.find((candidate) => candidate.key === inline.key);
  return { kind: 'value', text: renderParameterValue(value, definition, locale), missing: false };
}

function renderInlines(inlines: readonly ClauseInline[], context: ClauseValues, locale: DocumentLocale): DocumentInline[] {
  return inlines.map((inline) => renderInline(inline, context, locale));
}

export function renderClauseBlocks(blocks: readonly ClauseBlock[], context: ClauseValues, locale: DocumentLocale): DocumentBlock[] {
  return blocks.map((block) =>
    block.kind === 'paragraph'
      ? { kind: 'paragraph', inlines: renderInlines(block.inlines, context, locale) }
      : { kind: 'list', ordered: block.ordered, items: block.items.map((item) => renderInlines(item, context, locale)) },
  );
}
