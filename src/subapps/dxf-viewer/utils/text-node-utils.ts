/**
 * ADR-344 — Shared utilities for DxfTextNode plain-text extraction.
 * SSoT for the paragraph→run→text reduction used by bounds, hit-testing, and scene conversion.
 */

import type { DxfTextNode, TextRun, TextStack } from '../text-engine/types';

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
 * Reduce a DxfTextNode to a plain string by flattening paragraphs→runs.
 * TextStack items (subscript/superscript, identified by `'top' in run`) are skipped.
 * Paragraphs are joined with newlines to preserve multiline structure.
 */
export function extractFlatText(textNode: DxfTextNode): string {
  // `paragraphs ?? []` — ποτέ throw σε ημιτελές AST. Καλείται από hit-test / bounds / render:
  // ένα crash εδώ ρίχνει ολόκληρο τον καμβά για μία κακοσχηματισμένη οντότητα.
  return (textNode.paragraphs ?? [])
    .map(p => (p.runs ?? [])
      .filter(r => !('top' in r))
      .map(r => (r as TextRun).text)
      .join(''))
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
