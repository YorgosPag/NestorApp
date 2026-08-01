/**
 * @fileoverview Ομαδοποίηση σε πινακίδες — ADR-745 §2.3 Παγίδα Δ.
 *
 * Ο έλεγχος δεν σταματά στο «βγήκαν δύο ομάδες». Ένα σπασμένο κατώφλι μπορεί να δίνει δύο
 * ομάδες για λάθος λόγο, οπότε ελέγχεται και **ο ίδιος ο βαθμονομητής**: το κατώφλι πρέπει
 * να πέφτει μέσα στο ΜΕΤΡΗΜΕΝΟ παράθυρο ασφαλείας του πραγματικού αρχείου.
 */

import {
  groupIntoTitleBlocks,
  proximityThreshold,
  type PositionedCell,
} from '../title-block-grouping';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

/**
 * Μετρημένα στο `G753_ergasia F.dxf`:
 *   · μέγιστη ακμή που χρειάζεται η **αριστερή** πινακίδα για να ενωθεί: 13,552
 *   · μικρότερη απόσταση **ανάμεσα** στις δύο πινακίδες: 36,487
 * Κάθε κατώφλι μέσα σε αυτό το διάστημα δίνει τη σωστή απάντηση· κανένα εκτός δεν τη δίνει.
 */
const MEASURED_INTRA_BLOCK_SPAN = 13.552;
const MEASURED_INTER_BLOCK_GAP = 36.487;

describe('ομαδοποίηση σε πινακίδες — πραγματικό G753', () => {
  it('🔴 βγάζει ΔΥΟ πινακίδες: 17 κελιά αριστερά, 2 δεξιά', () => {
    const groups = groupIntoTitleBlocks(G753_TITLEBLOCK_ROWS);
    expect(groups.map((g) => g.length)).toEqual([17, 2]);
  });

  it('🔴 το δεξί πλαίσιο έχει το ΔΙΚΟ του ΕΡΓΟΔΟΤΗΣ — δεν είναι τιμή του αριστερού', () => {
    const [left, right] = groupIntoTitleBlocks(G753_TITLEBLOCK_ROWS);
    expect(right.every((cell) => cell.x > 408060)).toBe(true);
    expect(left.every((cell) => cell.x < 408060)).toBe(true);
    expect(right.some((cell) => cell.raw.includes('ΕΡΓΟΔΟΤΗΣ'))).toBe(true);
    expect(left.some((cell) => cell.raw.includes('ΕΡΓΟΔΟΤΗΣ'))).toBe(true);
  });

  it('🔴 το κατώφλι πέφτει μέσα στο μετρημένο παράθυρο (13,55 – 36,49)', () => {
    // Αυτός ο ισχυρισμός είναι που πιάνει αλλαγή συντελεστή: το πλήθος ομάδων παραμένει 2
    // για ένα ολόκληρο εύρος τιμών, αλλά η βαθμονόμηση παύει να έχει περιθώριο.
    const threshold = proximityThreshold(G753_TITLEBLOCK_ROWS);
    expect(threshold).toBeGreaterThan(MEASURED_INTRA_BLOCK_SPAN);
    expect(threshold).toBeLessThan(MEASURED_INTER_BLOCK_GAP);
  });

  it('🔴 το κατώφλι ΔΕΝ είναι σταθερά — κλιμακώνεται με το σχέδιο', () => {
    // Το ίδιο σχέδιο σε χιλιοστά αντί για μέτρα. Ένα καρφωμένο «408060» ή ένα καρφωμένο
    // «20 μονάδες» δίνει εδώ μία ομάδα ή δεκαεννέα — ποτέ δύο.
    const scaled = G753_TITLEBLOCK_ROWS.map((r) => ({
      ...r,
      x: r.x * 1000,
      y: r.y * 1000,
      height: r.height * 1000,
    }));
    expect(groupIntoTitleBlocks(scaled).map((g) => g.length)).toEqual([17, 2]);
    expect(proximityThreshold(scaled)).toBeCloseTo(
      proximityThreshold(G753_TITLEBLOCK_ROWS) * 1000,
      3,
    );
  });
});

describe('ομαδοποίηση — οριακές περιπτώσεις', () => {
  const cell = (x: number, y: number, height = 1): PositionedCell => ({ x, y, height });

  it('κενή είσοδος δίνει καμία πινακίδα, όχι μία κενή', () => {
    expect(groupIntoTitleBlocks([])).toEqual([]);
  });

  it('ένα κελί δίνει μία πινακίδα', () => {
    expect(groupIntoTitleBlocks([cell(0, 0)])).toEqual([[cell(0, 0)]]);
  });

  it('η γειτνίαση είναι ΜΕΤΑΒΑΤΙΚΗ — αλυσίδα κελιών μένει μία πινακίδα', () => {
    const chain = [cell(0, 0), cell(4, 0), cell(8, 0), cell(12, 0), cell(16, 0)];
    expect(groupIntoTitleBlocks(chain)).toHaveLength(1);
  });

  it('🔴 ταυτόσημα σημεία δεν εκφυλίζουν το κατώφλι σε μηδέν', () => {
    // Χωρίς το δάπεδο ύψους, η διάμεσος γειτόνων είναι 0, το κατώφλι 0, και το μακρινό
    // κελί θα ήταν σωστά χωριστό — αλλά τυχαία: κάθε ζεύγος κελιών θα χώριζε.
    const groups = groupIntoTitleBlocks([cell(0, 0), cell(0, 0), cell(3, 0), cell(500, 0)]);
    expect(groups.map((g) => g.length)).toEqual([3, 1]);
  });

  it('διατηρεί τη σειρά εισόδου μέσα σε κάθε ομάδα', () => {
    const cells = [cell(0, 0), cell(100, 0), cell(2, 0), cell(102, 0)];
    expect(groupIntoTitleBlocks(cells)).toEqual([
      [cells[0], cells[2]],
      [cells[1], cells[3]],
    ]);
  });
});
