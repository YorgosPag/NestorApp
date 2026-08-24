/**
 * @jest-environment node
 *
 * 🔴 ADR-598 G2 — **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ: ασκεί το ΠΡΑΓΜΑΤΙΚΟ jspdf, χωρίς ΚΑΝΕΝΑ mock.**
 *
 * ## Γιατί υπάρχει
 * Στις 2026-08-25 έγινε αναβάθμιση `jspdf 3.0.4 → 4.2.1` (major, κλείνει 8 advisories — 2
 * critical). Οι **52 σουίτες / 656 tests / 10 snapshots** που αγγίζουν PDF ήταν πράσινες
 * **πριν και μετά** — και **δεν απεδείκνυαν τίποτα**: το `builder-pdf-exporter.test.ts`
 * κάνει `jest.mock('jspdf')` **ΚΑΙ** `jest.mock('jspdf-autotable')`, το
 * `pdf-assembler.test.ts` και το `detail-pdf-renderer.test.ts` κάνουν `jest.mock('jspdf')`.
 * ⇒ Ο παρονομαστής για «**δουλεύει η βιβλιοθήκη;**» ήταν **ΜΗΔΕΝ**.
 *
 * Ένα mock αποδεικνύει ότι *ο δικός μας κώδικας καλεί σωστά*· **ποτέ** ότι *η βιβλιοθήκη
 * απαντά*. Σε αναβάθμιση **major** το δεύτερο είναι ακριβώς το ερώτημα.
 *
 * ## 🔴 Το ζωντανό εύρημα που δικαιολογεί την ύπαρξή της
 * Το `jspdf-autotable@5.0.2` δήλωνε `peerDependencies: { jspdf: "^2 || ^3" }` — **αποκλείει
 * ρητά** την 4. Και επειδή το `.npmrc` έχει `strict-peer-dependencies=false`, το `pnpm install`
 * **πέρασε με απλή προειδοποίηση**. Καμία σουίτα δεν θα το έβλεπε (όλες mock-άρουν το
 * autoTable) ⇒ θα έσπαγε **στην παραγωγή**, στην πρώτη εξαγωγή πίνακα. Θεραπεία: `^5.0.8`,
 * που δηλώνει `"^2 || ^3 || ^4"`.
 *
 * ## ⚠️ Οι κλήσεις εδώ είναι ΑΚΡΙΒΩΣ οι μορφές του κώδικα παραγωγής
 * Η πρώτη γραφή αυτής της άγκυρας έγραφε `new jsPDF.GState(...)` και **έσκασε** — αλλά ήταν
 * λάθος **του test**, όχι breaking change: ο κώδικας παραγωγής γράφει `pdf.GState({...})`,
 * **μέθοδο στιγμιοτύπου**. Άγκυρα που επινοεί δική της μορφή κλήσης καταγγέλλει τη
 * βιβλιοθήκη για κάτι που κανείς δεν κάνει.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-598-production-readiness-quality-gates.md
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_REGULAR_BASE64 } from '@/services/gantt-export/roboto-font-data';

/** Ένα PNG 1×1 — η μόνη μορφή που περνά ο κώδικας παραγωγής στο `addImage` (μαζί με JPEG). */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Δέχεται το δηλωμένο peer range τη ΜΕΙΖΟΝΑ έκδοση `major`;
 *
 * ⚠️ **FAIL-CLOSED, ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟ semver.** Καταλαβαίνει **ακριβώς** τη μορφή που
 * χρησιμοποιεί το `jspdf-autotable` — διάζευξη caret ranges (`^2 || ^3 || ^4`) — και **ΠΕΤΑ**
 * σε οτιδήποτε άλλο. Ένας «ανεκτικός» parser θα απαντούσε `true` σε μορφή που δεν διάβασε,
 * δηλαδή θα ήταν πράσινος ακριβώς εκεί που δεν ξέρει τίποτα.
 *
 * ⚠️ **ΜΗΝ το αντικαταστήσεις με `require('semver')`**: το `semver` **δεν είναι δηλωμένη
 * εξάρτηση** (το `require.resolve` από τη ρίζα αποτυγχάνει) — λύνεται μόνο επειδή το κουβαλά
 * το ίδιο το jest, και η άδειά του είναι **ISC**, εκτός της λίστας του N.5.
 */
function peerAcceptsMajor(range: string, major: number): boolean {
  return range.split('||').map((token) => token.trim()).some((token) => {
    const caret = /^\^(\d+)(?:\.\d+){0,2}$/.exec(token);
    if (!caret) {
      throw new Error(
        `ΜΗ ΑΝΑΓΝΩΡΙΣΙΜΗ μορφή peer range: «${token}». Ο έλεγχος αρνείται να κρίνει ` +
          'κάτι που δεν διαβάζει — επέκτεινε τον parser, ΜΗΝ τον κάνεις ανεκτικό.',
      );
    }
    return Number(caret[1]) === major;
  });
}

const newDoc = (): jsPDF => new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

describe('jspdf — ΠΡΑΓΜΑΤΙΚΗ βιβλιοθήκη, μηδέν mocks (ADR-598 G2)', () => {
  it('ο πυρήνας σχεδίασης απαντά: κείμενο, στυλ, σχήματα, σελίδες', () => {
    const pdf = newDoc();
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(17, 17, 17);
    pdf.text('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ', 20, 20);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(20, 25, 190, 25);
    pdf.rect(20, 30, 50, 10);
    pdf.roundedRect(80, 30, 50, 10, 2, 2);
    pdf.circle(150, 35, 5);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.addPage();
    expect(pdf.getNumberOfPages()).toBe(2);
    pdf.setPage(1);
  });

  it('η ΜΕΤΡΗΣΗ κειμένου δίνει αριθμούς, όχι NaN — από αυτήν εξαρτώνται όλες οι διατάξεις', () => {
    const pdf = newDoc();
    pdf.setFontSize(12);
    const width = pdf.getTextWidth('ΠΕΡΙΓΡΑΦΗ');
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
    const lines = pdf.splitTextToSize('ένα αρκετά μακρύ κείμενο που πρέπει να σπάσει', 40);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('`pdf.GState({...})` — ΜΕΘΟΔΟΣ ΣΤΙΓΜΙΟΤΥΠΟΥ, η μορφή του κώδικα παραγωγής', () => {
    const pdf = newDoc();
    expect(() => {
      pdf.setGState(pdf.GState({ opacity: 0.5 }));
      pdf.setGState(pdf.GState({ opacity: 1 }));
    }).not.toThrow();
  });

  it('🔴 ΕΛΛΗΝΙΚΑ: addFileToVFS + addFont(Identity-H) — η διαδρομή του greek-font-loader', () => {
    // Χωρίς Identity-H τα ελληνικά βγαίνουν αλαμπουρνέζικα· είναι η μοναδική διαδρομή που
    // κάνει την εφαρμογή να τυπώνει ελληνικά PDF, και ήταν η επιφάνεια που ονομάζει το LFI CVE.
    const pdf = newDoc();
    pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
    pdf.setFont('Roboto', 'normal');
    pdf.text('Ελληνικά: ΑΒΓΔΕΖΗΘ αβγδεζηθ', 20, 60);
    expect(pdf.getFontList()).toHaveProperty('Roboto');
  });

  it('addImage PNG', () => {
    const pdf = newDoc();
    expect(() => pdf.addImage(PNG_1X1, 'PNG', 20, 70, 10, 10)).not.toThrow();
  });

  it('🔴 autoTable ΖΩΓΡΑΦΙΖΕΙ — το peer του 5.0.2 απέκλειε ρητά το jspdf 4', () => {
    const pdf = newDoc();
    autoTable(pdf, {
      startY: 90,
      head: [['Κωδικός', 'Περιγραφή', 'Ποσότητα']],
      body: [
        ['A-001', 'Σκυρόδεμα C20/25', '12,50'],
        ['A-002', 'Χάλυβας B500C', '840,00'],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    // ⚠️ Ο ΜΟΝΟΣ τρόπος να ξεχωρίσεις «έτρεξε» από «ζωγράφισε»: το Y ΠΡΟΧΩΡΗΣΕ.
    // Μια κλήση που δεν πετά αλλά δεν σχεδιάζει θα άφηνε το finalY αμετάβλητο.
    const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    expect(typeof finalY).toBe('number');
    expect(finalY as number).toBeGreaterThan(90);
  });

  it('η ΕΞΟΔΟΣ είναι έγκυρο PDF — κεφαλίδα, μέγεθος, τερματισμός', () => {
    const pdf = newDoc();
    pdf.text('ΠΕΡΙΓΡΑΦΗ', 20, 20);
    autoTable(pdf, { startY: 30, head: [['A']], body: [['1']] });
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    expect(bytes.length).toBeGreaterThan(2000);
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(Buffer.from(bytes.slice(-1024)).toString('latin1')).toContain('%%EOF');
  });

  it('🔴 το peer ΣΥΜΒΟΛΑΙΟ του autoTable δέχεται την ΕΓΚΑΤΕΣΤΗΜΕΝΗ jspdf', () => {
    // 🔑 Η άγκυρα που θα είχε πιάσει το πρόβλημα ΠΡΙΝ φτάσει στην οθόνη. Το `pnpm install` το
    // ανέφερε ως **απλή προειδοποίηση** επειδή το `.npmrc` έχει `strict-peer-dependencies=false`
    // — δηλαδή πέρασε αθόρυβα. ⚠️ Το `jspdf-autotable` ΔΕΝ εξάγει το `package.json` του
    // (`ERR_PACKAGE_PATH_NOT_EXPORTED`), οπότε διαβάζεται από τον φάκελο του entry point.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodePath = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const entry = require.resolve('jspdf-autotable');
    let dir = nodePath.dirname(entry);
    let manifest: string | null = null;
    for (let up = 0; up < 5 && manifest === null; up += 1) {
      const candidate = nodePath.join(dir, 'package.json');
      if (fs.existsSync(candidate)) manifest = candidate;
      else dir = nodePath.dirname(dir);
    }
    expect(manifest).not.toBeNull();

    const pkg = JSON.parse(fs.readFileSync(manifest as string, 'utf8')) as {
      name: string;
      peerDependencies?: Record<string, string>;
    };
    expect(pkg.name).toBe('jspdf-autotable');
    const range = pkg.peerDependencies?.jspdf;
    expect(typeof range).toBe('string');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const installed = (require('jspdf/package.json') as { version: string }).version;
    const major = Number(installed.split('.')[0]);
    expect(Number.isInteger(major)).toBe(true);
    // Αν αυτό κοκκινίσει: ΜΗΝ χαλαρώσεις τον έλεγχο — ανέβασε το jspdf-autotable σε έκδοση
    // που δηλώνει την major του jspdf (το 5.0.8 δηλώνει «^2 || ^3 || ^4»).
    expect(peerAcceptsMajor(range as string, major)).toBe(true);
  });
});
