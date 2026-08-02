/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **η γεωμετρία της υπογράμμισης, και το ελάττωμα που έκρυβε.**
 *
 * ## Γιατί αυτή η σουίτα δεν αντιγράφει τον τύπο του κώδικα
 * Το test του βήματος 3 έγραφε `FONT_PX * (UNDERLINE_EM − 1)` — **τον ίδιο** τύπο με τον
 * ζωγράφο. Ένα test που αντιγράφει τον τύπο κλειδώνει τη συμπεριφορά αντί να τη
 * διασταυρώνει: έμεινε πράσινο ενώ η γραμμή έπεφτε **πάνω** από τη γραμμή βάσης, δηλαδή
 * έκοβε τα ίδια τα γράμματα.
 *
 * Εδώ ελέγχονται **ιδιότητες** που ο τύπος οφείλει να ικανοποιεί (πρόσημο, γραμμικότητα,
 * συμφωνία με το SSoT των άλλων δύο ζωγράφων) — όχι ο αριθμός που τυχαίνει να βγάζει.
 */

import { tableUnderlineGeometry, TABLE_BASELINE_BAND_FRACTION } from '../table-text-decoration';
import {
  TEXT_DECORATION_RATIOS, TEXT_METRICS_RATIOS,
} from '../../../config/text-rendering-config';
import { anchorBandFraction } from '../../../text-engine/fonts/text-vertical-metrics';

const EM = 30;
const ADVANCE = 40;

describe('η άγκυρα είναι η ΓΡΑΜΜΗ ΒΑΣΗΣ — όχι η γραμμή καθόδου', () => {
  it('🔴 το κλάσμα ζώνης έρχεται από το ΙΔΙΟ SSoT με τον TextRenderer και το explode', () => {
    // Και οι δύο καλούν `anchorBandFraction(baseline, {ascent, descent})`. Ο ζωγράφος του
    // πίνακα αφαιρούσε σκέτο `1` — δηλαδή τη γραμμή **καθόδου** — με σχόλιο που επικαλείτο
    // τον `TextRenderer` ως πηγή. Αυτό το test είναι η διασταύρωση που έλειπε.
    expect(TABLE_BASELINE_BAND_FRACTION).toBeCloseTo(
      anchorBandFraction('alphabetic', {
        ascent: TEXT_METRICS_RATIOS.ASCENT_RATIO,
        descent: TEXT_METRICS_RATIOS.DESCENT_RATIO,
      }),
      12,
    );
  });

  it('🔴 ΔΕΝ είναι 1 — η διαφορά ήταν ολόκληρο το ελάττωμα', () => {
    // Με `1` η γραμμή έβγαινε 0,2·em ψηλότερα: σε κείμενο κελιού 3mm, 0,6mm μέσα στα γράμματα.
    expect(TABLE_BASELINE_BAND_FRACTION).toBeLessThan(1);
    expect(1 - TABLE_BASELINE_BAND_FRACTION).toBeGreaterThan(0.1);
  });

  it('🔴 η γραμμή πέφτει ΚΑΤΩ από τη βάση (θετικό y σε πλαίσιο y-κάτω)', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'left').y).toBeGreaterThan(0);
  });

  it('η απόσταση είναι η διαφορά των δύο κλασμάτων, επί το em', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'left').y).toBeCloseTo(
      EM * (TEXT_DECORATION_RATIOS.UNDERLINE_EM - TABLE_BASELINE_BAND_FRACTION), 12,
    );
  });
});

describe('πάχος και πλάτος', () => {
  it('το πάχος είναι κλάσμα του em — καμία τοπική σταθερά', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'left').thickness)
      .toBeCloseTo(EM * TEXT_DECORATION_RATIOS.THICKNESS_EM, 12);
  });

  it('το πλάτος είναι ΑΚΡΙΒΩΣ το μετρημένο πλάτος του κειμένου', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'center').width).toBe(ADVANCE);
  });

  it('🔴 όλα κλιμακώνονται ΓΡΑΜΜΙΚΑ με το em — γι\' αυτό η ίδια συνάρτηση απαντά σε px ΚΑΙ σε mm', () => {
    // Είναι η ιδιότητα που επιτρέπει σε καμβά (px) και εξαγωγή (mm) να ρωτούν το ίδιο σημείο.
    const single = tableUnderlineGeometry(EM, ADVANCE, 'left');
    const double = tableUnderlineGeometry(EM * 2, ADVANCE, 'left');
    expect(double.y).toBeCloseTo(single.y * 2, 12);
    expect(double.thickness).toBeCloseTo(single.thickness * 2, 12);
  });
});

describe('η γραμμή ακολουθεί τη στοίχιση — ίδια σύμβαση με ctx.textAlign και anchorXMm', () => {
  it('αριστερά: ξεκινά στην άγκυρα', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'left').x).toBe(0);
  });

  it('κέντρο: μισό πλάτος αριστερά από την άγκυρα', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'center').x).toBe(-ADVANCE / 2);
  });

  it('δεξιά: ολόκληρο το πλάτος αριστερά από την άγκυρα', () => {
    expect(tableUnderlineGeometry(EM, ADVANCE, 'right').x).toBe(-ADVANCE);
  });

  it('🔴 και στις τρεις στοιχίσεις η γραμμή τελειώνει εκεί που τελειώνει το κείμενο', () => {
    // Η ιδιότητα, όχι οι τρεις αριθμοί: το [x, x+width] καλύπτει πάντα το κείμενο, ό,τι κι αν
    // λέει η στοίχιση. Ένα ternary με λάθος πρόσημο περνά τον έλεγχο ενός σημείου, όχι αυτόν.
    for (const align of ['left', 'center', 'right'] as const) {
      const g = tableUnderlineGeometry(EM, ADVANCE, align);
      const expectedEnd = align === 'right' ? 0 : align === 'center' ? ADVANCE / 2 : ADVANCE;
      expect(g.x + g.width).toBeCloseTo(expectedEnd, 12);
    }
  });
});
