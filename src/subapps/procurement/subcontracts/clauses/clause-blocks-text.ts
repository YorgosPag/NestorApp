/**
 * @fileoverview **Μπλοκ κειμένου ↔ απλό κείμενο**, χωρίς απώλειες, για κείμενα χωρίς παραμέτρους (κανόνας επιμέτρησης,
 *   ADR-928 §5.4 · Φ3γ-2).
 * @module subapps/procurement/subcontracts/clauses/clause-blocks-text
 *
 * Σύμβαση (το υποσύνολο Markdown που ξέρει κάθε άνθρωπος):
 *   - παράγραφοι χωρίζονται με **κενή γραμμή**·
 *   - γραμμές που αρχίζουν με `- ` ⇒ λίστα με κουκκίδες· με `1. ` (οποιοσδήποτε αριθμός) ⇒ αριθμημένη λίστα.
 *
 * 🔑 Στρογγυλή διαδρομή: `blocksOfText(textOfBlocks(b))` = `b` για κάθε μπλοκ χωρίς παραμέτρους. Μπλοκ με παράμετρο
 *    **δεν** γίνεται κείμενο (`null`): η θέση μιας παραμέτρου δεν γράφεται με το χέρι. Αυτό ανήκει στον επεξεργαστή ρήτρας
 *    (Φ3γ-0b).
 */

import type { ClauseBlock, ClauseInline } from '../types/clause';

const BULLET = /^- (.*)$/;
const NUMBERED = /^\d+\. (.*)$/;

function plainOf(inlines: readonly ClauseInline[]): string | null {
  let text = '';
  for (const inline of inlines) {
    if (inline.kind !== 'text') return null;
    text += inline.text;
  }
  return text;
}

function textOfBlock(block: ClauseBlock): string | null {
  if (block.kind === 'paragraph') return plainOf(block.inlines);
  const items = block.items.map(plainOf);
  if (items.some((item) => item === null)) return null;
  return items.map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`)).join('\n');
}

/** Το κείμενο των μπλοκ, ή `null` όταν κάποιο έχει παράμετρο (δεν επεξεργάζεται ως απλό κείμενο). */
export function textOfBlocks(blocks: readonly ClauseBlock[]): string | null {
  const parts = blocks.map(textOfBlock);
  return parts.some((part) => part === null) ? null : parts.join('\n\n');
}

const textInlines = (text: string): ClauseInline[] => [{ kind: 'text', text }];

function blockOfChunk(chunk: string): ClauseBlock {
  const lines = chunk.split('\n');
  for (const [pattern, ordered] of [[BULLET, false], [NUMBERED, true]] as const) {
    const items = lines.map((line) => pattern.exec(line)?.[1]);
    if (items.every((item): item is string => item !== undefined)) return { kind: 'list', ordered, items: items.map(textInlines) };
  }
  return { kind: 'paragraph', inlines: textInlines(chunk) };
}

/** Τα μπλοκ ενός απλού κειμένου. Κενό κείμενο ⇒ κανένα μπλοκ. */
export function blocksOfText(text: string): ClauseBlock[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map(blockOfChunk);
}
