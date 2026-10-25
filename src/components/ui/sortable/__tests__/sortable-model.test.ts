import {
  flattenTree,
  keyboardTreeMove,
  listMoveOf,
  reorderByMove,
  projectTreeDrop,
  settleTreeMove,
  subtreeIdsOf,
  type TreeMove,
  type TreeNodeInput,
} from '../sortable-model';

// a
// ├─ a1
// │  └─ a1x
// └─ a2
// b
const TREE: readonly TreeNodeInput[] = [
  { id: 'a', parentId: null },
  { id: 'a1', parentId: 'a' },
  { id: 'a1x', parentId: 'a1' },
  { id: 'a2', parentId: 'a' },
  { id: 'b', parentId: null },
];

describe('λίστα — η μετακίνηση είναι «ανάμεσα σε γείτονες»', () => {
  it('προς τα κάτω: παίρνει τη θέση του στόχου', () => {
    expect(listMoveOf(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual({ id: 'a', beforeId: 'c', afterId: 'd' });
  });

  it('προς τα πάνω, στην αρχή: κανείς πριν', () => {
    expect(listMoveOf(['a', 'b', 'c'], 'c', 'a')).toEqual({ id: 'c', beforeId: null, afterId: 'a' });
  });

  it('ίδια θέση ή άγνωστο id ⇒ καμία μετακίνηση', () => {
    expect(listMoveOf(['a', 'b'], 'a', 'a')).toBeNull();
    expect(listMoveOf(['a', 'b'], 'x', 'a')).toBeNull();
  });

  it('reorderByMove: η αντίστροφη πράξη — πάει-έλα με το listMoveOf', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const self = (id: string) => id;
    for (const active of ids) {
      for (const over of ids) {
        const move = listMoveOf(ids, active, over);
        if (!move) continue;
        const reordered = reorderByMove(ids, self, move);
        const at = reordered.indexOf(active);
        expect(reordered[at - 1] ?? null).toBe(move.beforeId);
        expect(reordered[at + 1] ?? null).toBe(move.afterId);
      }
    }
  });
});

describe('δέντρο — επίπεδη μορφή', () => {
  it('DFS με βάθος και σημαία παιδιών', () => {
    expect(flattenTree(TREE).map((node) => `${node.id}:${node.depth}${node.hasChildren ? '+' : ''}`)).toEqual([
      'a:0+', 'a1:1+', 'a1x:2', 'a2:1', 'b:0',
    ]);
  });

  it('κλειστός κόμβος: φαίνεται, τα παιδιά του όχι', () => {
    expect(flattenTree(TREE, new Set(['a1'])).map((node) => node.id)).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('ορφανός (γονέας εκτός λίστας) γίνεται ρίζα — ποτέ αόρατος', () => {
    expect(flattenTree([{ id: 'o', parentId: 'gone' }]).map((node) => node.depth)).toEqual([0]);
  });

  it('το υποδέντρο περιλαμβάνει όλους τους απογόνους', () => {
    expect([...subtreeIdsOf(TREE, 'a')].sort()).toEqual(['a', 'a1', 'a1x', 'a2']);
  });
});

describe('δέντρο — πληκτρολόγιο (Alt+βέλη)', () => {
  it('πάνω/κάτω ανάμεσα στα αδέλφια', () => {
    expect(keyboardTreeMove(TREE, 'a2', 'up')).toEqual({ id: 'a2', parentId: 'a', beforeId: null, afterId: 'a1' });
    expect(keyboardTreeMove(TREE, 'a', 'down')).toEqual({ id: 'a', parentId: null, beforeId: 'b', afterId: null });
    expect(keyboardTreeMove(TREE, 'a1', 'up')).toBeNull();
  });

  it('εσοχή: τελευταίο παιδί του προηγούμενου αδελφού', () => {
    expect(keyboardTreeMove(TREE, 'a2', 'indent')).toEqual({ id: 'a2', parentId: 'a1', beforeId: 'a1x', afterId: null });
    expect(keyboardTreeMove(TREE, 'a1', 'indent')).toBeNull();
  });

  it('προεξοχή: αμέσως μετά τον γονέα του', () => {
    expect(keyboardTreeMove(TREE, 'a1x', 'outdent')).toEqual({ id: 'a1x', parentId: 'a', beforeId: 'a1', afterId: 'a2' });
    expect(keyboardTreeMove(TREE, 'b', 'outdent')).toBeNull();
  });
});

describe('δέντρο — πρόβλεψη drag', () => {
  const INDENT = 24;

  it('ρίψη πάνω στο b χωρίς οριζόντια κίνηση: ρίζα μετά το b', () => {
    const flat = flattenTree(TREE, new Set(['a']));
    expect(projectTreeDrop(flat, 'a', 'b', 0, INDENT)).toEqual({ id: 'a', parentId: null, beforeId: 'b', afterId: null });
  });

  it('δεξιά μετατόπιση μιας εσοχής: γίνεται παιδί του προηγούμενου', () => {
    const flat = flattenTree(TREE);
    expect(projectTreeDrop(flat, 'b', 'b', INDENT, INDENT)).toEqual({ id: 'b', parentId: 'a', beforeId: 'a2', afterId: null });
  });

  it('ρίψη σε ΚΛΕΙΣΤΟ γονέα: η πρόβλεψη δεν βλέπει γείτονες — η διευθέτηση τον βάζει τελευταίο παιδί', () => {
    const flat = flattenTree(TREE, new Set(['a']));
    const projected = projectTreeDrop(flat, 'b', 'b', INDENT, INDENT);
    expect(projected).toEqual({ id: 'b', parentId: 'a', beforeId: null, afterId: null });
    expect(settleTreeMove(TREE, projected as TreeMove)).toEqual({ id: 'b', parentId: 'a', beforeId: 'a2', afterId: null });
  });

  it('δεν πηδά επίπεδα: το βάθος φράζεται από τον προηγούμενο + 1', () => {
    const flat = flattenTree(TREE, new Set(['b']));
    const move = projectTreeDrop(flat, 'b', 'b', INDENT * 9, INDENT);
    expect(move?.parentId).toBe('a2');
  });

  it('ίδια θέση, ίδιο βάθος ⇒ καμία μετακίνηση', () => {
    const flat = flattenTree(TREE, new Set(['b']));
    expect(projectTreeDrop(flat, 'b', 'b', 0, INDENT)).toBeNull();
  });
});
