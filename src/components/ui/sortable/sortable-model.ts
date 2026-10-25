/**
 * =============================================================================
 * Η ΚΑΘΑΡΗ ΑΛΓΕΒΡΑ ΤΗΣ ΑΝΑΔΙΑΤΑΞΗΣ — λίστα και δέντρο (ADR-923 §5.2 · Φάση 1γ)
 * =============================================================================
 *
 * 🔑 **Η μετακίνηση εκφράζεται ως «ανάμεσα σε ποιους γείτονες»**, ποτέ ως «νέος δείκτης». Ο καταναλωτής
 *    μετατρέπει τους γείτονες σε κλειδί σειράς με το `keyBetween` (`lib/ordering/fractional-index`) ⇒ η
 *    μετακίνηση γράφει **ένα** έγγραφο (Figma/tldraw), όχι επαναρίθμηση όλων των αδελφών. Δείκτης θα
 *    σήμαινε ότι ο καλών πρέπει να ξαναχτίσει τη λίστα για να βρει τους γείτονες — δύο αλγόριθμοι για ένα ερώτημα.
 *
 * 🔑 **Μηδέν React, μηδέν dnd-kit** εδώ: η ίδια άλγεβρα κρίνεται από το drag (`projectTreeDrop`) **και** από το
 *    πληκτρολόγιο (`keyboardTreeMove`), και δοκιμάζεται χωρίς DOM.
 *
 * Το δέντρο είναι **επίπεδη** λίστα κόμβων με `parentId`· η σειρά των αδελφών είναι η σειρά του πίνακα (ο
 * καταναλωτής ταξινομεί πρώτα κατά κλειδί σειράς).
 *
 * @module components/ui/sortable/sortable-model
 */

/** Θέση ανάμεσα σε δύο γείτονες· `null` = άκρο. */
export interface SortableNeighbors {
  /** Ο γείτονας **πριν** τη νέα θέση. */
  readonly beforeId: string | null;
  /** Ο γείτονας **μετά** τη νέα θέση. */
  readonly afterId: string | null;
}

/** Μετακίνηση στοιχείου λίστας. */
export interface SortableListMove extends SortableNeighbors {
  readonly id: string;
}

/** Μετακίνηση κόμβου δέντρου: νέος γονέας + θέση ανάμεσα στα νέα αδέλφια. */
export interface TreeMove extends SortableNeighbors {
  readonly id: string;
  readonly parentId: string | null;
}

/**
 * Οι γείτονες του `activeId` αφού μετακινηθεί στη θέση του `overId` (σημασιολογία `arrayMove`: παίρνει τη θέση
 * του στόχου). `null` όταν δεν αλλάζει τίποτα ή κάποιο id λείπει.
 */
export function listMoveOf(ids: readonly string[], activeId: string, overId: string): SortableListMove | null {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return null;
  const rest = ids.filter((id) => id !== activeId);
  const reordered = [...rest.slice(0, to), activeId, ...rest.slice(to)];
  const at = reordered.indexOf(activeId);
  return { id: activeId, beforeId: reordered[at - 1] ?? null, afterId: reordered[at + 1] ?? null };
}

/**
 * Η αντίστροφη πράξη, για σειρά που ζει **μέσα σε ένα έγγραφο** (επιλογές, γραμμές πίνακα — η σειρά του πίνακα,
 * όχι κλειδί σειράς): εφαρμόζει τη μετακίνηση και επιστρέφει νέο πίνακα. Άγνωστο id ⇒ ο πίνακας αμετάβλητος.
 */
export function reorderByMove<T>(items: readonly T[], idOf: (item: T) => string, move: SortableListMove): T[] {
  const moving = items.find((item) => idOf(item) === move.id);
  if (moving === undefined) return [...items];
  const rest = items.filter((item) => idOf(item) !== move.id);
  const afterBefore = move.beforeId === null ? 0 : rest.findIndex((item) => idOf(item) === move.beforeId) + 1;
  const at = move.beforeId === null && move.afterId !== null
    ? Math.max(0, rest.findIndex((item) => idOf(item) === move.afterId))
    : afterBefore;
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

// ── Δέντρο ───────────────────────────────────────────────────────────────────

export interface TreeNodeInput {
  readonly id: string;
  readonly parentId: string | null;
}

export interface FlatTreeNode {
  readonly id: string;
  readonly parentId: string | null;
  /** Βάθος (ρίζα = 0). */
  readonly depth: number;
  readonly hasChildren: boolean;
}

function childrenIndex(nodes: readonly TreeNodeInput[]): ReadonlyMap<string | null, readonly TreeNodeInput[]> {
  const known = new Set(nodes.map((node) => node.id));
  const index = new Map<string | null, TreeNodeInput[]>();
  for (const node of nodes) {
    // Ορφανός (γονέας εκτός λίστας) ⇒ ρίζα: ποτέ αόρατος κόμβος.
    const parent = node.parentId !== null && known.has(node.parentId) ? node.parentId : null;
    const siblings = index.get(parent) ?? [];
    siblings.push(node);
    index.set(parent, siblings);
  }
  return index;
}

/**
 * Προ-διατεταγμένη (DFS) επίπεδη μορφή — ό,τι ζωγραφίζεται, με τη σειρά που ζωγραφίζεται. Οι κόμβοι κάτω από
 * `collapsed` παραλείπονται (ο κλειστός κόμβος φαίνεται, τα παιδιά του όχι).
 */
export function flattenTree(nodes: readonly TreeNodeInput[], collapsed: ReadonlySet<string> = new Set()): FlatTreeNode[] {
  const index = childrenIndex(nodes);
  const out: FlatTreeNode[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    for (const node of index.get(parentId) ?? []) {
      const hasChildren = (index.get(node.id)?.length ?? 0) > 0;
      out.push({ id: node.id, parentId, depth, hasChildren });
      if (hasChildren && !collapsed.has(node.id)) visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** Τα αδέλφια ενός γονέα, με τη σειρά τους. */
export function siblingIdsOf(nodes: readonly TreeNodeInput[], parentId: string | null): string[] {
  return (childrenIndex(nodes).get(parentId) ?? []).map((node) => node.id);
}

/** Ο κόμβος και όλοι οι απόγονοί του (για να μην πέσει ποτέ κόμβος μέσα στο δικό του υποδέντρο). */
export function subtreeIdsOf(nodes: readonly TreeNodeInput[], rootId: string): ReadonlySet<string> {
  const index = childrenIndex(nodes);
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const child of index.get(current) ?? []) {
      out.add(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

function treeMoveAmong(siblings: readonly string[], id: string, parentId: string | null, at: number): TreeMove {
  const rest = siblings.filter((sibling) => sibling !== id);
  return { id, parentId, beforeId: rest[at - 1] ?? null, afterId: rest[at] ?? null };
}

export type TreeKeyboardMove = 'up' | 'down' | 'indent' | 'outdent';

/**
 * Μετακίνηση με πληκτρολόγιο (WAI-ARIA tree + VS Code): Alt+↑/↓ ανάμεσα στα αδέλφια, Alt+→ γίνεται τελευταίο
 * παιδί του προηγούμενου αδελφού, Alt+← γίνεται το αμέσως επόμενο αδέλφι του γονέα του. `null` = δεν γίνεται.
 */
export function keyboardTreeMove(nodes: readonly TreeNodeInput[], id: string, move: TreeKeyboardMove): TreeMove | null {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) return null;
  const siblings = siblingIdsOf(nodes, node.parentId);
  const at = siblings.indexOf(id);
  switch (move) {
    case 'up':
      return at > 0 ? treeMoveAmong(siblings, id, node.parentId, at - 1) : null;
    case 'down':
      return at < siblings.length - 1 ? treeMoveAmong(siblings, id, node.parentId, at + 1) : null;
    case 'indent': {
      if (at <= 0) return null;
      const newParent = siblings[at - 1];
      const children = siblingIdsOf(nodes, newParent);
      return { id, parentId: newParent, beforeId: children[children.length - 1] ?? null, afterId: null };
    }
    case 'outdent': {
      if (node.parentId === null) return null;
      const parent = nodes.find((candidate) => candidate.id === node.parentId);
      const grandSiblings = siblingIdsOf(nodes, parent?.parentId ?? null);
      const parentAt = grandSiblings.indexOf(node.parentId);
      return { id, parentId: parent?.parentId ?? null, beforeId: node.parentId, afterId: grandSiblings[parentAt + 1] ?? null };
    }
  }
}

/**
 * Διευθέτηση πάνω στο **πλήρες** δέντρο: η πρόβλεψη βλέπει μόνο ό,τι ζωγραφίζεται, άρα ρίψη μέσα σε **κλειστό**
 * γονέα βγάζει «κανένας γείτονας» ενώ ο γονέας έχει (κρυμμένα) παιδιά — και το `keyBetween(null, null)` θα έδινε
 * κλειδί που συγκρούεται με αυτά. Τότε ο κόμβος μπαίνει **τελευταίο** παιδί (Finder/VS Code: «ρίψη σε φάκελο»).
 */
export function settleTreeMove(nodes: readonly TreeNodeInput[], move: TreeMove): TreeMove {
  if (move.beforeId !== null || move.afterId !== null) return move;
  const siblings = siblingIdsOf(nodes, move.parentId).filter((id) => id !== move.id);
  return siblings.length === 0 ? move : { ...move, beforeId: siblings[siblings.length - 1] };
}

/** Μετακίνηση στοιχείου μέσα σε επίπεδη λίστα (σημασιολογία `arrayMove`). */
function arrayMoved<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** Ο γονέας στο προβλεπόμενο βάθος: ο πλησιέστερος προηγούμενος κόμβος με βάθος `depth − 1`. */
function parentAtDepth(flat: readonly FlatTreeNode[], index: number, depth: number): string | null {
  if (depth === 0) return null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (flat[cursor].depth === depth - 1) return flat[cursor].id;
  }
  return null;
}

/**
 * Η πρόβλεψη του drag (το γνωστό μοτίβο δέντρου του dnd-kit): ο κόμβος παίρνει τη θέση του στόχου, και η
 * οριζόντια μετατόπιση του δείκτη ορίζει το βάθος — περιορισμένο ανάμεσα στο βάθος του επόμενου (δεν αφήνει
 * ορφανά) και στο βάθος του προηγούμενου + 1 (δεν πηδά επίπεδα). Οι απόγονοι του κόμβου ταξιδεύουν μαζί του,
 * γι' αυτό αφαιρούνται από το `flat` πριν την πρόβλεψη. `null` όταν η θέση δεν αλλάζει.
 */
export function projectTreeDrop(
  flat: readonly FlatTreeNode[],
  activeId: string,
  overId: string,
  offsetX: number,
  indentWidth: number,
): TreeMove | null {
  const from = flat.findIndex((node) => node.id === activeId);
  const to = flat.findIndex((node) => node.id === overId);
  if (from === -1 || to === -1) return null;
  const moved = arrayMoved(flat, from, to);
  const previous = moved[to - 1];
  const next = moved[to + 1];
  const wanted = flat[from].depth + Math.round(offsetX / indentWidth);
  const maxDepth = previous ? previous.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(maxDepth, wanted));
  const parentId = parentAtDepth(moved, to, depth);
  const before = [...moved.slice(0, to)].reverse().find((node) => node.depth <= depth);
  const after = moved.slice(to + 1).find((node) => node.depth <= depth);
  const move: TreeMove = {
    id: activeId,
    parentId,
    beforeId: before && before.depth === depth ? before.id : null,
    afterId: after && after.depth === depth ? after.id : null,
  };
  const original = flat[from];
  const unchanged = original.parentId === parentId && to === from;
  return unchanged ? null : move;
}
