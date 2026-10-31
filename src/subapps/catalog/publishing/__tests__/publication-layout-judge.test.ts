/**
 * ADR-923 §5.6.1 — ο κριτής διάταξης, χωρίς PDF. Ο μάρτυρας με πραγματικό Typst ζει στο `typst-real.test.ts`.
 */
import { judgePublicationLayout, PUBLICATION_MIN_TEXT_PT, type JudgedPage, type JudgedTextRun } from '../publication-layout-judge';

const run = (text: string, x: number, y: number, width: number, size = 8): JudgedTextRun => ({ text, transform: [size, 0, 0, size, x, y], width });
/** Περιστροφή 90°: ο άξονας του κειμένου δείχνει προς τα πάνω. */
const upright = (text: string, x: number, y: number, width: number, size = 8): JudgedTextRun => ({ text, transform: [0, size, -size, 0, x, y], width });
const page = (runs: readonly JudgedTextRun[]): JudgedPage => ({ widthPt: 200, heightPt: 300, runs });
const judge = (runs: readonly JudgedTextRun[], bleedPt = 0) => judgePublicationLayout([page(runs)], bleedPt);

describe('επικάλυψη', () => {
  it('δύο κείμενα στην ίδια γραμμή που πατούν το ένα το άλλο', () => {
    const verdict = judge([run('1058x596x250', 50, 100, 60), run('999', 80, 100, 20)]);
    expect(verdict.overlappingTextCount).toBe(1);
    expect(verdict.samples).toEqual(['1: «1058x596x250» × «999»']);
  });

  it('🔑 διαδοχικά κομμάτια της ίδιας γραμμής δεν είναι επικάλυψη, ακόμη κι αν αγγίζονται', () => {
    expect(judge([run('Ηλεκτρο', 50, 100, 30), run('μηχανολογικός', 80.3, 100, 40)]).overlappingTextCount).toBe(0);
  });

  it('🔑 διαδοχικές γραμμές με στενό διάστιχο δεν είναι επικάλυψη: μετράει η ζώνη των γραμμάτων', () => {
    expect(judge([run('πρώτη γραμμή', 50, 100, 60), run('δεύτερη γραμμή', 50, 92, 60)]).overlappingTextCount).toBe(0);
  });

  it('🔴 περιστραμμένο κείμενο κρίνεται στον πραγματικό του άξονα', () => {
    expect(judge([upright('Ψύξη', 56, 80, 50), run('τιμή', 40, 100, 40)]).overlappingTextCount).toBe(1);
    expect(judge([upright('Ψύξη', 56, 80, 50), run('τιμή', 70, 100, 40)]).overlappingTextCount).toBe(0);
  });

  it('τα δείγματα κόβονται, ο μετρητής όχι', () => {
    const runs = Array.from({ length: 16 }, (_, index) => run(`τ${index}`, 50 + index, 100, 30));
    const verdict = judge(runs);
    expect(verdict.overlappingTextCount).toBeGreaterThan(5);
    expect(verdict.samples).toHaveLength(5);
  });
});

describe('χαρτί', () => {
  it('κείμενο έξω από τη σελίδα', () => {
    expect(judge([run('έξω', 180, 100, 40)]).clippedTextCount).toBe(1);
    expect(judge([run('μέσα', 150, 100, 40)]).clippedTextCount).toBe(0);
  });

  it('🔑 στην εκτύπωση το κομμένο χαρτί είναι μικρότερο από τη σελίδα', () => {
    expect(judge([run('στη ζώνη κοπής', 3, 100, 40)], 0).clippedTextCount).toBe(0);
    expect(judge([run('στη ζώνη κοπής', 3, 100, 40)], 8.5).clippedTextCount).toBe(1);
  });
});

describe('μέγεθος', () => {
  it('το όριο είναι κλειστό από κάτω', () => {
    expect(judge([run('οριακό', 50, 100, 30, PUBLICATION_MIN_TEXT_PT)]).undersizedTextCount).toBe(0);
    expect(judge([run('μικρό', 50, 100, 30, PUBLICATION_MIN_TEXT_PT - 0.1)]).undersizedTextCount).toBe(1);
  });
});

it('🔑 το πλήθος κομματιών είναι μέρος της απάντησης: κενό αρχείο δεν είναι καθαρό αρχείο', () => {
  expect(judgePublicationLayout([page([])], 0)).toMatchObject({ pagesExamined: 1, runsExamined: 0 });
});
