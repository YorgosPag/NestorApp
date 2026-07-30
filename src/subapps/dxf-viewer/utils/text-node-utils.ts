/**
 * ADR-344 — Shared utilities for DxfTextNode plain-text extraction.
 * SSoT for the paragraph→run→text reduction used by bounds, hit-testing, and scene conversion.
 */

import type { DxfTextNode, TextRun, TextStack } from '../text-engine/types';
// Deep import (όχι από το barrel): ο διαχωριστής στοίβας είναι η ΜΟΝΗ τιμή που χρειάζεται εδώ,
// και το `text-ast.types` δεν έχει εξαρτήσεις χρόνου εκτέλεσης — η `extractFlatText` καλείται
// από hit-test/bounds/render και δεν πρέπει να σέρνει μαζί της τον parser/serializer.
import { mtextStackDivider } from '../text-engine/types/text-ast.types';

function isTextStack(item: TextRun | TextStack): item is TextStack {
  return (item as TextStack).top !== undefined;
}

/**
 * ADR-557 Φ-attachment — scale every run's `style.height` by `ratio` (proportional,
 * AutoCAD-correct for a uniform box resize), returning a NEW node (paragraphs/runs
 * cloned). TextStack items and run-less/height-less runs are left as-is.
 *
 * WHY: `resolveTextHeight` reads the run `style.height` FIRST, so a flat `height` write
 * alone is SHADOWED same-tick — a text-grip resize must scale the textNode to persist.
 * `ratio ≤ 0` or `=== 1` is a no-op (returns the same node reference).
 */
export function scaleTextNodeRunHeights(node: DxfTextNode, ratio: number): DxfTextNode {
  if (!(ratio > 0) || ratio === 1) return node;
  return {
    ...node,
    paragraphs: node.paragraphs.map((para) => ({
      ...para,
      runs: para.runs.map((item) => {
        if (isTextStack(item)) return item;
        const run = item as TextRun;
        const h = run.style?.height;
        return h !== undefined && h > 0
          ? { ...run, style: { ...run.style, height: h * ratio } }
          : run;
      }),
    })),
  };
}

/**
 * Ένα παιδί παραγράφου → κείμενο. Μια στοίβα `\S` αποδίδεται `top`+διαχωριστής+`bottom` με τον
 * διαχωριστή που της αντιστοιχεί (`^` / `/` / `#`) — τον ΙΔΙΟ που γράφει ο serializer.
 */
function flattenRunItem(item: TextRun | TextStack): string {
  if (!isTextStack(item)) return item.text ?? '';
  return `${item.top ?? ''}${mtextStackDivider(item.type)}${item.bottom ?? ''}`;
}

/**
 * Reduce a DxfTextNode to a plain string by flattening paragraphs→runs.
 * Paragraphs are joined with newlines to preserve multiline structure.
 *
 * 🐛 ΤΑ STACKS ΠΕΤΙΟΝΤΑΝ. Μέχρι τη διόρθωση αυτή η συνάρτηση έκανε `.filter(r => !('top' in r))`,
 * δηλαδή **κάθε `TextStack` εξαφανιζόταν από τη flat προβολή**. Το AST τα κρατούσε σωστά —
 * χάνονταν μόνο εδώ, δηλαδή ακριβώς εκεί όπου κοιτούν render / hit-test / bounds / ο καθρέφτης
 * `.text` του import. Μετρημένο στο `47_ergasia.dxf` (89 MTEXT):
 * `Ε\H0.7x;\S^ τίτλου;\H1.4286x;=231.04τ.μ.` → «Ε=231.04τ.μ.» — ο δείκτης «τίτλου» χανόταν
 * (ίδιο για «καταμέτρησης» και 3 εμβαδά).
 *
 * Δεσμευτική πρακτική ezdxf (`tools/text.py`): το περιεχόμενο του `\S…;` **δεν πετιέται ΠΟΤΕ** —
 * η `fast_plain_mtext()` μαζεύει όλους τους χαρακτήρες της στοίβας μαζί με τον διαχωριστή. Η
 * κάθετη ΣΤΟΙΒΑΞΗ (η δομημένη `plain_mtext()`) είναι θέμα της διάταξης, όχι της flat προβολής.
 *
 * ⚠️ Hot path: καμία regex, καμία δεύτερη διαπέραση, ίδια υπογραφή. `paragraphs ?? []` —
 * ποτέ throw σε ημιτελές AST: ένα crash εδώ ρίχνει ολόκληρο τον καμβά για μία κακοσχηματισμένη
 * οντότητα.
 */
export function extractFlatText(textNode: DxfTextNode): string {
  return (textNode.paragraphs ?? [])
    .map(p => (p.runs ?? []).map(flattenRunItem).join(''))
    .join('\n');
}

/**
 * Το κείμενο μιας οντότητας. **Το AST είναι το canonical** — εκεί γράφει κάθε text command
 * (ADR-344)· το flat `.text` είναι παράγωγος καθρέφτης που ο DXF import γεμίζει μία φορά.
 *
 * ⚠️ Ο έλεγχος είναι σε `paragraphs`, ΟΧΙ απλώς στην ύπαρξη του `textNode`. Ένα **ημιτελές**
 * AST (π.χ. `{ attachment: 'BR' }` — μερικά μονοπάτια φτιάχνουν τέτοιο μόνο για να δηλώσουν
 * στοίχιση) δεν φέρει περιεχόμενο· απαντά «δεν ξέρω», όχι «κενό κείμενο». Χωρίς αυτόν τον
 * διαχωρισμό το ghost preview έχανε το κείμενό του. Κενό AST **με** `paragraphs` είναι
 * γνήσια απάντηση: ο χρήστης έσβησε τα πάντα, και ΔΕΝ επαναφέρουμε τον παλιό καθρέφτη.
 */
export function resolveEntityText(entity: { textNode?: DxfTextNode; text?: string }): string {
  const node = entity.textNode;
  if (node?.paragraphs) return extractFlatText(node);
  return entity.text ?? '';
}
