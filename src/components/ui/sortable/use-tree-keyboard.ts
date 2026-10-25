'use client';

/**
 * **Το πληκτρολόγιο του δέντρου** — πλοήγηση κατά WAI-ARIA APG («Tree View») + αναδιάταξη (VS Code/Finder).
 *
 * | Πλήκτρο | Πράξη |
 * |---|---|
 * | ↑ / ↓ | προηγούμενος / επόμενος ορατός κόμβος |
 * | → | κλειστός ⇒ άνοιγμα · ανοιχτός ⇒ πρώτο παιδί |
 * | ← | ανοιχτός ⇒ κλείσιμο · αλλιώς ⇒ γονέας |
 * | Home / End | πρώτος / τελευταίος ορατός |
 * | Enter | επιλογή |
 * | F2 | μετονομασία (αν τη δίνει ο καταναλωτής) |
 * | Alt + ↑ / ↓ | μετακίνηση ανάμεσα στα αδέλφια |
 * | Alt + → / ← | εσοχή (παιδί του προηγούμενου) / προεξοχή (μετά τον γονέα) |
 *
 * Η **άλγεβρα** της μετακίνησης ζει στο `sortable-model` (ίδια για drag και πληκτρολόγιο)· εδώ μόνο η αντιστοίχιση.
 *
 * @module components/ui/sortable/use-tree-keyboard
 */

import { useCallback } from 'react';
import type React from 'react';

import type { FlatTreeNode, TreeKeyboardMove } from './sortable-model';

export interface TreeKeyboardHandlers {
  readonly focus: (id: string) => void;
  readonly setExpanded: (id: string, expanded: boolean) => void;
  readonly select: (id: string) => void;
  readonly rename?: (id: string) => void;
  readonly move: (id: string, move: TreeKeyboardMove) => void;
}

const ALT_MOVES: Readonly<Record<string, TreeKeyboardMove>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'indent',
  ArrowLeft: 'outdent',
};

function horizontalTarget(flat: readonly FlatTreeNode[], at: number, key: string, collapsed: ReadonlySet<string>) {
  const node = flat[at];
  const isOpen = node.hasChildren && !collapsed.has(node.id);
  if (key === 'ArrowRight') {
    if (!node.hasChildren) return null;
    return isOpen ? { focus: flat[at + 1]?.id ?? null } : { expand: node.id };
  }
  if (isOpen) return { collapse: node.id };
  return { focus: node.parentId };
}

/** Επιστρέφει τον χειριστή `onKeyDown` ενός κόμβου. */
export function useTreeKeyboard(
  flat: readonly FlatTreeNode[],
  collapsed: ReadonlySet<string>,
  handlers: TreeKeyboardHandlers,
): (event: React.KeyboardEvent, id: string) => void {
  return useCallback(
    (event: React.KeyboardEvent, id: string) => {
      const at = flat.findIndex((node) => node.id === id);
      if (at === -1) return;
      if (event.altKey && ALT_MOVES[event.key]) {
        event.preventDefault();
        handlers.move(id, ALT_MOVES[event.key]);
        return;
      }
      const step = (to: number) => {
        const target = flat[Math.max(0, Math.min(flat.length - 1, to))];
        if (target) handlers.focus(target.id);
      };
      switch (event.key) {
        case 'ArrowDown': step(at + 1); break;
        case 'ArrowUp': step(at - 1); break;
        case 'Home': step(0); break;
        case 'End': step(flat.length - 1); break;
        case 'Enter': handlers.select(id); break;
        case 'F2': if (!handlers.rename) return; handlers.rename(id); break;
        case 'ArrowRight':
        case 'ArrowLeft': {
          const target = horizontalTarget(flat, at, event.key, collapsed);
          if (!target) return;
          if ('expand' in target) handlers.setExpanded(target.expand, true);
          else if ('collapse' in target) handlers.setExpanded(target.collapse, false);
          else if (target.focus) handlers.focus(target.focus);
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    },
    [flat, collapsed, handlers],
  );
}
