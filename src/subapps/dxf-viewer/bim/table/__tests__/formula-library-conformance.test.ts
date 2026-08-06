/**
 * ADR-739 §49 — **conformance**: οι συναρτήσεις της βιβλιοθήκης δουλεύουν μέσα από την
 * **πλήρη** μηχανή — `writeCellInput` → ανάλυση → δέσιμο σε ταυτότητες → αξιολόγηση →
 * επαναϋπολογισμός → τιμή κελιού.
 *
 * ## Γιατί όχι απευθείας κλήση της βιβλιοθήκης
 * Μια δοκιμή που καλεί `formulajs.VLOOKUP(...)` επιβεβαιώνει ότι **η βιβλιοθήκη** δουλεύει —
 * πράγμα που το κάνει ήδη η δική της σουίτα. Εδώ ελέγχεται ό,τι είναι **δικό μας** και μπορεί
 * να σπάσει: η γέφυρα ορισμάτων, το σχήμα του εύρους, η ανάγνωση ελληνικού δεκαδικού, η
 * χαρτογράφηση σφαλμάτων, ο σειριακός αριθμός ημερομηνίας και η προτεραιότητα του μητρώου.
 * Ό,τι γράφεται εδώ είναι **αυτό που θα δει ο μηχανικός στο κελί**.
 */

import { cellKey, createTableModel, toPersistedTableModel } from '../table-model-helpers';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import { commitCellWrites, writeCellInput } from '../formula/table-formula-engine';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

/**
 * Ένας μικρός πίνακας ποσοτήτων:
 * ```
 *        A (περιγραφή)   B (ποσότητα)  C (τιμή)  D (υλικό)
 *   1    Δοκός Δ1        10            5         σκυρόδεμα
 *   2    Δοκός Δ2        20            2,5  ⟵ ελληνικό δεκαδικό
 *   3    Πλάκα Π1        30            4         χάλυβας
 *   4    (κενά)
 * ```
 * Το `2,5` της `C2` είναι εκεί επίτηδες: είναι ο **μόνος** τρόπος να αποδειχθεί ότι η
 * ανάγνωση δεκαδικού του ADR-576 φτάνει μέχρι μέσα στη βιβλιοθήκη.
 */
const CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', { kind: 'text', value: 'Δοκός Δ1' }],
  ['r2', 'c1', { kind: 'text', value: 'Δοκός Δ2' }],
  ['r3', 'c1', { kind: 'text', value: 'Πλάκα Π1' }],
  ['r1', 'c2', { kind: 'text', value: '10' }],
  ['r2', 'c2', { kind: 'text', value: '20' }],
  ['r3', 'c2', { kind: 'text', value: '30' }],
  ['r1', 'c3', { kind: 'text', value: '5' }],
  ['r2', 'c3', { kind: 'text', value: '2,5' }],
  ['r3', 'c3', { kind: 'text', value: '4' }],
  ['r1', 'c4', { kind: 'text', value: 'σκυρόδεμα' }],
  ['r2', 'c4', { kind: 'text', value: 'σκυρόδεμα' }],
  ['r3', 'c4', { kind: 'text', value: 'χάλυβας' }],
];

const BASE: PersistedTableModel = toPersistedTableModel(
  createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS }),
);

/** **Ακριβώς** η ζωντανή αλυσίδα: γράψε στο `D5`, ξαναϋπολόγισε, διάβασε την τιμή. */
function result(text: string): string | number | null {
  const written = commitCellWrites(writeCellInput(BASE, 'r5', 'c4', text));
  return written.cells.find(([r, c]) => r === 'r5' && c === 'c4')?.[2].value ?? null;
}

describe('🔑 η γέφυρα locale — το ελληνικό δεκαδικό φτάνει μέσα στη βιβλιοθήκη', () => {
  it('η SUMPRODUCT διαβάζει το «2,5» ως 2,5 και όχι ως 2', () => {
    // 10×5 + 20×2,5 + 30×4 = 220. Χωρίς την πύλη locale θα έδινε 210 — σιωπηλά.
    expect(result('=SUMPRODUCT(B1:B3,C1:C3)')).toBe(220);
  });

  it('η ίδια στήλη δίνει τον ίδιο αριθμό σε δική μας και σε ξένη συνάρτηση', () => {
    expect(result('=SUM(C1:C3)')).toBe(11.5);
    expect(result('=PRODUCT(C1:C3)')).toBe(50);
    expect(result('=MEDIAN(C1:C3)')).toBe(4);
  });

  it('το κείμενο ΔΕΝ γίνεται αριθμός — το «>15» μένει κριτήριο', () => {
    expect(result('=COUNTIF(B1:B3,">15")')).toBe(2);
    expect(result('=LEN(A1)')).toBe(8);
  });
});

describe('υπό συνθήκη άθροιση — ο πυρήνας της προμέτρησης', () => {
  it.each([
    ['=SUMIF(D1:D3,"σκυρόδεμα",B1:B3)', 30],
    ['=SUMIFS(B1:B3,D1:D3,"χάλυβας")', 30],
    ['=COUNTIF(D1:D3,"σκυρόδεμα")', 2],
    ['=COUNTIFS(D1:D3,"σκυρόδεμα",B1:B3,">15")', 1],
    ['=AVERAGEIF(D1:D3,"σκυρόδεμα",B1:B3)', 15],
    ['=MAXIFS(B1:B3,D1:D3,"σκυρόδεμα")', 20],
    ['=MINIFS(B1:B3,D1:D3,"σκυρόδεμα")', 10],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });
});

describe('αναζήτηση — χρειάζεται 2Δ σχήμα, αλλιώς #N/A', () => {
  it.each([
    ['=VLOOKUP("Πλάκα Π1",A1:B3,2,FALSE)', 30],
    ['=INDEX(A1:B3,2,2)', 20],
    ['=MATCH(20,B1:B3,0)', 2],
    ['=HLOOKUP(10,B1:B3,1,FALSE)', 10],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('🔴 η αστοχία αναζήτησης δίνει #N/A — όχι σιωπηλό κενό', () => {
    expect(result('=VLOOKUP("Δεν υπάρχει",A1:B3,2,FALSE)')).toBe('#N/A');
  });

  it('το #N/A ΔΙΑΔΙΔΕΤΑΙ σε άθροισμα αντί να αγνοηθεί', () => {
    // Αν το `#N/A` ήταν σκέτο κείμενο, η SUM θα το αγνοούσε και θα έδινε 10: μια αποτυχημένη
    // αναζήτηση θα εξαφανιζόταν μέσα σε σύνολο.
    expect(result('=SUM(10,VLOOKUP("Χ",A1:B3,2,FALSE))')).toBe('#N/A');
  });
});

/**
 * 🔑 ADR-761 — **γιατί τα δείγματα εδώ είναι ΜΕΙΚΤΑ, και είναι διδακτικό**
 *
 * Αυτή η σουίτα περνά από τον `writeCellInput`, δηλαδή από την **πλήρη** διαδρομή του
 * χρήστη — μαζί με την ανεκτική εφεδρεία. Γι' αυτό:
 *
 * - `=ROUNDUP(2.01,0)` δουλεύει **αυτούσιο**: το `2.01` δεν είναι αριθμός στη γραμματική
 *   του σχεδίου, άρα η κύρια ανάλυση αποτυγχάνει και η εφεδρεία το διαβάζει σωστά.
 * - `=MROUND(7;3)` έπρεπε να γίνει `;`, και **δεν είναι ελάττωμα**: το `=MROUND(7,3)`
 *   αναλύεται **επιτυχώς** στη γραμματική του σχεδίου ως `MROUND(7,3)` — ΕΝΑ όρισμα, ο
 *   αριθμός επτά κόμμα τρία. Η κύρια πέτυχε, άρα η εφεδρεία δεν τρέχει.
 *
 * Είναι η **μοναδική** περίπτωση όπου η εφεδρεία δεν σώζει, και συμπίπτει ακριβώς με τη
 * μοναδική αμφισημία της γλώσσας: κόμμα ανάμεσα σε δύο ψηφία. Σε ελληνικό έγγραφο η
 * ελληνική ανάγνωση είναι η **σωστή** — γι' αυτό δεν «διορθώνεται», τεκμηριώνεται.
 */
describe('μαθηματικά και τριγωνομετρία', () => {
  it.each([
    ['=ROUNDUP(2.01,0)', 3],
    ['=ROUNDDOWN(2.99,0)', 2],
    ['=CEILING(2.1,0.5)', 2.5],
    ['=FLOOR(2.9,0.5)', 2.5],
    ['=MROUND(7;3)', 6],
    ['=INT(-2.5)', -3],
    ['=TRUNC(-2.5)', -2],
    ['=MOD(7;3)', 1],
    ['=POWER(2;10)', 1024],
    ['=SQRT(144)', 12],
    ['=SIGN(-7)', -1],
    ['=GCD(12;18)', 6],
    ['=LCM(4;6)', 12],
    ['=PRODUCT(B1:B3)', 6000],
    ['=SUBTOTAL(9,B1:B3)', 60],
    ['=DEGREES(PI())', 180],
    ['=ROUND(SIN(RADIANS(30)),4)', 0.5],
    ['=ROUND(LN(EXP(3)),9)', 3],
    ['=LOG10(1000)', 3],
    ['=CONVERT(1,"m","cm")', 100],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('#NUM! για μη πεπερασμένο, όπως στο Excel', () => {
    expect(result('=SQRT(-1)')).toBe('#NUM!');
  });
});

describe('λογικές — και ο κανόνας διάδοσης του Excel', () => {
  it.each([
    ['=AND(TRUE(),TRUE())', 'TRUE'],
    ['=OR(FALSE(),TRUE())', 'TRUE'],
    ['=NOT(FALSE())', 'TRUE'],
    ['=XOR(TRUE(),FALSE())', 'TRUE'],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('🔑 η AND ΔΕΝ βραχυκυκλώνει — ίδιο με Excel', () => {
    // Αν βραχυκύκλωνε θα έδινε FALSE. Το Excel δίνει το σφάλμα, και εμείς το ίδιο.
    expect(result('=AND(FALSE(),1/0>1)')).toBe('#DIV/0!');
  });
});

describe('ειδικές μορφές — τεμπελιά κλάδου και διαφάνεια σφάλματος', () => {
  it.each([
    ['=IF(B1=10,"ναι","όχι")', 'ναι'],
    ['=IFS(B1>100,"μεγάλο",B1>5,"μεσαίο")', 'μεσαίο'],
    ['=CHOOSE(2,"α","β","γ")', 'β'],
    ['=SWITCH(B1,10,"δέκα",20,"είκοσι","άλλο")', 'δέκα'],
    ['=SWITCH(B3,10,"δέκα","άλλο")', 'άλλο'],
    ['=IFERROR(1/0,"ασφαλές")', 'ασφαλές'],
    ['=IFNA(VLOOKUP("Χ",A1:B3,2,FALSE),0)', 0],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('🔑 ο φύλακας διαίρεσης δουλεύει — ο κλάδος που δεν ισχύει ΔΕΝ αξιολογείται', () => {
    expect(result('=IF(D4=0,0,1/D4)')).toBe(0);
  });

  it('η IFS χωρίς αντιστοιχία δίνει #N/A, όχι κενό', () => {
    expect(result('=IFS(B1>100,"μεγάλο",B1>50,"μεσαίο")')).toBe('#N/A');
  });

  it('η IFNA ΔΕΝ πιάνει άλλο σφάλμα πέρα από το #N/A', () => {
    expect(result('=IFNA(1/0,"δεν πιάνεται")')).toBe('#DIV/0!');
  });
});

describe('πληροφοριακές — δικές μας, γιατί η βιβλιοθήκη δεν βλέπει τα σφάλματά μας', () => {
  it.each([
    ['=ISNUMBER(B1)', 'TRUE'],
    ['=ISTEXT(A1)', 'TRUE'],
    ['=ISTEXT(B1)', 'FALSE'],
    ['=ISBLANK(D4)', 'TRUE'],
    ['=ISNUMBER(A1)', 'FALSE'],
    ['=TYPE(A1)', 2],
    ['=N(B1)', 10],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('🔴 η ISERROR ΒΛΕΠΕΙ το σφάλμα αντί να της διαδοθεί', () => {
    expect(result('=ISERROR(1/0)')).toBe('TRUE');
    expect(result('=ISERROR(B1)')).toBe('FALSE');
    expect(result('=ISERR(VLOOKUP("Χ",A1:B3,2,FALSE))')).toBe('FALSE');
    expect(result('=ISNA(VLOOKUP("Χ",A1:B3,2,FALSE))')).toBe('TRUE');
    expect(result('=ERROR.TYPE(1/0)')).toBe(2);
    expect(result('=TYPE(1/0)')).toBe(16);
  });

  it('η NA() γράφει #N/A στο κελί', () => {
    expect(result('=NA()')).toBe('#N/A');
  });
});

describe('κείμενο', () => {
  it.each([
    ['=CONCAT(A1," / ",A3)', 'Δοκός Δ1 / Πλάκα Π1'],
    ['=CONCATENATE(A1,"!")', 'Δοκός Δ1!'],
    ['=TEXTJOIN("+",TRUE(),A1,A2)', 'Δοκός Δ1+Δοκός Δ2'],
    ['=LEFT(A1,5)', 'Δοκός'],
    ['=RIGHT(A1,2)', 'Δ1'],
    ['=MID(A1,7,2)', 'Δ1'],
    ['=UPPER("δοκός")', 'ΔΟΚΌΣ'],
    ['=TRIM("  α  β  ")', 'α β'],
    ['=SUBSTITUTE(A1,"Δοκός","Υποστύλωμα")', 'Υποστύλωμα Δ1'],
    ['=FIND("Δ1",A1)', 7],
    ['=REPT("-",3)', '---'],
    ['=EXACT(A1,A1)', 'TRUE'],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });
});

describe('στατιστικά, με τα ΠΑΛΑΙΑ ονόματα που πληκτρολογεί ο μηχανικός', () => {
  it.each([
    ['=MEDIAN(B1:B3)', 20],
    ['=LARGE(B1:B3,1)', 30],
    ['=SMALL(B1:B3,1)', 10],
    ['=COUNTA(A1:A3)', 3],
    ['=COUNTBLANK(A4:A5)', 2],
    ['=ROUND(STDEV(B1:B3),6)', 10],
    ['=VAR(B1:B3)', 100],
    ['=ROUND(STDEV.S(B1:B3),6)', 10],
    ['=PERCENTILE(B1:B3,0.5)', 20],
    ['=QUARTILE(B1:B3,2)', 20],
    ['=RANK(30,B1:B3)', 1],
    ['=RANK.EQ(30,B1:B3)', 1],
    ['=MODE(10,10,20)', 10],
    ['=ROUND(GEOMEAN(B1:B3),4)', 18.1712],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });
});

describe('🔑 ημερομηνίες ως σειριακοί αριθμοί Excel — πιο σωστά από τη βιβλιοθήκη', () => {
  it('η DATE δίνει τον σειριακό του Excel, όχι αντικείμενο', () => {
    expect(result('=DATE(2026,8,5)')).toBe(46239);
  });

  it.each([
    ['=YEAR(DATE(2026,8,5))', 2026],
    ['=MONTH(DATE(2026,8,5))', 8],
    ['=DAY(DATE(2026,8,5))', 5],
    ['=DAYS(DATE(2026,8,5),DATE(2026,8,1))', 4],
    ['=DATE(2026,8,5)-DATE(2026,8,1)', 4],
    ['=EOMONTH(DATE(2026,1,15),0)', 46053],
    ['=DATEDIF(DATE(2026,1,1),DATE(2026,8,5),"d")', 216],
  ])('«%s» = %s', (text, expected) => {
    expect(result(text)).toBe(expected);
  });

  it('🔑 η αφαίρεση ημερομηνιών δίνει ΜΕΡΕΣ — αυτό που δεν πετυχαίνει η βιβλιοθήκη μόνη της', () => {
    // Χωρίς τη μετατροπή σε σειριακό, δύο `Date` θα αφαιρούνταν ως χιλιοστά (345.600.000).
    expect(result('=DATE(2026,8,5)-DATE(2026,7,5)')).toBe(31);
  });
});

describe('🔴 οι απορριφθείσες: ο χρήστης παίρνει #NAME?, όχι λάθος αριθμό', () => {
  it.each(['=TODAY()', '=NOW()', '=RAND()', '=RANDBETWEEN(1,9)', '=SORT(B1:B3)', '=ROW()'])(
    '«%s» → #NAME?',
    (text) => {
      expect(result(text)).toBe('#NAME?');
    },
  );

  it('η αποθηκευμένη τιμή είναι κωδικός του Excel — ταξιδεύει σε DXF και σε πρόχειρο', () => {
    // Ένας επινοημένος κωδικός (`#VOLATILE!`) θα φαινόταν ως ξένη λέξη σε AutoCAD/Excel.
    expect(result('=TODAY()')).toBe('#NAME?');
  });
});

describe('προτεραιότητα μητρώου — οι δικές μας ΔΕΝ σκεπάζονται', () => {
  it('🔴 η SUM με ρητό κείμενο δίνει #VALUE! (δικό μας), όχι 0 (βιβλιοθήκης)', () => {
    expect(result('=SUM("άλφα")')).toBe('#VALUE!');
  });

  it('η AVERAGE χωρίς αριθμούς δίνει #DIV/0! (δικό μας)', () => {
    expect(result('=AVERAGE(A1:A3)')).toBe('#DIV/0!');
  });

  it('το κείμενο μέσα σε εύρος αγνοείται, όπως στο AutoCAD', () => {
    expect(result('=SUM(A1:B3)')).toBe(60);
  });
});
