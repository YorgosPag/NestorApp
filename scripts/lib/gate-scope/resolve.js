'use strict';
/**
 * **Η ΕΜΒΕΛΕΙΑ ΕΝΟΣ COMMIT** (ADR-924 §9): από τις αλλαγές του commit και το μητρώο εισόδων, ποιες πύλες
 * μπορούν να αλλάξουν ετυμηγορία. Καθαρή συνάρτηση, χωρίς git και δίσκο, ώστε να κρίνεται απομονωμένα.
 *
 * Fail-closed σε κάθε αμφιβολία: χωρίς αλλαγές, ή με έστω ΕΝΑ αρχείο εκτός κλάσεων ⇒ πλήρης εκτέλεση.
 *
 * @module scripts/lib/gate-scope/resolve
 */

const { PATH_CLASSES } = require('./registry');

/** @typedef {{ id: string, notice: string, count: number }} ClassCount */
/**
 * @typedef {object} GateScope
 * @property {boolean} scoped                     true ⇒ τρέχουν μόνο οι `readers` των κλάσεων
 * @property {(gateId: string) => boolean} applies
 * @property {ClassCount[]} classes               άδειο όταν `scoped === false`
 * @property {string[]} readers                   οι δηλωμένοι αναγνώστες (για τον έλεγχο ακεραιότητας)
 */

/** @type {GateScope} */
const FULL_SCOPE = Object.freeze({ scoped: false, applies: () => true, classes: [], readers: [] });

/**
 * @param {string[]} changedPaths ΟΛΕΣ οι αλλαγές του commit (και οι διαγραφές· οι μετονομασίες ως δύο διαδρομές)
 * @param {ReadonlyArray<import('./registry').PathClass>} [classes]
 * @returns {GateScope}
 */
function resolveGateScope(changedPaths, classes = PATH_CLASSES) {
  if (changedPaths.length === 0) return FULL_SCOPE;
  const counts = new Map();
  for (const file of changedPaths) {
    const owner = classes.find((cls) => cls.match(file));
    if (!owner) return FULL_SCOPE;
    counts.set(owner, (counts.get(owner) || 0) + 1);
  }
  const readers = [...new Set([...counts.keys()].flatMap((cls) => Object.keys(cls.readers)))];
  return {
    scoped: true,
    applies: (gateId) => readers.includes(gateId),
    classes: [...counts].map(([cls, count]) => ({ id: cls.id, notice: cls.notice, count })),
    readers,
  };
}

/**
 * Δηλωμένοι αναγνώστες που ο δρομολογητής ΔΕΝ γνωρίζει (λάθος id, πύλη που μετονομάστηκε). Ένας τέτοιος αναγνώστης
 * σημαίνει ότι η πύλη που ΕΠΡΕΠΕ να τρέξει παραλείπεται σιωπηλά, άρα ο καλών αρνείται.
 * @param {GateScope} scope
 * @param {Iterable<string>} knownGateIds
 * @returns {string[]}
 */
function unknownReaders(scope, knownGateIds) {
  const known = new Set(knownGateIds);
  return scope.readers.filter((id) => !known.has(id));
}

/**
 * Η γραμμή που τυπώνει ο hook: ρητή, ώστε η παράλειψη να μη μοιάζει με πράσινο.
 * @param {GateScope} scope
 * @returns {string}
 */
function describeSkip(scope) {
  const parts = scope.classes.map((c) => `${c.notice} (${c.count} ${c.count === 1 ? 'αρχείο' : 'αρχεία'})`);
  return `παραλείφθηκαν οι πύλες κώδικα: ${parts.join(' · ')}`;
}

module.exports = { describeSkip, resolveGateScope, unknownReaders };
