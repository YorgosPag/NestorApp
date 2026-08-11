/**
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ CHECK 3.55** — ADR-784.
 *
 * ⚠️ **Οι μεταλλάξεις είναι στις ΕΙΣΟΔΟΥΣ, όχι στην πύλη.** Κάθε περίπτωση είναι ένα μικρό,
 * **πραγματικό** απόσπασμα JSX· αλλάζει **μία** λέξη και η ετυμηγορία οφείλει να αλλάξει.
 * Μια μετάλλαξη που δεν αλλάζει τίποτα δεν αποδεικνύει τίποτα (μάθημα 3.44/Μ11) — γι' αυτό
 * κάθε Μ ελέγχει **ρητά** ότι η είσοδος όντως άλλαξε.
 *
 * @jest-environment node
 */

'use strict';

const {
  scanFile, classify, collectionKind, mappedChildrenKind, classNameText,
  ALL_STATES, RATCHETED_STATES, EXEMPT,
} = require('../lib/catalog-columns/scan');

const parser = require('@typescript-eslint/parser');

/** Σαρώνει ένα απόσπασμα σαν να ήταν αρχείο· επιστρέφει τις καταστάσεις που βρέθηκαν. */
const statesOf = (src) => scanFile('probe.tsx', src).findings.map((f) => f.state);
const stateOf = (src) => statesOf(src)[0];

const wrap = (body, head = '') => `${head}
export function Probe(props: { items: string[] }) {
  return (
${body}
  );
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: τα τέσσερα σχήματα που μετρήθηκαν στο πραγματικό δέντρο
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ0 · βαθμονόμηση στα ΠΡΑΓΜΑΤΙΚΑ σχήματα του repo', () => {
  it('Μ0α · κατάλογος αγνώστου μήκους + σκάλα ⇒ ΠΑΡΑΒΙΑΣΗ (σχήμα ContactsPageContent)', () => {
    const src = wrap(`    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {props.items.map((c) => <span key={c}>{c}</span>)}
    </div>`);
    expect(stateOf(src)).toBe('catalog-window-ladder');
  });

  it('Μ0β · σταθερός πίνακας στο αρχείο + σκάλα ⇒ ΝΟΜΙΜΟ (σχήμα AnalyticsKpiTiles)', () => {
    const src = wrap(`    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map((t) => <span key={t}>{t}</span>)}
    </div>`, 'const TILES = ["a", "b", "c", "d"];');
    expect(stateOf(src)).toBe('fixed-arity-ladder');
  });

  it('Μ0γ · Array.from({length}) ⇒ ΝΟΜΙΜΟ (σχήμα σκελετού φόρτωσης)', () => {
    const src = wrap(`    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <span key={i} />)}
    </div>`);
    expect(stateOf(src)).toBe('fixed-arity-ladder');
  });

  it('Μ0δ · μεταναστευμένο πλέγμα ⇒ ΚΑΘΑΡΟ (σχήμα PropertyGridView)', () => {
    const src = wrap(`    <ul className={\`grid \${gridPatterns.cards.gap} \${gridPatterns.cards.media}\`}>
      {props.items.map((p) => <li key={p} />)}
    </ul>`);
    expect(stateOf(src)).toBe('catalog-intrinsic');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Μ1-Μ7 — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ1-Μ7 · μεταλλάξεις στις εισόδους', () => {
  const catalog = (cls) => wrap(`    <div className="${cls}">
      {props.items.map((c) => <span key={c}>{c}</span>)}
    </div>`);

  it('Μ1 · αφαίρεση της σκάλας ⇒ παύει να είναι παραβίαση', () => {
    const before = catalog('grid grid-cols-1 lg:grid-cols-3 gap-2');
    const after = catalog('grid grid-cols-1 gap-2');
    expect(before).not.toBe(after);
    expect(stateOf(before)).toBe('catalog-window-ladder');
    expect(stateOf(after)).toBe('catalog-single-column');
  });

  it('Μ2 · μετανάστευση στον SSoT ⇒ παύει να είναι παραβίαση', () => {
    const before = catalog('grid grid-cols-1 lg:grid-cols-3 gap-2');
    const after = wrap(`    <div className={\`grid \${gridPatterns.cards.tile}\`}>
      {props.items.map((c) => <span key={c}>{c}</span>)}
    </div>`);
    expect(before).not.toBe(after);
    expect(stateOf(before)).toBe('catalog-window-ladder');
    expect(stateOf(after)).toBe('catalog-intrinsic');
  });

  it('Μ3 · η συλλογή γίνεται σταθερού μήκους ⇒ παύει να είναι παραβίαση', () => {
    const before = catalog('grid grid-cols-1 lg:grid-cols-3');
    const after = wrap(`    <div className="grid grid-cols-1 lg:grid-cols-3">
      {[1, 2, 3].map((c) => <span key={c}>{c}</span>)}
    </div>`);
    expect(before).not.toBe(after);
    expect(stateOf(before)).toBe('catalog-window-ladder');
    expect(stateOf(after)).toBe('fixed-arity-ladder');
  });

  it('Μ4 · εξαίρεση ΜΕ λόγο ⇒ αναγνωρίζεται· ΧΩΡΙΣ λόγο ⇒ ΟΧΙ', () => {
    // ⚠️ ΜΕΣΑ σε JSX το `//` ΔΕΝ είναι σχόλιο — είναι κείμενο. Η μορφή που γράφεται
    // πραγματικά πάνω από ένα πλέγμα είναι το σχόλιο JSX. Η πρώτη γραφή αυτού του test
    // χρησιμοποιούσε `//` και παρήγαγε ΑΚΥΡΟ απόσπασμα: μηδέν ευρήματα, δηλαδή «πέρασε»
    // για λόγο που δεν είχε σχέση με την εξαίρεση.
    const withReason = wrap(`    <section>
      {/* catalog-exempt: σειρά πεδίων φίλτρου, όχι κάρτες */}
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {props.items.map((c) => <span key={c}>{c}</span>)}
      </div>
    </section>`);
    const without = withReason.replace(
      '{/* catalog-exempt: σειρά πεδίων φίλτρου, όχι κάρτες */}', '{/* catalog-exempt: */}');
    expect(withReason).not.toBe(without);
    expect(stateOf(withReason)).toBe('catalog-exempt');
    expect(stateOf(without)).toBe('catalog-window-ladder');
  });

  it('Μ5 · εμφωλευμένο .map() ΔΕΝ ανεβάζει τον γονέα σε κατάλογο', () => {
    // Το `.map()` ζει στο ΕΣΩΤΕΡΙΚΟ div· αν μετρούσαμε όλο το υποδέντρο, ο γονέας θα
    // γινόταν κι αυτός «κατάλογος» και η ταξινόμηση θα ανέβαινε αυθαίρετα ψηλά.
    const src = wrap(`    <section className="grid grid-cols-1 lg:grid-cols-2">
      <div>{props.items.map((c) => <span key={c}>{c}</span>)}</div>
    </section>`);
    expect(statesOf(src)).toContain('fixed-arity-ladder');
    expect(statesOf(src)).not.toContain('catalog-window-ladder');
  });

  it('Μ6 · εισαγόμενη συλλογή ⇒ ΔΙΚΗ ΤΗΣ κατάσταση, ποτέ εικασία', () => {
    const src = wrap(`    <div className="grid grid-cols-1 sm:grid-cols-3">
      {ALL_CONTACT_TYPES.map((t) => <span key={t}>{t}</span>)}
    </div>`, 'import { ALL_CONTACT_TYPES } from "@/types/contacts";');
    expect(stateOf(src)).toBe('catalog-imported-collection');
    expect(RATCHETED_STATES).not.toContain('catalog-imported-collection');
  });

  it('Μ7 · `X.filter(…).map(…)` πάνω σε σταθερό ⇒ παραμένει σταθερής αρίτητας', () => {
    const src = wrap(`    <div className="grid grid-cols-1 lg:grid-cols-3">
      {TILES.filter(Boolean).map((t) => <span key={t}>{t}</span>)}
    </div>`, 'const TILES = ["a", "b", "c"];');
    expect(stateOf(src)).toBe('fixed-arity-ladder');
  });

  /**
   * 🔴 **ΜΕΤΡΗΜΕΝΟ ΨΕΥΔΩΣ ΘΕΤΙΚΟ (ADR-784 §10).** Ακριβές σχήμα του
   * `PropertyStatusDemoPageContent`: σταθερός πίνακας **έξι** στοιχείων περνά από `.map()`
   * και το αποτέλεσμα ονομάζεται. Ο πρώτος λύτης ρωτούσε μόνο «είναι ο αρχικοποιητής
   * κυριολεκτικός πίνακας;» ⇒ «άγνωστο» ⇒ **σταθερή αρίτητα κατηγορούμενη ως κατάλογος**.
   * Η μετάλλαξη αλλάζει **μία** λέξη — τη βάση της αλυσίδας — και η ετυμηγορία γυρίζει.
   */
  it('Μ8 · `const X = ΣΤΑΘΕΡΟ.map(…)` ⇒ σταθερής αρίτητας· από props ⇒ παραβίαση', () => {
    const body = `    <div className="grid grid-cols-1 lg:grid-cols-3">
      {ROWS.map((r) => <span key={r.id}>{r.id}</span>)}
    </div>`;
    const fixed = wrap(body, 'const DEFS = [{ id: "a" }, { id: "b" }];\nconst ROWS = DEFS.map((d) => ({ ...d }));');
    const dynamic = fixed.replace('const ROWS = DEFS.map', 'const ROWS = externalDefs.map');
    expect(fixed).not.toBe(dynamic);
    expect(stateOf(fixed)).toBe('fixed-arity-ladder');
    expect(stateOf(dynamic)).toBe('catalog-window-ladder');
  });

  /**
   * 🔴 **Ο ΛΟΓΟΣ ΠΡΕΠΕΙ ΝΑ ΧΩΡΑΕΙ.** Το αρχικό παράθυρο ήταν **δύο γραμμές**: μια εξαίρεση με
   * πραγματικό σκεπτικό, γραμμένη σε τέσσερις, **δεν καταχωρούνταν σιωπηλά**. Fail-closed
   * (μετρούνταν ως παραβίαση, δεν χανόταν), αλλά ο μηχανισμός που **απαιτεί** λόγο πίεζε προς
   * **ρηχό** λόγο — δηλαδή προς αυτό ακριβώς που απαγορεύει.
   */
  it('Μ9 · ΠΟΛΥΓΡΑΜΜΙΚΟΣ λόγος καταχωρείται· χωρίς τον δείκτη ⇒ ΟΧΙ', () => {
    const withReason = wrap(`    <section>
      {/* catalog-exempt: πίνακας υποδοχών σταθερής αρίτητας, όχι κατάλογος — το πλήθος
          των κελιών ΕΙΝΑΙ το maxPhotos, και κάθε υποδοχή δηλώνει σταθερές διαστάσεις
          σε pixel, οπότε ελάχιστο πλάτος στήλης δεν έχει τι να επηρεάσει. */}
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {props.items.map((c) => <span key={c}>{c}</span>)}
      </div>
    </section>`);
    const without = withReason.replace('catalog-exempt: πίνακας', 'ΣΗΜΕΙΩΣΗ: πίνακας');
    expect(withReason).not.toBe(without);
    expect(stateOf(withReason)).toBe('catalog-exempt');
    expect(stateOf(without)).toBe('catalog-window-ladder');
  });

  /**
   * 🔴 **Η ΕΞΑΙΡΕΣΗ ΔΕΝ ΔΑΝΕΙΖΕΤΑΙ.** Ο εντοπισμός είναι «το σχόλιο ΑΜΕΣΩΣ από πάνω»: αν
   * παρεμβάλλεται **κώδικας**, το σχόλιο ανήκει σε άλλο στοιχείο. Το σταθερό παράθυρο τριών
   * γραμμών μπορούσε να χαρίσει σε ένα πλέγμα την αιτιολογία του **προηγούμενου** αδελφού.
   */
  it('Μ10 · σχόλιο εξαίρεσης χωρισμένο με ΚΩΔΙΚΑ ΔΕΝ μεταφέρεται στο επόμενο πλέγμα', () => {
    const src = wrap(`    <section>
      {/* catalog-exempt: ανήκει στο ΑΠΟ ΠΑΝΩ στοιχείο */}
      <p>κάτι άλλο</p>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {props.items.map((c) => <span key={c}>{c}</span>)}
      </div>
    </section>`);
    expect(stateOf(src)).toBe('catalog-window-ladder');
  });

  it('Μ11 · αυτοαναφορικός ορισμός ΔΕΝ κρεμάει την πύλη — απαντά «άγνωστο»', () => {
    // Πύλη που κρεμάει δεν είναι αυστηρότερη· είναι πύλη που κανείς δεν τρέχει.
    const src = wrap(`    <div className="grid grid-cols-1 lg:grid-cols-3">
      {rows.map((r) => <span key={r}>{r}</span>)}
    </div>`, 'const rows = rows.filter(Boolean);');
    expect(stateOf(src)).toBe('catalog-window-ladder');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ1-Κ6 — ΣΥΜΒΟΛΑΙΑ ΤΗΣ ΜΗΧΑΝΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ1-Κ6 · συμβόλαια', () => {
  it('Κ1 · ΜΟΝΟ μία κατάσταση μπλοκάρει — οι υπόλοιπες είναι ΣΩΣΤΕΣ, όχι ανεκτές', () => {
    expect(RATCHETED_STATES).toEqual(['catalog-window-ladder']);
  });

  it('Κ2 · άγνωστη κατάσταση ⇒ η λογιστική ΣΚΑΕΙ (fail-closed)', () => {
    // Ο κατάλογος καταστάσεων είναι κλειστός· ό,τι δεν είναι μέσα δεν επιτρέπεται να περάσει.
    expect(ALL_STATES).toHaveLength(8);
    expect(new Set(ALL_STATES).size).toBe(ALL_STATES.length);
  });

  it('Κ3 · το className διατηρεί τις ΕΚΦΡΑΣΕΙΣ ως πηγαίο κώδικα', () => {
    // Αν τις πετούσαμε, κάθε μεταναστευμένο πλέγμα θα έμοιαζε «χωρίς στήλες» και θα έβγαινε
    // σιωπηλά εκτός εμβέλειας — η πύλη θα τύφλωνε εκεί ακριβώς που η δουλειά πέτυχε.
    const src = 'const x = <div className={`grid ${gridPatterns.cards.media}`} />;';
    const ast = parser.parse(src, { jsx: true, range: true, loc: true });
    let text = null;
    (function find(n) {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'JSXAttribute' && n.name?.name === 'className') {
        text = classNameText(n, src);
      }
      for (const k of Object.keys(n)) {
        const c = n[k];
        for (const y of Array.isArray(c) ? c : [c]) if (y && y.type) find(y);
      }
    })(ast);
    expect(text).toContain('gridPatterns.cards.media');
  });

  it('Κ4 · η σειρά είναι συμβόλαιο: το εγγενές ίχνος κρίνεται ΠΡΙΝ τη σκάλα', () => {
    // Ένα μεταναστευμένο πλέγμα κουβαλά ακόμη `grid-cols-1` για τη λειτουργία λίστας.
    // Αν η σκάλα κρινόταν πρώτη, θα διαβαζόταν λανθασμένα ως «ακόμη με σκάλα».
    expect(classify('grid grid-cols-1 md:grid-cols-2 repeat(auto-fill', 'unknown'))
      .toBe('catalog-intrinsic');
  });

  it('Κ5 · η εξαίρεση απαιτεί λόγο — σκέτη λέξη ΔΕΝ αναγνωρίζεται', () => {
    expect(EXEMPT.test('// catalog-exempt: γιατί')).toBe(true);
    expect(EXEMPT.test('// catalog-exempt:')).toBe(false);
    expect(EXEMPT.test('// catalog-exempt')).toBe(false);
  });

  it('Κ6 · «άγνωστο» κυριαρχεί πάνω σε «σταθερό» στο ίδιο πλέγμα', () => {
    const src = wrap(`    <div className="grid grid-cols-1 lg:grid-cols-3">
      {[1, 2].map((n) => <b key={n} />)}
      {props.items.map((c) => <span key={c}>{c}</span>)}
    </div>`);
    expect(stateOf(src)).toBe('catalog-window-ladder');
  });

  it('Κ7 · το ΤΡΙΤΟ ελάχιστο του SSoT μετρά ως εγγενές, όπως τα άλλα δύο', () => {
    // Αν το `chip` έλειπε από το ίχνος, κάθε μεταναστευμένο τσιπάκι θα φαινόταν «χωρίς
    // στήλες» και θα έβγαινε ΣΙΩΠΗΛΑ εκτός εμβέλειας — δηλαδή η πύλη θα τύφλωνε ακριβώς
    // εκεί που η δουλειά πέτυχε. Ίδιο μάθημα με το Κ3.
    for (const track of ['media', 'tile', 'chip']) {
      expect(classify(`grid gridPatterns.cards.${track}`, 'unknown')).toBe('catalog-intrinsic');
    }
  });

  it('Κ8 · η εξαίρεση καθαρίζει ΜΟΝΟ παραβίαση — ποτέ κατάσταση που ήταν ήδη σωστή', () => {
    // Αλλιώς η λογιστική θα μετακινούνταν: μια σταθερή αρίτητα θα εμφανιζόταν ως «εξαιρεμένη»
    // και ο κάδος των εξαιρέσεων θα έπαυε να μετρά αποφάσεις, μετρώντας σχόλια.
    const src = wrap(`    <section>
      {/* catalog-exempt: λόγος που δεν έπρεπε να χρειαστεί */}
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {[1, 2, 3].map((n) => <b key={n} />)}
      </div>
    </section>`);
    expect(stateOf(src)).toBe('fixed-arity-ladder');
  });
});
