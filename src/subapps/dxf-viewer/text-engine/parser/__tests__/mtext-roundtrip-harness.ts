/**
 * ADR-737 — ΚΟΙΝΟ ΕΡΓΑΛΕΙΟ ROUND-TRIP ΓΙΑ ΤΑ TESTS ΤΟΥ MTEXT.
 *
 * Δεν είναι suite (δεν ταιριάζει στο `testMatch`, που απαιτεί `.test.`). Υπάρχει επειδή κάθε
 * test της οικογένειας §11 ρωτά το ΙΔΙΟ πράγμα — «parse → serialize → parse» — και οι τέσσερις
 * βοηθοί ήταν έτοιμοι να αντιγραφούν σε δεύτερο αρχείο (N.18 / CHECK 3.28: sibling clone).
 *
 * ⚠️ Ο αγωγός εδώ είναι ο ΠΡΑΓΜΑΤΙΚΟΣ (tokenizer → parser → serializer). Αν κάποιο test
 * χρειαστεί «βολικό» AST φτιαγμένο στο χέρι, τότε δεν ελέγχει round-trip — ελέγχει τη δική του
 * φαντασία. Το ADR-737 γεννήθηκε ακριβώς από ένα τέτοιο test.
 */

import { tokenizeMtext } from '../mtext-tokenizer';
import { parseMtext } from '../mtext-parser';
import { serializeDxfTextNode } from '../../serializer/mtext-serializer';
import { DxfDocumentVersion } from '../../types/text-toolbar.types';
import type { DxfTextNode, TextRun, TextStack } from '../../types/text-ast.types';

/** Το ύψος μπλοκ (κωδ. 40) της ετικέτας του `47_ergasia.dxf` — βάση κάθε σχετικού `\H…x;`. */
export const BLOCK_HEIGHT = 0.6;

/** Η ΠΡΑΓΜΑΤΙΚΗ ετικέτα εμβαδού του `47_ergasia.dxf`. */
export const AREA_LABEL = '\\A1;{\\C7;Ε\\H0.7x;\\S^ τίτλου;\\H1.4286x;=231.04τ.μ.}';

export function parse(raw: string): DxfTextNode {
  return parseMtext(tokenizeMtext(raw), { height: BLOCK_HEIGHT });
}

export function serialize(node: DxfTextNode): string {
  return serializeDxfTextNode(node, { version: DxfDocumentVersion.R2018 }).content;
}

/** Ένα πλήρες πέρασμα: το string που θα γραφόταν στο DXF για αυτό το raw. */
export function roundTrip(raw: string): string {
  return serialize(parse(raw));
}

export function isStack(child: TextRun | TextStack): child is TextStack {
  return 'top' in child;
}

export function stackOf(node: DxfTextNode): TextStack {
  const found = node.paragraphs[0].runs.find(isStack);
  if (!found) throw new Error('το δείγμα πρέπει να περιέχει στοίβα \\S — αλλιώς δεν ελέγχει τίποτα');
  return found;
}

/** Η στοίχιση κάθε παιδιού του AST, runs ΚΑΙ στοίβες, με τη σειρά ζωγραφικής. */
export function alignsOf(node: DxfTextNode): Array<0 | 1 | 2 | undefined> {
  return node.paragraphs[0].runs.map((c) => c.style.verticalAlign);
}

/** Το ΠΛΗΡΕΣ στυλ κάθε στοίβας — το μόνο όργανο που βλέπει διαρροή ύψους/χρώματος/γραμματοσειράς. */
export function stackStylesOf(node: DxfTextNode): Array<TextStack['style']> {
  return node.paragraphs[0].runs.filter(isStack).map((s) => s.style);
}
