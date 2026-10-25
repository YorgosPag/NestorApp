'use client';

/**
 * =============================================================================
 * ΤΟ ΕΝΑ ΑΝΑΔΙΑΤΑΣΣΟΜΕΝΟ ΔΕΝΤΡΟ (ADR-923 Φάση 1γ) — WAI-ARIA tree + drag με πρόβλεψη βάθους
 * =============================================================================
 *
 * - `role="tree"` / `treeitem` με `aria-level` · `aria-expanded` · `aria-selected` και **roving tabindex**: ένα
 *   Tab μπαίνει στο δέντρο, τα βέλη κινούνται μέσα του (APG «Tree View»).
 * - **Αναδιάταξη χωρίς ποντίκι**: Alt+βέλη (`use-tree-keyboard`). Κάθε μετακίνηση **ανακοινώνεται** στη γλώσσα
 *   του χρήστη (`common:sortable.*`) από περιοχή `aria-live`.
 * - **Drag**: η οριζόντια μετατόπιση ορίζει το βάθος (μοτίβο δέντρου του dnd-kit), οι απόγονοι ταξιδεύουν μαζί και
 *   η γραμμή ζωγραφίζεται στο **προβλεπόμενο** βάθος όσο σέρνεται — ο άνθρωπος βλέπει πού θα πέσει πριν αφήσει.
 *
 * 🔑 Όπως η λίστα: **δεν αλλάζει σειρά μόνο του**. Αναφέρει `TreeMove` (γονέας + γείτονες, διευθετημένο πάνω στο
 *    πλήρες δέντρο) και ο ιδιοκτήτης γράφει **ένα** κλειδί σειράς. Ό,τι απαγορεύει ο τομέας (βάθος, κύκλος) το
 *    κρίνει ο καταναλωτής στο `canMove` — το γενικό δέντρο δεν ξέρει τι είναι «κατηγορία».
 *
 * @module components/ui/sortable/SortableTree
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  flattenTree,
  keyboardTreeMove,
  projectTreeDrop,
  settleTreeMove,
  type FlatTreeNode,
  type TreeKeyboardMove,
  type TreeMove,
} from './sortable-model';
import { useSortableSensors } from './SortableList';
import { useDragTransform } from './use-drag-transform';
import { useTreeKeyboard } from './use-tree-keyboard';

/** Πλάτος μιας εσοχής (px) — ίδιο με το βήμα των κλάσεων `DEPTH_INDENT`. */
const INDENT_PX = 24;

/** Εσοχή ανά βάθος ως **στατικές** κλάσεις (Tailwind JIT), όχι inline style (N.3). Βαθύτερα κρατούν την τελευταία. */
const DEPTH_INDENT = [
  'pl-0', 'pl-6', 'pl-12', 'pl-[4.5rem]', 'pl-24', 'pl-[7.5rem]',
  'pl-36', 'pl-[10.5rem]', 'pl-48', 'pl-[13.5rem]', 'pl-60',
] as const;

const indentOf = (depth: number) => DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)];

export interface SortableTreeNode {
  readonly id: string;
  readonly parentId: string | null;
  /** Όνομα για ανακοινώσεις. */
  readonly label: string;
}

export interface SortableTreeRowState {
  readonly depth: number;
  readonly selected: boolean;
  readonly expanded: boolean;
}

export interface SortableTreeProps {
  /** Οι κόμβοι· η σειρά των αδελφών είναι η σειρά του πίνακα. */
  readonly nodes: readonly SortableTreeNode[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onMove: (move: TreeMove) => void;
  /** Κρίση τομέα πριν τη μετακίνηση· `false` ⇒ ανακοινώνεται άρνηση, τίποτα δεν στέλνεται. */
  readonly canMove?: (move: TreeMove) => boolean;
  readonly onRename?: (id: string) => void;
  readonly renderLabel: (node: SortableTreeNode, state: SortableTreeRowState) => React.ReactNode;
  readonly renderActions?: (node: SortableTreeNode) => React.ReactNode;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

interface DragState {
  readonly activeId: string;
  readonly overId: string;
  readonly offsetX: number;
}

/** Ανοιχτοί/κλειστοί κόμβοι — προεπιλογή: όλα ανοιχτά (ο κατάλογος είναι μικρός, η δομή πρέπει να φαίνεται). */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const setExpanded = useCallback((id: string, expanded: boolean) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return { collapsed, setExpanded };
}

function useTreeMoves(props: SortableTreeProps, announce: (text: string) => void) {
  const { t } = useTranslation('common');
  const { nodes, onMove, canMove } = props;
  const labelOf = useCallback((id: string | null) => nodes.find((node) => node.id === id)?.label ?? '', [nodes]);
  return useCallback(
    (move: TreeMove | null) => {
      if (!move) return;
      const settled = settleTreeMove(nodes, move);
      if (canMove && !canMove(settled)) {
        announce(t('sortable.refused', { label: labelOf(settled.id) }));
        return;
      }
      onMove(settled);
      announce(
        settled.parentId === null
          ? t('sortable.treeMovedToRoot', { label: labelOf(settled.id) })
          : t('sortable.treeMoved', { label: labelOf(settled.id), parent: labelOf(settled.parentId) }),
      );
    },
    [nodes, onMove, canMove, announce, labelOf, t],
  );
}

/** Ό,τι μοιράζονται όλες οι γραμμές μιας απόδοσης. */
interface TreeRowContext {
  readonly tree: SortableTreeProps;
  readonly hidden: ReadonlySet<string>;
  readonly tabStop: string | null;
  readonly disabled: boolean;
  /** Βάθος ζωγραφικής (το σέρνεται κόμβος ζωγραφίζεται στο **προβλεπόμενο**). */
  readonly depthOf: (flat: FlatTreeNode) => number;
  readonly registerRef: (id: string, node: HTMLElement | null) => void;
  readonly onKeyDown: (event: React.KeyboardEvent, id: string) => void;
  readonly onToggle: (id: string, expanded: boolean) => void;
  readonly onFocusRow: (id: string) => void;
}

interface TreeExpanderProps {
  readonly node: SortableTreeNode;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly onToggle: (id: string, expanded: boolean) => void;
}

/** Το βελάκι ανοίγματος — εκτός σειράς Tab (το δέντρο ανοίγει με ←/→, APG). */
function TreeExpander({ node, hasChildren, expanded, onToggle }: TreeExpanderProps) {
  const { t } = useTranslation('common');
  if (!hasChildren) return <span className="inline-block w-5 shrink-0" aria-hidden />;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={t(expanded ? 'sortable.collapse' : 'sortable.expand', { label: node.label })}
      className="inline-flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground"
      onClick={(event) => { event.stopPropagation(); onToggle(node.id, !expanded); }}
    >
      <Chevron className="h-4 w-4" aria-hidden />
    </button>
  );
}

interface TreeRowProps {
  readonly node: SortableTreeNode;
  readonly flat: FlatTreeNode;
  readonly ctx: TreeRowContext;
}

function TreeRow({ node, flat, ctx }: TreeRowProps) {
  const depth = ctx.depthOf(flat);
  const state: SortableTreeRowState = { depth, selected: node.id === ctx.tree.selectedId, expanded: !ctx.hidden.has(node.id) };
  const { tree, disabled, registerRef, onKeyDown, onToggle, onFocusRow } = ctx;
  const focusable = node.id === ctx.tabStop;
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, disabled });
  const dragRef = useDragTransform(setNodeRef, transform, transition);
  const rowRef = useCallback((element: HTMLElement | null) => { dragRef(element); registerRef(node.id, element); }, [dragRef, registerRef, node.id]);
  return (
    <li
      ref={rowRef}
      role="treeitem"
      aria-level={flat.depth + 1}
      aria-expanded={flat.hasChildren ? state.expanded : undefined}
      aria-selected={state.selected}
      tabIndex={focusable ? 0 : -1}
      onKeyDown={(event) => { if (event.target === event.currentTarget) onKeyDown(event, node.id); }}
      onFocus={(event) => { if (event.target === event.currentTarget) onFocusRow(node.id); }}
      onClick={() => tree.onSelect(node.id)}
      className={cn(
        'flex list-none items-center gap-1 rounded-md py-1 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        indentOf(depth),
        state.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        isDragging && 'relative opacity-80 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        tabIndex={-1}
        aria-hidden
        className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <TreeExpander node={node} hasChildren={flat.hasChildren} expanded={state.expanded} onToggle={onToggle} />
      <span className="min-w-0 flex-1">{tree.renderLabel(node, state)}</span>
      {tree.renderActions ? <span className="flex shrink-0 items-center gap-1">{tree.renderActions(node)}</span> : null}
    </li>
  );
}

function useTreeDrag(flat: readonly FlatTreeNode[], commit: (move: TreeMove | null) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setDrag({ activeId: String(active.id), overId: String(active.id), offsetX: 0 });
  }, []);
  const onDragMove = useCallback(({ active, over, delta }: DragMoveEvent) => {
    setDrag({ activeId: String(active.id), overId: String(over?.id ?? active.id), offsetX: delta.x });
  }, []);
  const onDragEnd = useCallback(({ active, over, delta }: DragEndEvent) => {
    setDrag(null);
    commit(over ? projectTreeDrop(flat, String(active.id), String(over.id), delta.x, INDENT_PX) : null);
  }, [flat, commit]);
  const projected = drag ? projectTreeDrop(flat, drag.activeId, drag.overId, drag.offsetX, INDENT_PX) : null;
  return { drag, projected, onDragStart, onDragMove, onDragEnd, onDragCancel: () => setDrag(null) };
}

/** Βάθος του `id` αν μπει κάτω από τον `parentId`. */
function depthUnder(flat: readonly FlatTreeNode[], parentId: string | null): number {
  if (parentId === null) return 0;
  return (flat.find((node) => node.id === parentId)?.depth ?? -1) + 1;
}

/** Roving tabindex: ποιος κόμβος κρατά το Tab, και εστίαση με το id (APG). */
function useRovingFocus() {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const registerRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) refs.current.set(id, element);
    else refs.current.delete(id);
  }, []);
  const focus = useCallback((id: string) => {
    setFocusedId(id);
    refs.current.get(id)?.focus();
  }, []);
  return { focusedId, setFocusedId, registerRef, focus };
}

/** Το σέρνεται κόμβος κρύβει προσωρινά τους απογόνους του (ταξιδεύουν μαζί του). */
function useVisibleTree(nodes: readonly SortableTreeNode[], collapsed: ReadonlySet<string>) {
  const [dragCollapsed, setDragCollapsed] = useState<string | null>(null);
  const hidden = useMemo(() => (dragCollapsed ? new Set([...collapsed, dragCollapsed]) : collapsed), [collapsed, dragCollapsed]);
  const flat = useMemo(() => flattenTree(nodes, hidden), [nodes, hidden]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  return { hidden, flat, byId, setDragCollapsed };
}

export function SortableTree(props: SortableTreeProps) {
  const { nodes, selectedId, onSelect, onRename, ariaLabel, disabled = false } = props;
  const { t } = useTranslation('common');
  const sensors = useSortableSensors();
  const { collapsed, setExpanded } = useCollapsed();
  const [announcement, setAnnouncement] = useState('');
  const roving = useRovingFocus();
  const commit = useTreeMoves(props, setAnnouncement);
  const { hidden, flat, byId, setDragCollapsed } = useVisibleTree(nodes, collapsed);
  const dragging = useTreeDrag(flat, commit);
  const move = useCallback(
    (id: string, keyMove: TreeKeyboardMove) => { if (!disabled) commit(keyboardTreeMove(nodes, id, keyMove)); },
    [nodes, commit, disabled],
  );
  const handlers = useMemo(
    () => ({ focus: roving.focus, setExpanded, select: onSelect, rename: onRename, move }),
    [roving.focus, setExpanded, onSelect, onRename, move],
  );
  const onKeyDown = useTreeKeyboard(flat, hidden, handlers);
  const tabStop = roving.focusedId ?? selectedId ?? flat[0]?.id ?? null;
  const projectedParent = dragging.projected?.parentId;
  const activeId = dragging.drag?.activeId;
  const ctx: TreeRowContext = {
    tree: props, hidden, tabStop, disabled, registerRef: roving.registerRef, onKeyDown, onToggle: setExpanded,
    onFocusRow: roving.setFocusedId,
    depthOf: (node) => (node.id === activeId && projectedParent !== undefined ? depthUnder(flat, projectedParent) : node.depth),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => { setDragCollapsed(String(event.active.id)); dragging.onDragStart(event); }}
      onDragMove={dragging.onDragMove}
      onDragEnd={(event) => { setDragCollapsed(null); dragging.onDragEnd(event); }}
      onDragCancel={() => { setDragCollapsed(null); dragging.onDragCancel(); }}
      accessibility={{ screenReaderInstructions: { draggable: t('sortable.treeInstructions') } }}
    >
      <SortableContext items={flat.map((node) => node.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul role="tree" aria-label={ariaLabel} className="m-0 flex flex-col gap-0.5 p-0">
          {flat.map((flatNode) => {
            const node = byId.get(flatNode.id);
            return node ? <TreeRow key={node.id} node={node} flat={flatNode} ctx={ctx} /> : null;
          })}
        </ul>
      </SortableContext>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </DndContext>
  );
}
