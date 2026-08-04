/**
 * ADR-751 — **πού κάθεται ο σύνδεσμος μέσα στο κελί.**
 *
 * Το `text-link-segments.test.ts` κλειδώνει *ποιοι χαρακτήρες* είναι διεύθυνση. Εδώ
 * κλειδώνεται το δεύτερο μισό — *σε ποιο mm* — και ειδικά η μία απόφαση που είναι εύκολο
 * να χαλάσει σιωπηλά: **μετριούνται προθέματα, όχι τμήματα**.
 *
 * Ο μετρητής των tests είναι επίτηδες **μη αθροιστικός** (μιμείται kerning): έτσι μια
 * μελλοντική «απλοποίηση» σε `measure(τμήμα)` δεν περνά — δίνει άλλο νούμερο.
 *
 * @see bim/table/table-cell-link-spans.ts
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { resolveCellLinkSpans, type CellLinkSpansInput } from '../table-cell-link-spans';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';

// ── Μετρητές ────────────────────────────────────────────────────────────────

/** 1mm ανά χαρακτήρα — καθαροί αριθμοί, καμία γραμματοσειρά. */
const flat = (s: string): number => s.length;

/**
 * 🔴 Ο μετρητής που **σπάει την αθροιστικότητα**: κάθε ζεύγος `' 2'` κερδίζει 0,3mm, όπως
 * κάνει ένα πραγματικό ζεύγος kerning. Άρα:
 *
 * ```
 *   kerned('Τηλ: ') + kerned('2310788493')  =  5 + 10   = 15
 *   kerned('Τηλ: 2310788493')                            = 14,7
 * ```
 *
 * Ένας τοποθετητής που μετρά τμήματα χωριστά θα βγάλει υπογράμμιση που ξεπερνά τα γράμματα.
 */
const kerned = (s: string): number => s.length - (s.match(/ 2/g)?.length ?? 0) * 0.3;

/**
 * 🔴 ADR-753 Φ2 — ο τοποθετητής δέχεται πλέον **πλάτη προθεμάτων**, όχι μετρητή: με
 * μορφοποίηση ανά χαρακτήρα δεν υπάρχει ένας μετρητής για ολόκληρο το κείμενο.
 *
 * Τα tests κρατούν τον ίδιο τρόπο σκέψης — δίνουν `measure` — και ο βοηθός το μεταφράζει σε
 * προθέματα **του ορατού κειμένου**. Έτσι ο μη αθροιστικός `kerned` εξακολουθεί να είναι ο
 * φύλακας που ήταν: μια «απλοποίηση» σε άθροισμα τμημάτων δίνει ακόμη άλλο νούμερο.
 */
const baseInput = (
  over: Partial<Omit<CellLinkSpansInput, 'prefixWidthMm'>> & {
    readonly measure?: (s: string) => number;
  } = {},
): CellLinkSpansInput => {
  const { measure = flat, ...rest } = over;
  const visibleText = rest.visibleText ?? 'Τηλ: 2310788493';
  return {
    fullText: 'Τηλ: 2310788493',
    clipped: false,
    numeric: false,
    hAlign: 'left',
    ...rest,
    visibleText,
    prefixWidthMm: (index) => measure(visibleText.slice(0, index)),
  };
};

// ── Οι δοκιμασίες ───────────────────────────────────────────────────────────

describe('τοποθέτηση — προθέματα, όχι τμήματα', () => {
  it('η υπογράμμιση τελειώνει ΑΚΡΙΒΩΣ εκεί που τελειώνουν τα γράμματα, με kerning', () => {
    const [span] = resolveCellLinkSpans(baseInput({ measure: kerned }));
    const total = kerned('Τηλ: 2310788493');

    expect(span.offsetMm).toBeCloseTo(kerned('Τηλ: '), 10);
    // Το δεξί άκρο = το τέλος του κειμένου. Με αθροιστική μέτρηση θα ήταν 15 — 0,3mm έξω.
    expect(span.offsetMm + span.advanceMm).toBeCloseTo(total, 10);
    expect(span.advanceMm).not.toBeCloseTo(kerned('2310788493'), 10);
  });

  it('με απλό μετρητή τα νούμερα είναι τα προφανή', () => {
    expect(resolveCellLinkSpans(baseInput())).toEqual([
      {
        text: '2310788493',
        kind: 'phone',
        href: 'tel:2310788493',
        offsetMm: 5,
        advanceMm: 10,
      },
    ]);
  });

  it('κελί που είναι ΟΛΟ σύνδεσμος: ένα τμήμα, από την αρχή, σε όλο το πλάτος', () => {
    const spans = resolveCellLinkSpans(
      baseInput({ fullText: 'info@a.gr', visibleText: 'info@a.gr' }),
    );
    expect(spans).toEqual([
      { text: 'info@a.gr', kind: 'email', href: 'mailto:info@a.gr', offsetMm: 0, advanceMm: 9 },
    ]);
  });

  it('πολλαπλά τμήματα δεν επικαλύπτονται και μένουν στη σειρά', () => {
    const text = 'info@a.gr και 6949727121';
    const spans = resolveCellLinkSpans(baseInput({ fullText: text, visibleText: text }));
    expect(spans).toHaveLength(2);
    expect(spans[0].offsetMm + spans[0].advanceMm).toBeLessThanOrEqual(spans[1].offsetMm);
    expect(spans[1].offsetMm + spans[1].advanceMm).toBeCloseTo(flat(text), 10);
  });
});

describe('στοίχιση — ίδια σύμβαση με την υπογράμμιση του run', () => {
  const at = (hAlign: CellLinkSpansInput['hAlign']) =>
    resolveCellLinkSpans(baseInput({ hAlign }))[0];

  it('αριστερά: το κείμενο ξεκινά στην άγκυρα', () => {
    expect(at('left').offsetMm).toBe(5);
  });

  it('κέντρο: η άγκυρα είναι στο μέσο του κειμένου', () => {
    expect(at('center').offsetMm).toBe(5 - 15 / 2);
  });

  it('δεξιά: το κείμενο τελειώνει στην άγκυρα', () => {
    const span = at('right');
    expect(span.offsetMm).toBe(5 - 15);
    expect(span.offsetMm + span.advanceMm).toBe(0);
  });
});

describe('ο φραγμός των ψευδών τηλεφώνων', () => {
  it('αριθμητικό κελί: δεκαψήφιος αριθμός ΔΕΝ γίνεται τηλέφωνο', () => {
    const input = baseInput({ fullText: '2000000000', visibleText: '2000000000', numeric: true });
    expect(resolveCellLinkSpans(input)).toEqual([]);
  });

  it('το ίδιο κείμενο ως κείμενο ΕΙΝΑΙ τηλέφωνο — το κριτήριο είναι η τιμή, όχι οι χαρακτήρες', () => {
    const input = baseInput({ fullText: '2000000000', visibleText: '2000000000', numeric: false });
    expect(resolveCellLinkSpans(input)).toHaveLength(1);
  });

  it('ο φραγμός δεν αγγίζει e-mail και ιστοσελίδες σε αριθμητικό κελί', () => {
    const input = baseInput({ fullText: 'info@a.gr', visibleText: 'info@a.gr', numeric: true });
    expect(resolveCellLinkSpans(input)).toHaveLength(1);
  });
});

describe('περικομμένο κελί — ο κανόνας «όλο ή τίποτα»', () => {
  it('κελί που είναι ΟΛΟ σύνδεσμος επιβιώνει, με το ΠΛΗΡΕΣ href', () => {
    const spans = resolveCellLinkSpans(
      baseInput({
        fullText: 'georgios.pagonis@gmail.com',
        visibleText: 'georgios.pag…',
        clipped: true,
      }),
    );
    expect(spans).toEqual([
      {
        text: 'georgios.pag…',
        kind: 'email',
        href: 'mailto:georgios.pagonis@gmail.com',
        offsetMm: 0,
        advanceMm: flat('georgios.pag…'),
      },
    ]);
  });

  it('🔴 μικτό κείμενο που κόπηκε ΔΕΝ δίνει σύνδεσμο — ένα μισό URL ανοίγει λάθος σελίδα', () => {
    const spans = resolveCellLinkSpans(
      baseInput({
        fullText: 'δες www.nestorconstruct.gr/έργα εδώ',
        visibleText: 'δες www.nestorconstruct.gr/έρ…',
        clipped: true,
      }),
    );
    expect(spans).toEqual([]);
  });

  it('δύο σύνδεσμοι σε κομμένο κελί: κανένας — δεν ξέρουμε ποιος επέζησε', () => {
    const spans = resolveCellLinkSpans(
      baseInput({
        fullText: 'info@a.gr 6949727121',
        visibleText: 'info@a.gr 69…',
        clipped: true,
      }),
    );
    expect(spans).toEqual([]);
  });
});

describe('τίποτα να βρεθεί', () => {
  it.each(['ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ', 'Ο.Τ. Γ 753', '', '1:200'])('κανένα τμήμα για %p', (text) => {
    expect(resolveCellLinkSpans(baseInput({ fullText: text, visibleText: text }))).toEqual([]);
  });
});

// ── Ολοκλήρωση: φτάνει στο TableCellLayout, με τον ΠΡΑΓΜΑΤΙΚΟ μετρητή ───────

describe('η διάταξη κουβαλά τα τμήματα — καμία ένεση', () => {
  const style: TableStyle = BUILTIN_TABLE_STYLES.find(
    (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
  )!;
  const column: TableColumn = {
    id: 'c1',
    sizing: { kind: 'fixed', widthMm: 90 },
    valueType: 'text',
    align: 'left',
  };
  const row: TableRow = { id: 'r1', rowClass: 'data' };

  const runFor = (cell: TableCell) =>
    layoutTable(
      createTableModel({ columns: [column], rows: [row], cells: [['r1', 'c1', cell]] }),
      style,
    ).cells[0]?.text;

  it('το κελί της οθόνης του Giorgio φτάνει με τμήμα-σύνδεσμο', () => {
    const run = runFor({ kind: 'text', value: 'georgios.pagonis@gmail.com' });
    expect(run?.links).toHaveLength(1);
    expect(run?.links?.[0]).toMatchObject({
      kind: 'email',
      href: 'mailto:georgios.pagonis@gmail.com',
      offsetMm: 0,
    });
    // Το πλάτος βγαίνει από τον πραγματικό μετρητή — θετικό, χωρίς καρφωμένη τιμή.
    expect(run?.links?.[0].advanceMm).toBeGreaterThan(0);
  });

  it('κελί χωρίς διεύθυνση ΔΕΝ αποκτά το πεδίο καθόλου (σχήμα αμετάβλητο)', () => {
    const run = runFor({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ' });
    expect(run).toBeDefined();
    expect(run && 'links' in run).toBe(false);
  });

  it('αριθμητικό κελί με δεκαψήφια τιμή δεν αποκτά τηλέφωνο', () => {
    const run = runFor({ kind: 'text', value: 2000000000 });
    expect(run && 'links' in run).toBe(false);
  });
});
