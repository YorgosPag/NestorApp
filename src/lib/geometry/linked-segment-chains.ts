/**
 * Τμήματα → **πολυγραμμές** από μια ρητή τοπολογία ενώσεων (ADR-929 §6.21.9, Ε2).
 *
 * 🔑 **Γιατί.** Στο SVG (και στο Canvas 2D) η ένωση γωνίας (`stroke-linejoin`) υπάρχει **μόνο** ανάμεσα σε διαδοχικές
 * γραμμές της **ίδιας** υποδιαδρομής· δύο χωριστά τμήματα που ακουμπούν παίρνουν δύο απολήξεις, και η γωνία ή μένει
 * ανοιχτή (`butt`) ή προεξέχει κατά μισό πάχος (`round`/`square`). Μια γωνία ζωγραφίζεται σωστά μόνο ως **μία**
 * πολυγραμμή — και μια κλειστή αλυσίδα ως κλειστή υποδιαδρομή, ώστε να ενωθεί και η τελευταία γωνία.
 * 🔑 **Η τοπολογία δίνεται, δεν μαντεύεται.** Ο μηχανισμός δεν κρίνει ποιο άκρο ακουμπά ποιο: τις ενώσεις τις δίνει
 * όποιος τις ξέρει (π.χ. οι κόμβοι της σύντηξης ADR-929 §6.21.8). Για γεωμετρία χωρίς τέτοια γνώση υπάρχει το
 * `coincidentEndLinks` — **ακριβής** ταύτιση άκρων, καμία ανοχή.
 * ⚠️ Κάθε άκρο δέχεται **μία** ένωση (βαθμός ≤ 2 ⇒ κάθε αλυσίδα είναι διαδρομή ή κύκλος). Όσες περισσεύουν σε ένα άκρο
 * αγνοούνται ντετερμινιστικά (κρατιέται η πρώτη κατά σειρά εισόδου): το άκρο τους ζωγραφίζεται ως απόληξη.
 * ⚠️ Αυτό ΔΕΝ είναι το `SegmentChaining.chainSegments` του DXF: εκείνο φτιάχνει **μία** αλυσίδα και κολλά άκρα με ανοχή
 * (για το JOIN οντοτήτων)· εδώ βγαίνουν **όλες** οι αλυσίδες και τίποτα δεν κολλά χωρίς ρητή ένωση.
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store. Ντετερμινιστικό: ίδια είσοδος ⇒ ίδια έξοδος.
 */

export type SegmentEnd = 'start' | 'end';

export interface ChainableSegment<P> {
  readonly start: P;
  readonly end: P;
}

/** Ένα άκρο ενός τμήματος, με τη θέση του τμήματος στον πίνακα εισόδου. */
export interface SegmentEndRef {
  readonly index: number;
  readonly end: SegmentEnd;
}

/** Τα δύο άκρα ενώνονται σε κορυφή πολυγραμμής (το σημείο της κορυφής = το άκρο `a`). */
export interface SegmentEndLink {
  readonly a: SegmentEndRef;
  readonly b: SegmentEndRef;
}

export interface SegmentChain<P> {
  readonly points: readonly P[];
  /** Κύκλος ⇒ η πολυγραμμή κλείνει (`Z`), και η γωνία πρώτου/τελευταίου ενώνεται κι αυτή. */
  readonly closed: boolean;
  /** Οι θέσεις των τμημάτων της αλυσίδας στον πίνακα εισόδου, με τη σειρά διάσχισης. */
  readonly segmentIndices: readonly number[];
}

const other = (end: SegmentEnd): SegmentEnd => (end === 'start' ? 'end' : 'start');
const keyOf = (index: number, end: SegmentEnd): string => `${index}:${end}`;

/** Ο πίνακας «άκρο → άκρο-ταίρι», με μία ένωση ανά άκρο (η πρώτη κατά σειρά εισόδου κερδίζει). */
function partnerMap(count: number, links: readonly SegmentEndLink[]): Map<string, SegmentEndRef> {
  const partner = new Map<string, SegmentEndRef>();
  const valid = (r: SegmentEndRef): boolean => Number.isInteger(r.index) && r.index >= 0 && r.index < count;
  for (const { a, b } of links) {
    if (!valid(a) || !valid(b) || a.index === b.index) continue;
    const ka = keyOf(a.index, a.end);
    const kb = keyOf(b.index, b.end);
    if (partner.has(ka) || partner.has(kb)) continue;
    partner.set(ka, b);
    partner.set(kb, a);
  }
  return partner;
}

/** Διασχίζει από το άκρο `entry` του τμήματος `first` προς τα έξω· σταματά σε ελεύθερο άκρο ή όταν ξαναβρεί το `first`. */
function walk<P>(
  segments: readonly ChainableSegment<P>[],
  partner: ReadonlyMap<string, SegmentEndRef>,
  used: boolean[],
  first: number,
  entry: SegmentEnd,
): SegmentChain<P> {
  const points: P[] = [segments[first][entry]];
  const indices: number[] = [];
  let index = first;
  let enter = entry;
  for (;;) {
    used[index] = true;
    indices.push(index);
    const exit = other(enter);
    const next = partner.get(keyOf(index, exit));
    if (next === undefined) {
      points.push(segments[index][exit]);
      return { points, closed: false, segmentIndices: indices };
    }
    if (next.index === first) return { points, closed: true, segmentIndices: indices };
    points.push(segments[index][exit]);
    index = next.index;
    enter = next.end;
  }
}

/**
 * Όλες οι αλυσίδες: πρώτα οι ανοιχτές (από κάθε ελεύθερο άκρο, κατά σειρά εισόδου), μετά οι κύκλοι. Κάθε τμήμα σε
 * **ακριβώς μία** αλυσίδα· τμήμα χωρίς ενώσεις = αλυσίδα δύο σημείων.
 */
export function chainLinkedSegments<P>(
  segments: readonly ChainableSegment<P>[],
  links: readonly SegmentEndLink[],
): SegmentChain<P>[] {
  const partner = partnerMap(segments.length, links);
  const used = new Array<boolean>(segments.length).fill(false);
  const chains: SegmentChain<P>[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    const freeEnd = (['start', 'end'] as const).find((e) => !partner.has(keyOf(i, e)));
    if (freeEnd !== undefined) chains.push(walk(segments, partner, used, i, freeEnd));
  }
  for (let i = 0; i < segments.length; i++) {
    if (!used[i]) chains.push(walk(segments, partner, used, i, 'start'));
  }
  return chains;
}

/**
 * Ενώσεις από **ακριβώς** κοινά άκρα (ίδιο `x` και `y`, καμία ανοχή). Ενώνονται μόνο κόμβοι βαθμού 2: εκεί όπου τρία ή
 * περισσότερα άκρα συμπίπτουν (διακλάδωση) δεν υπάρχει μία σωστή συνέχεια, και κάθε άκρο μένει απόληξη.
 */
export function coincidentEndLinks<P extends { readonly x: number; readonly y: number }>(
  segments: readonly ChainableSegment<P>[],
): SegmentEndLink[] {
  const atPoint = new Map<string, SegmentEndRef[]>();
  segments.forEach((s, index) => {
    for (const end of ['start', 'end'] as const) {
      const p = s[end];
      const key = `${p.x},${p.y}`;
      const refs = atPoint.get(key);
      if (refs === undefined) atPoint.set(key, [{ index, end }]);
      else refs.push({ index, end });
    }
  });
  const links: SegmentEndLink[] = [];
  for (const refs of atPoint.values()) {
    if (refs.length === 2 && refs[0].index !== refs[1].index) links.push({ a: refs[0], b: refs[1] });
  }
  return links;
}
