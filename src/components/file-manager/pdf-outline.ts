/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-3) — **Τα περιεχόμενα ενός PDF**: καθαρός πυρήνας του `PdfOutlineTree`, χωρίς React.
 * @module components/file-manager/pdf-outline
 *
 * 🔑 Ο προορισμός λύνεται από τον **ίδιο** λύτη με τους συνδέσμους (`resolvePdfDestinationPage`) και ο εξωτερικός
 *    σύνδεσμος κρίνεται από τον **ίδιο** κριτή (`externalTargetOf`) — ένα ξένο έντυπο δεν αποκτά δεύτερη πόρτα.
 * 🔑 **Πέρα από το pdf.js**: εκεί η «τρέχουσα ενότητα» φωτίζεται μόνο με κουμπί και μόνο αφού φορτώσουν **όλες** οι
 *    σελίδες. Εδώ λύνονται μόνο οι προορισμοί του δέντρου (δεκάδες, όχι 300 σελίδες) και η ενεργή ενότητα ακολουθεί τη
 *    σελίδα ζωντανά: το **βαθύτερο** στοιχείο του τελευταίου κλάδου με σελίδα ≤ της τρέχουσας.
 * 🔒 Ξένο έντυπο ⇒ φραγμένο βάθος και πλήθος: ένα κακόβουλο `/Outlines` δεν κρεμάει τη σελίδα.
 */

import type { PdfDocProxy, PdfExplicitDest, PdfRawOutlineItem } from './pdf-canvas-config';
import { externalTargetOf, resolvePdfDestinationPage } from './pdf-link-target';

export const PDF_OUTLINE_MAX_DEPTH = 8;
export const PDF_OUTLINE_MAX_NODES = 2000;
/** Πόσοι προορισμοί λύνονται ταυτόχρονα — σε έντυπο με άδεια κάθε λύση μπορεί να ζητήσει κομμάτι. */
const RESOLVE_CONCURRENCY = 4;

export type PdfOutlineTarget =
  | { readonly kind: 'internal'; readonly dest: string | PdfExplicitDest }
  | { readonly kind: 'external'; readonly href: string; readonly label: string }
  | { readonly kind: 'none' };

export interface PdfOutlineNode {
  /** Θέση στο δέντρο (`0.2.1`) — σταθερή για το ίδιο έγγραφο. */
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly target: PdfOutlineTarget;
  readonly initiallyExpanded: boolean;
  readonly children: readonly PdfOutlineNode[];
}

function targetOf(item: PdfRawOutlineItem): PdfOutlineTarget {
  if (typeof item.url === 'string' && item.url !== '') return externalTargetOf(item.url) ?? { kind: 'none' };
  const { dest } = item;
  if ((typeof dest === 'string' && dest !== '') || (Array.isArray(dest) && dest.length > 0)) return { kind: 'internal', dest };
  return { kind: 'none' };
}

/** Ο ακατέργαστος πίνακας του `getOutline()` ⇒ δέντρο με ταυτότητες, μέσα στα όρια βάθους και πλήθους. */
export function normalizePdfOutline(raw: readonly PdfRawOutlineItem[] | null): readonly PdfOutlineNode[] {
  let budget = PDF_OUTLINE_MAX_NODES;
  const walk = (items: readonly PdfRawOutlineItem[], parentId: string | null, depth: number): PdfOutlineNode[] => {
    const nodes: PdfOutlineNode[] = [];
    for (let index = 0; index < items.length && budget > 0; index += 1) {
      budget -= 1;
      const item = items[index];
      const id = parentId === null ? String(index) : `${parentId}.${index}`;
      const children = depth + 1 < PDF_OUTLINE_MAX_DEPTH && Array.isArray(item.items) ? walk(item.items, id, depth + 1) : [];
      nodes.push({
        id,
        parentId,
        title: typeof item.title === 'string' ? item.title.trim() : '',
        bold: item.bold === true,
        italic: item.italic === true,
        target: targetOf(item),
        initiallyExpanded: typeof item.count === 'number' && item.count > 0,
        children,
      });
    }
    return nodes;
  };
  return raw ? walk(raw, null, 0) : [];
}

/** Όλοι οι κόμβοι σε σειρά ανάγνωσης (προδιάταξη). */
export function flattenPdfOutline(nodes: readonly PdfOutlineNode[]): PdfOutlineNode[] {
  return nodes.flatMap((node) => [node, ...flattenPdfOutline(node.children)]);
}

/** Κάθε εσωτερικός προορισμός ⇒ σελίδα 1..N (όσοι δεν λύνονται λείπουν από τον χάρτη). Φραγμένη ταυτοχρονία. */
export async function resolveOutlinePages(
  doc: PdfDocProxy,
  nodes: readonly PdfOutlineNode[],
  isCancelled: () => boolean = () => false,
): Promise<ReadonlyMap<string, number>> {
  const pending = flattenPdfOutline(nodes).filter((node) => node.target.kind === 'internal');
  const pages = new Map<string, number>();
  const worker = async (): Promise<void> => {
    for (let node = pending.shift(); node && !isCancelled(); node = pending.shift()) {
      if (node.target.kind !== 'internal') continue;
      const page = await resolvePdfDestinationPage(doc, node.target.dest).catch(() => null);
      if (page !== null) pages.set(node.id, page);
    }
  };
  await Promise.all(Array.from({ length: RESOLVE_CONCURRENCY }, worker));
  return pages;
}

/**
 * Η ενεργή ενότητα για την τρέχουσα σελίδα: σε σειρά ανάγνωσης, το **τελευταίο** στοιχείο με σελίδα ≤ τρέχουσας — άρα
 * σε ισοπαλία σελίδας το βαθύτερο (το παιδί έρχεται μετά τον γονιό). Τίποτα πριν από την πρώτη ενότητα ⇒ `null`.
 */
export function activeOutlineId(nodes: readonly PdfOutlineNode[], pages: ReadonlyMap<string, number>, currentPage: number): string | null {
  let best: { readonly id: string; readonly page: number } | null = null;
  for (const node of flattenPdfOutline(nodes)) {
    const page = pages.get(node.id);
    if (page === undefined || page > currentPage) continue;
    if (best === null || page >= best.page) best = { id: node.id, page };
  }
  return best?.id ?? null;
}

/** Οι πρόγονοι ενός κόμβου (για να ανοίξει ο κλάδος της ενεργής ενότητας). */
export function outlineAncestorIds(id: string): string[] {
  const parts = id.split('.');
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('.'));
}
