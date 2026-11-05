/**
 * @fileoverview **Σώμα ρήτρας ↔ έγγραφο του επεξεργαστή** (ADR-928 §5.22 · Φ3γ-0b-1) — καθαρό, χωρίς TipTap.
 * @module subapps/procurement/subcontracts/clauses/clause-body-doc
 *
 * 🔑 Το μοντέλο μένει **ένα**: `ClauseBlock[]` (παράγραφος · λίστα, τμήματα «κείμενο» | «παράμετρος»). Το έγγραφο
 *    ProseMirror είναι μόνο η **όψη** που γράφει ο άνθρωπος. Η παράμετρος είναι κόμβος-άτομο `clauseParam{key}`: δεν
 *    σπάει με πληκτρολόγηση, δεν μισοσβήνεται, δεν «κολλάει» ως κείμενο — όπως το chip του Figma/Notion.
 * 🔑 **Χωρίς marks**: η ρήτρα δεν έχει έντονα/πλάγια (το έγγραφο ADR-861 τα αποδίδει ενιαία). Ό,τι φτάσει με marks
 *    (επικόλληση) κρατά **μόνο το κείμενο**.
 * 🔑 **Στρογγυλή διαδρομή**: `docToClauseBlocks(clauseBlocksToDoc(b))` ≡ `b` για κάθε έγκυρο σώμα (άγκυρα: οι 29
 *    σπαρμένες ρήτρες).
 * 🔑 **Κανονικοποίηση προς τα μπλοκ**, ώστε ο κριτής να βλέπει ό,τι θα τυπωθεί: διαδοχικά κείμενα ενώνονται · κενή
 *    παράγραφος ή κενό στοιχείο λίστας = καμία (όπως στο χαρτί) · εμφωλευμένη λίστα ισοπεδώνεται στα στοιχεία της
 *    (το μοντέλο δεν έχει βάθος — κανένα κείμενο δεν χάνεται).
 */

import type { ClauseBlock, ClauseInline } from '../types/clause';

/** Το όνομα του κόμβου-παραμέτρου στο σχήμα του επεξεργαστή. */
export const CLAUSE_PARAM_NODE = 'clauseParam';

/** Δομικά συμβατό με το `JSONContent` του TipTap — το καθαρό στρώμα δεν εξαρτάται από τη βιβλιοθήκη. */
export interface ProseNode {
  readonly type?: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly ProseNode[];
  readonly text?: string;
}

// ── Μπλοκ → έγγραφο ──────────────────────────────────────────────────────────

function inlineNodes(inlines: readonly ClauseInline[]): ProseNode[] {
  return inlines
    .filter((inline) => inline.kind === 'param' || inline.text.length > 0)
    .map((inline) => (inline.kind === 'text'
      ? { type: 'text', text: inline.text }
      : { type: CLAUSE_PARAM_NODE, attrs: { key: inline.key } }));
}

function paragraphNode(inlines: readonly ClauseInline[]): ProseNode {
  const content = inlineNodes(inlines);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function blockNode(block: ClauseBlock): ProseNode {
  if (block.kind === 'paragraph') return paragraphNode(block.inlines);
  return {
    type: block.ordered ? 'orderedList' : 'bulletList',
    content: block.items.map((item) => ({ type: 'listItem', content: [paragraphNode(item)] })),
  };
}

export function clauseBlocksToDoc(blocks: readonly ClauseBlock[]): ProseNode {
  const content = blocks.map(blockNode);
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

// ── Έγγραφο → μπλοκ ──────────────────────────────────────────────────────────

function paramKeyOf(node: ProseNode): string | null {
  const key = node.attrs?.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** Τα τμήματα ενός κόμβου με inline περιεχόμενο: κείμενα ενωμένα, παράμετροι ως έχουν, ό,τι άλλο αγνοείται. */
export function inlinesOfNode(node: ProseNode): ClauseInline[] {
  const result: ClauseInline[] = [];
  for (const child of node.content ?? []) {
    if (child.type === 'text' && child.text) {
      const last = result[result.length - 1];
      if (last?.kind === 'text') result[result.length - 1] = { kind: 'text', text: last.text + child.text };
      else result.push({ kind: 'text', text: child.text });
    } else if (child.type === CLAUSE_PARAM_NODE) {
      const key = paramKeyOf(child);
      if (key !== null) result.push({ kind: 'param', key });
    }
  }
  return result;
}

const isBlank = (inlines: readonly ClauseInline[]): boolean =>
  inlines.every((inline) => inline.kind === 'text' && inline.text.trim().length === 0);

/** Δεύτερη παράγραφος μέσα στο ίδιο στοιχείο: συνεχίζει το στοιχείο, με ένα κενό ανάμεσα (καμία λέξη δεν κολλά). */
function appendRun(run: ClauseInline[], next: readonly ClauseInline[]): void {
  if (isBlank(next)) return;
  const tail = run[run.length - 1];
  if (tail !== undefined) {
    if (tail.kind === 'text') run[run.length - 1] = { kind: 'text', text: `${tail.text} ` };
    else run.push({ kind: 'text', text: ' ' });
  }
  for (const inline of next) {
    const last = run[run.length - 1];
    if (inline.kind === 'text' && last?.kind === 'text') run[run.length - 1] = { kind: 'text', text: last.text + inline.text };
    else run.push(inline);
  }
}

/** Τα στοιχεία μιας λίστας: κάθε παράγραφος ενός στοιχείου, και κάθε στοιχείο εμφωλευμένης λίστας, ισοπεδωμένα. */
function listItemsOf(list: ProseNode): ClauseInline[][] {
  const items: ClauseInline[][] = [];
  for (const item of list.content ?? []) {
    const own: ClauseInline[] = [];
    const nested: ClauseInline[][] = [];
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph') appendRun(own, inlinesOfNode(child));
      else if (child.type === 'bulletList' || child.type === 'orderedList') nested.push(...listItemsOf(child));
    }
    if (!isBlank(own)) items.push(own);
    items.push(...nested);
  }
  return items;
}

function blockOfNode(node: ProseNode): ClauseBlock | null {
  if (node.type === 'paragraph') {
    const inlines = inlinesOfNode(node);
    return isBlank(inlines) ? null : { kind: 'paragraph', inlines };
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = listItemsOf(node);
    return items.length === 0 ? null : { kind: 'list', ordered: node.type === 'orderedList', items };
  }
  return null;
}

export function docToClauseBlocks(doc: ProseNode): ClauseBlock[] {
  return (doc.content ?? []).map(blockOfNode).filter((block): block is ClauseBlock => block !== null);
}
