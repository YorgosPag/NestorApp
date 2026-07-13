/**
 * ADR-651 Φάση Β — resolved title-block template (AST) → `label : value` γραμμές.
 *
 * Ο resolver (ADR-344) γυρίζει ένα `DxfTextNode` όπου κάθε παράγραφος είναι μία γραμμή
 * της πινακίδας, ήδη με τα placeholders λυμένα (π.χ. `«Έργο: Οικία Παπαδοπούλου»`). Εδώ
 * γίνεται ΜΟΝΟ η ανάγνωση αυτής της δομής σε πεδία — καμία γνώση γεωμετρίας.
 *
 * Σύμβαση περιεχομένου (ίδια στα built-in EL/EN πρότυπα): `«Ετικέτα: τιμή»`. Η ΠΡΩΤΗ
 * παράγραφος χωρίς `:` είναι ο **τίτλος** (επωνυμία γραφείου) — μπαίνει στη ζώνη τίτλου,
 * όχι σε γραμμή πεδίου. Παράγραφος χωρίς `:` παρακάτω = πεδίο χωρίς τιμή (label-only),
 * που το `buildFieldBlock` ήδη χειρίζεται.
 *
 * @see ../templates/resolver/resolver.ts — resolveTemplate (SSoT υποκατάστασης)
 * @see ../../bim/structural/detail-sheet/detail-sheet-field-block.ts — FieldRow (SSoT διάταξης)
 */

import type { FieldRow } from '../../bim/structural/detail-sheet/detail-sheet-field-block';
import { resolveTemplate } from '../templates/resolver/resolver';
import type { PlaceholderScope } from '../templates/resolver/scope.types';
import type { TextTemplate } from '../templates/template.types';
import type { DxfTextNode, TextParagraph } from '../types/text-ast.types';

/** Ό,τι χρειάζεται η διάταξη: ζώνη τίτλου + οι γραμμές πεδίων. */
export interface TitleBlockContent {
  /** Επωνυμία/τίτλος στη ζώνη κεφαλίδας· `''` όταν το πρότυπο δεν έχει τέτοια γραμμή. */
  readonly heading: string;
  readonly rows: readonly FieldRow[];
}

/** Το ορατό κείμενο μιας παραγράφου (τα `TextStack` runs δεν φέρουν απλό κείμενο). */
function paragraphText(paragraph: TextParagraph): string {
  return paragraph.runs
    .map((run) => ('text' in run ? run.text : ''))
    .join('')
    .trim();
}

/** `«Ετικέτα: τιμή»` → `{ label, value }`· χωρίς `:` → label-only γραμμή. */
function toFieldRow(text: string): FieldRow {
  const separator = text.indexOf(':');
  if (separator < 0) return { label: text, value: '' };
  return {
    label: text.slice(0, separator + 1).trim(),
    value: text.slice(separator + 1).trim(),
  };
}

/**
 * Διαβάζει ένα ΛΥΜΕΝΟ title-block node σε {@link TitleBlockContent}. Οι κενές παράγραφοι
 * αγνοούνται (το πρότυπο μπορεί να έχει κενές γραμμές για αέρα· η πινακίδα δεν θέλει κενή
 * σειρά πεδίου).
 */
export function readTitleBlockContent(node: DxfTextNode): TitleBlockContent {
  const lines = node.paragraphs.map(paragraphText).filter((text) => text.length > 0);
  const hasHeading = lines.length > 0 && !lines[0].includes(':');
  return {
    heading: hasHeading ? lines[0] : '',
    rows: (hasHeading ? lines.slice(1) : lines).map(toFieldRow),
  };
}

/**
 * Πρότυπο + scope → ΛΥΜΕΝΟ περιεχόμενο πινακίδας. Το ένα βήμα που χρειάζονται **και τα δύο**
 * μονοπάτια — in-scene block (Φάση Β) και PDF (Φάση ΣΤ) — ώστε να μη ζει η αλυσίδα
 * `resolveTemplate → readTitleBlockContent` σε δύο σημεία (N.18: μηδέν clone).
 */
export function resolveTitleBlockContent(
  template: TextTemplate,
  scope: PlaceholderScope,
): TitleBlockContent {
  return readTitleBlockContent(resolveTemplate(template, scope));
}
