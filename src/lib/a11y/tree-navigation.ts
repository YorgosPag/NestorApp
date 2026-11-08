/**
 * @fileoverview **Πού πάει η εστίαση σε ένα ARIA tree** — ο καθαρός πυρήνας του πληκτρολογίου του WAI-ARIA APG
 * (Tree View pattern), χωρίς React και χωρίς DOM.
 * @module lib/a11y/tree-navigation
 * @related ADR-923 §5.15.2 (Θ.2α-3 — περιεχόμενα του `PdfCanvasViewer`) · `./keyboard-scope` (το `tree` είναι widget που
 *   κρατά τα πλήκτρα του)
 *
 * Ο καταναλωτής δίνει τα **ορατά** στοιχεία με τη σειρά που φαίνονται (τα παιδιά κλειστού κόμβου λείπουν) και ο πυρήνας
 * απαντά με **πράξη** — ποτέ δεν αλλάζει κατάσταση μόνος του.
 *
 * | Πλήκτρο | APG |
 * |---|---|
 * | ↓ / ↑ | επόμενο / προηγούμενο ορατό |
 * | → | κλειστός γονιός ⇒ άνοιξε · ανοιχτός ⇒ πρώτο παιδί · φύλλο ⇒ τίποτα |
 * | ← | ανοιχτός ⇒ κλείσε · αλλιώς ⇒ ο γονιός |
 * | Home / End | πρώτο / τελευταίο ορατό |
 */

export interface TreeNavItem {
  readonly id: string;
  /** `null` ⇒ κόμβος ρίζας. */
  readonly parentId: string | null;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}

export type TreeNavAction =
  | { readonly kind: 'focus'; readonly id: string }
  | { readonly kind: 'expand'; readonly id: string }
  | { readonly kind: 'collapse'; readonly id: string };

const at = (items: readonly TreeNavItem[], index: number): TreeNavAction | null => {
  const item = items[index];
  return item ? { kind: 'focus', id: item.id } : null;
};

function horizontal(items: readonly TreeNavItem[], index: number, key: 'ArrowRight' | 'ArrowLeft'): TreeNavAction | null {
  const item = items[index];
  if (key === 'ArrowRight') {
    if (!item.hasChildren) return null;
    return item.expanded ? at(items, index + 1) : { kind: 'expand', id: item.id };
  }
  if (item.hasChildren && item.expanded) return { kind: 'collapse', id: item.id };
  return item.parentId === null ? null : { kind: 'focus', id: item.parentId };
}

/** Το πλήκτρο πάνω στο εστιασμένο στοιχείο ⇒ η πράξη, ή `null` αν το πλήκτρο δεν ανήκει στο δέντρο (ή δεν έχει όριο). */
export function nextTreeAction(items: readonly TreeNavItem[], currentId: string, key: string): TreeNavAction | null {
  const index = items.findIndex((item) => item.id === currentId);
  if (index < 0) return at(items, 0);
  switch (key) {
    case 'ArrowDown': return at(items, index + 1);
    case 'ArrowUp': return at(items, index - 1);
    case 'Home': return at(items, 0);
    case 'End': return at(items, items.length - 1);
    case 'ArrowRight':
    case 'ArrowLeft': return horizontal(items, index, key);
    default: return null;
  }
}
