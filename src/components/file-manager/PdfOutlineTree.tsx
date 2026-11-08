'use client';

/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-3) — **Τα περιεχόμενα** (σελιδοδείκτες) του πλευρικού πάνελ, ως ARIA tree.
 * @module components/file-manager/PdfOutlineTree
 *
 * 🔑 Πληκτρολόγιο: ο **ένας** πυρήνας του APG (`@/lib/a11y/tree-navigation`) · roving tabindex (ένα στοιχείο στο Tab).
 * 🔑 Η ενεργή ενότητα ακολουθεί τη σελίδα ζωντανά (`activeOutlineId`) και ο κλάδος της ανοίγει μόνος του — χωρίς το
 *    κουμπί «Βρες την τρέχουσα ενότητα» του pdf.js.
 * 🔑 Εσωτερικό στοιχείο ⇒ η **μία** πόρτα πλοήγησης (`goToPage`) · εξωτερικό ⇒ νέα καρτέλα με `noopener,noreferrer`
 *    (κανένα `window.opener`, κανένα referrer με άδεια)· ποια URL επιτρέπονται το έκρινε ήδη ο **ένας** κριτής των
 *    συνδέσμων (`externalTargetOf`, μέσα στο `normalizePdfOutline`). Το `treeitem` μένει ένα εστιάσιμο στοιχείο (APG) —
 *    ένα `<a>` μέσα του θα ήταν δεύτερη στάση Tab.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nextTreeAction, type TreeNavItem } from '@/lib/a11y/tree-navigation';
import { cn } from '@/lib/utils';

import { activeOutlineId, flattenPdfOutline, outlineAncestorIds, type PdfOutlineNode } from './pdf-outline';

export interface PdfOutlineTreeProps {
  readonly outline: readonly PdfOutlineNode[];
  readonly pages: ReadonlyMap<string, number>;
  readonly currentPage: number;
  readonly onNavigate: (page: number) => void;
}

function initialExpanded(outline: readonly PdfOutlineNode[]): Set<string> {
  return new Set(flattenPdfOutline(outline).filter((node) => node.initiallyExpanded).map((node) => node.id));
}

/** Τα ορατά στοιχεία με σειρά ανάγνωσης — η είσοδος του πυρήνα πληκτρολογίου. */
function visibleItems(nodes: readonly PdfOutlineNode[], expanded: ReadonlySet<string>): TreeNavItem[] {
  return nodes.flatMap((node) => {
    const open = expanded.has(node.id);
    const item: TreeNavItem = { id: node.id, parentId: node.parentId, hasChildren: node.children.length > 0, expanded: open };
    return open ? [item, ...visibleItems(node.children, expanded)] : [item];
  });
}

function useOutlineState(outline: readonly PdfOutlineNode[], activeId: string | null) {
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(outline));
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => { setExpanded(initialExpanded(outline)); setFocusId(null); }, [outline]);
  // Ο κλάδος της ενεργής ενότητας ανοίγει (Acrobat «expand current bookmark»).
  useEffect(() => {
    if (activeId === null) return;
    setExpanded((prev) => {
      const missing = outlineAncestorIds(activeId).filter((id) => !prev.has(id));
      return missing.length === 0 ? prev : new Set([...prev, ...missing]);
    });
  }, [activeId]);
  const toggle = useCallback((id: string, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !next.has(id)) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  return { expanded, toggle, focusId, setFocusId };
}

interface RowContext {
  readonly pages: ReadonlyMap<string, number>;
  readonly expanded: ReadonlySet<string>;
  readonly activeId: string | null;
  readonly tabStopId: string | null;
  readonly toggle: (id: string, open?: boolean) => void;
  readonly activate: (node: PdfOutlineNode) => void;
  readonly onFocusItem: (id: string) => void;
}

function OutlineLabel({ node, page }: { readonly node: PdfOutlineNode; readonly page: number | undefined }) {
  return (
    <>
      <span className={cn('min-w-0 flex-1 truncate', node.bold && 'font-semibold', node.italic && 'italic')}>{node.title}</span>
      {node.target.kind === 'external' && <ExternalLink aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />}
      {page !== undefined && <span aria-hidden className="shrink-0 text-xs tabular-nums text-muted-foreground">{page}</span>}
    </>
  );
}

function OutlineRow({ node, depth, ctx }: { readonly node: PdfOutlineNode; readonly depth: number; readonly ctx: RowContext }) {
  const { t } = useTranslation('files');
  const hasChildren = node.children.length > 0;
  const open = ctx.expanded.has(node.id);
  const active = node.id === ctx.activeId;
  const page = ctx.pages.get(node.id);
  return (
    <li
      role="treeitem"
      id={`pdf-outline-${node.id}`}
      aria-level={depth}
      aria-expanded={hasChildren ? open : undefined}
      aria-current={active ? 'location' : undefined}
      aria-label={node.title || t('pdf.sidebar.untitled')}
      tabIndex={node.id === ctx.tabStopId ? 0 : -1}
      data-outline-id={node.id}
      onFocus={(event) => { if (event.target === event.currentTarget) ctx.onFocusItem(node.id); }}
      onClick={(event) => { event.stopPropagation(); ctx.activate(node); }}
      className="outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-ring"
    >
      <div className={cn('flex items-center gap-1 rounded-sm py-1 pr-2 text-sm', active ? 'bg-accent text-foreground' : 'hover:bg-muted')}>
        {hasChildren ? (
          <button type="button" tabIndex={-1} aria-hidden onClick={(event) => { event.stopPropagation(); ctx.toggle(node.id); }} className="shrink-0 rounded-sm p-0.5 hover:bg-muted">
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        ) : <span aria-hidden className="w-[18px] shrink-0" />}
        <OutlineLabel node={node} page={page} />
      </div>
      {hasChildren && open && (
        <ul role="group" className="m-0 list-none pl-3">
          {node.children.map((child) => <OutlineRow key={child.id} node={child} depth={depth + 1} ctx={ctx} />)}
        </ul>
      )}
    </li>
  );
}

function openExternal(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}

export function PdfOutlineTree({ outline, pages, currentPage, onNavigate }: PdfOutlineTreeProps) {
  const { t } = useTranslation('files');
  const activeId = useMemo(() => activeOutlineId(outline, pages, currentPage), [outline, pages, currentPage]);
  const { expanded, toggle, focusId, setFocusId } = useOutlineState(outline, activeId);
  const treeRef = useRef<HTMLUListElement | null>(null);
  const items = useMemo(() => visibleItems(outline, expanded), [outline, expanded]);
  const tabStopId = items.some((item) => item.id === focusId) ? focusId : (activeId !== null && items.some((item) => item.id === activeId) ? activeId : items[0]?.id ?? null);

  const activate = useCallback((node: PdfOutlineNode) => {
    setFocusId(node.id);
    if (node.target.kind === 'external') { openExternal(node.target.href); return; }
    const page = pages.get(node.id);
    if (page !== undefined) onNavigate(page);
    else if (node.children.length > 0) toggle(node.id);
  }, [pages, onNavigate, toggle, setFocusId]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (tabStopId === null) return;
    const node = flattenPdfOutline(outline).find((candidate) => candidate.id === tabStopId);
    if ((event.key === 'Enter' || event.key === ' ') && node) { event.preventDefault(); activate(node); return; }
    const action = nextTreeAction(items, tabStopId, event.key);
    if (!action) return;
    event.preventDefault();
    if (action.kind === 'focus') { setFocusId(action.id); treeRef.current?.querySelector<HTMLElement>(`[data-outline-id="${action.id}"]`)?.focus(); }
    else toggle(action.id, action.kind === 'expand');
  };

  if (outline.length === 0) return <p className="p-4 text-sm text-muted-foreground">{t('pdf.sidebar.emptyOutline')}</p>;
  const ctx: RowContext = { pages, expanded, activeId, tabStopId, toggle, activate, onFocusItem: setFocusId };
  return (
    <ul ref={treeRef} role="tree" aria-label={t('pdf.sidebar.outline')} onKeyDown={onKeyDown} className="m-0 h-full list-none overflow-y-auto overscroll-contain p-2">
      {outline.map((node) => <OutlineRow key={node.id} node={node} depth={1} ctx={ctx} />)}
    </ul>
  );
}
