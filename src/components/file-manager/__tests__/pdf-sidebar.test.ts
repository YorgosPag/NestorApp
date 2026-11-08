/**
 * ADR-923 §5.15.2 (Θ.2α-3) — άγκυρες των καθαρών πυρήνων του πλευρικού πάνελ:
 * `normalizePdfOutline` (όρια + κριτής URL) · `resolveOutlinePages` (ο ΙΔΙΟΣ λύτης) · `activeOutlineId` ·
 * `nextTreeAction` (APG) · `initialSidebarState` / `parseStoredSidebar` · ακύρωση στο `pdf-thumbnail-store`.
 */

/* global describe, it, expect, jest */

import { nextTreeAction, type TreeNavItem } from '@/lib/a11y/tree-navigation';

import type { PdfDocProxy, PdfRawOutlineItem } from '../pdf-canvas-config';
import {
  activeOutlineId,
  normalizePdfOutline,
  outlineAncestorIds,
  PDF_OUTLINE_MAX_DEPTH,
  PDF_OUTLINE_MAX_NODES,
  resolveOutlinePages,
} from '../pdf-outline';
import { createPdfThumbnailStore } from '../pdf-thumbnail-store';
import { initialSidebarState, parseStoredSidebar } from '../usePdfSidebar';

const item = (title: string, extra: Partial<PdfRawOutlineItem> = {}): PdfRawOutlineItem => ({
  title, dest: null, url: null, items: [], ...extra,
});

describe('normalizePdfOutline', () => {
  it('ταυτότητες θέσης, γονείς, αρχικό άνοιγμα από το /Count', () => {
    const nodes = normalizePdfOutline([item('Α', { dest: 'a', count: 2, items: [item('Α1', { dest: 'a1' })] }), item('Β', { dest: 'b' })]);
    expect(nodes.map((node) => node.id)).toEqual(['0', '1']);
    expect(nodes[0].children[0]).toMatchObject({ id: '0.0', parentId: '0', title: 'Α1' });
    expect(nodes[0].initiallyExpanded).toBe(true);
    expect(nodes[1].initiallyExpanded).toBe(false);
  });

  it('εξωτερικό URL περνά από τον ΕΝΑ κριτή συνδέσμων', () => {
    const [safe, evil] = normalizePdfOutline([item('web', { url: 'https://aries.gr' }), item('js', { url: 'javascript:alert(1)' })]);
    expect(safe.target).toMatchObject({ kind: 'external', href: 'https://aries.gr/' });
    expect(evil.target).toEqual({ kind: 'none' });
  });

  it('φραγμένο βάθος και πλήθος (ξένο έντυπο)', () => {
    let deep = item('φύλλο');
    for (let level = 0; level < PDF_OUTLINE_MAX_DEPTH + 5; level += 1) deep = item(`L${level}`, { items: [deep] });
    let depth = 0;
    for (let nodes = normalizePdfOutline([deep]); nodes.length > 0; nodes = nodes[0].children) depth += 1;
    expect(depth).toBe(PDF_OUTLINE_MAX_DEPTH);
    const wide = normalizePdfOutline(Array.from({ length: PDF_OUTLINE_MAX_NODES + 50 }, (_, index) => item(String(index))));
    expect(wide).toHaveLength(PDF_OUTLINE_MAX_NODES);
  });

  it('null ⇒ κενό', () => {
    expect(normalizePdfOutline(null)).toEqual([]);
  });
});

function fakeDoc(): PdfDocProxy {
  const doc: Pick<PdfDocProxy, 'numPages' | 'getDestination' | 'getPageIndex'> = {
    numPages: 10,
    getDestination: async (id) => ({ a: [{ num: 1, gen: 0 }], a1: [{ num: 3, gen: 0 }], b: [{ num: 7, gen: 0 }] } as Record<string, unknown[]>)[id] ?? null,
    getPageIndex: async (ref) => ref.num - 1,
  };
  return doc as unknown as PdfDocProxy;
}

describe('resolveOutlinePages + activeOutlineId', () => {
  const outline = normalizePdfOutline([
    item('Α', { dest: 'a', items: [item('Α1', { dest: 'a1' })] }),
    item('χαμένο', { dest: 'missing' }),
    item('Β', { dest: 'b' }),
  ]);

  it('ο ίδιος λύτης: όνομα ⇒ σελίδα· ό,τι δεν λύνεται λείπει', async () => {
    const pages = await resolveOutlinePages(fakeDoc(), outline);
    expect(Object.fromEntries(pages)).toEqual({ '0': 1, '0.0': 3, '2': 7 });
  });

  it('ενεργή = το τελευταίο με σελίδα ≤ τρέχουσας (το βαθύτερο σε ισοπαλία)', async () => {
    const pages = await resolveOutlinePages(fakeDoc(), outline);
    expect(activeOutlineId(outline, pages, 1)).toBe('0');
    expect(activeOutlineId(outline, pages, 5)).toBe('0.0');
    expect(activeOutlineId(outline, pages, 9)).toBe('2');
    const tie = new Map([['0', 4], ['0.0', 4]]);
    expect(activeOutlineId(outline, tie, 4)).toBe('0.0');
    expect(activeOutlineId(outline, tie, 2)).toBeNull();
  });

  it('πρόγονοι για το αυτόματο άνοιγμα του κλάδου', () => {
    expect(outlineAncestorIds('2.0.3')).toEqual(['2', '2.0']);
    expect(outlineAncestorIds('1')).toEqual([]);
  });
});

describe('nextTreeAction — WAI-ARIA APG tree', () => {
  const items: TreeNavItem[] = [
    { id: 'a', parentId: null, hasChildren: true, expanded: true },
    { id: 'a.0', parentId: 'a', hasChildren: false, expanded: false },
    { id: 'b', parentId: null, hasChildren: true, expanded: false },
  ];
  it.each([
    ['ArrowDown', 'a', { kind: 'focus', id: 'a.0' }],
    ['ArrowUp', 'a.0', { kind: 'focus', id: 'a' }],
    ['ArrowRight', 'b', { kind: 'expand', id: 'b' }],
    ['ArrowRight', 'a', { kind: 'focus', id: 'a.0' }],
    ['ArrowLeft', 'a', { kind: 'collapse', id: 'a' }],
    ['ArrowLeft', 'a.0', { kind: 'focus', id: 'a' }],
    ['Home', 'b', { kind: 'focus', id: 'a' }],
    ['End', 'a', { kind: 'focus', id: 'b' }],
  ])('%s πάνω στο %s', (key, current, expected) => {
    expect(nextTreeAction(items, current, key)).toEqual(expected);
  });
  it('όρια και ξένα πλήκτρα ⇒ null', () => {
    expect(nextTreeAction(items, 'b', 'ArrowDown')).toBeNull();
    expect(nextTreeAction(items, 'a.0', 'ArrowRight')).toBeNull();
    expect(nextTreeAction(items, 'a', 'x')).toBeNull();
  });
});

describe('initialSidebarState — /PageMode νικά, μετά η συσκευή', () => {
  it('το έγγραφο ζητά περιεχόμενα ⇒ ανοιχτό στα περιεχόμενα', () => {
    expect(initialSidebarState({ open: false, tab: 'thumbnails' }, 'outline', true)).toEqual({ open: true, tab: 'outline' });
  });
  it('ποτέ καρτέλα περιεχομένων σε έγγραφο χωρίς περιεχόμενα', () => {
    expect(initialSidebarState({ open: true, tab: 'outline' }, null, false)).toEqual({ open: true, tab: 'thumbnails' });
    expect(initialSidebarState({ open: false, tab: null }, 'outline', false)).toEqual({ open: true, tab: 'thumbnails' });
  });
  it('χωρίς προτίμηση εγγράφου ⇒ η αποθηκευμένη, αλλιώς περιεχόμενα αν υπάρχουν', () => {
    expect(initialSidebarState({ open: true, tab: 'thumbnails' }, null, true)).toEqual({ open: true, tab: 'thumbnails' });
    expect(initialSidebarState({ open: false, tab: null }, null, true)).toEqual({ open: false, tab: 'outline' });
  });
  it('αλλοιωμένη αποθήκευση ⇒ προεπιλογή, ποτέ σφάλμα', () => {
    expect(parseStoredSidebar('σκουπίδι')).toEqual({ open: false, tab: null });
    expect(parseStoredSidebar({ open: 'yes', tab: 'grid' })).toEqual({ open: false, tab: null });
  });
});

describe('pdf-thumbnail-store — φρένο δικτύου', () => {
  it('ό,τι βγαίνει από το ορατό ακυρώνεται· το όριο ταυτοχρονίας τηρείται', async () => {
    const cancel = jest.fn();
    const getPage = jest.fn(async () => ({
      getViewport: () => ({ width: 600, height: 800 }),
      render: () => ({ cancel, promise: new Promise<void>(() => undefined) }),
    }));
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as CanvasRenderingContext2D);
    const store = createPdfThumbnailStore({ getPage } as unknown as PdfDocProxy);
    store.request([1, 2, 3, 4], 0);
    await Promise.resolve();
    await Promise.resolve();
    expect(getPage).toHaveBeenCalledTimes(2);
    store.request([9], 0);
    expect(cancel).toHaveBeenCalledTimes(2);
    store.dispose();
  });
});
