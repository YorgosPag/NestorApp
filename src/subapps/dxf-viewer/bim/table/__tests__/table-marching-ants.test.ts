/**
 * 🔴 ADR-739 §48 — **Η ΦΟΡΑ ΕΙΝΑΙ Η ΠΡΟΔΙΑΓΡΑΦΗ, ΚΑΙ ΕΙΝΑΙ ΕΝΑ ΠΡΟΣΗΜΟ.**
 *
 * Ο ιδιοκτήτης το διατύπωσε ρητά: «η διακεκομμένη γραμμή κινείται **δεξιόστροφα**». Ολόκληρη
 * αυτή η απαίτηση καταλήγει σε **ένα πρόσημο**, και ένα πρόσημο είναι ακριβώς το είδος
 * σφάλματος που περνά κάθε ανάγνωση κώδικα και φαίνεται μόνο στην οθόνη — ή εδώ.
 *
 * Δύο ανεξάρτητα γεγονότα το ορίζουν (δες την κεφαλίδα του module): η φορά χάραξης του
 * `appendRectSubpath` είναι δεξιόστροφη στην οθόνη, και το `lineDashOffset` κινεί το μοτίβο
 * **αντίθετα** στη χάραξη. Το test κλειδώνει το συμπέρασμα, όχι τα δύο βήματα — αν κάποτε
 * αλλάξει η σειρά των γωνιών στο `appendRectSubpath`, αυτό εδώ **δεν** θα χτυπήσει· θα χτυπήσει
 * η οθόνη. Γι' αυτό το πρόσημο τεκμηριώνεται και στα δύο αρχεία.
 */

import {
  MARCHING_ANTS_CYCLES_PER_SEC,
  MARCHING_ANTS_DASH_PX,
  MARCHING_ANTS_DASH_SCALE,
  MARCHING_ANTS_EXCEL_DASH_PX,
  MARCHING_ANTS_PERIOD_PX,
  MARCHING_ANTS_SPEED_PX_PER_SEC,
  marchingAntsDashOffsetPx,
} from '../table-marching-ants';
import { TABLE_COPY_MARQUEE, TABLE_MODE_OUTLINE } from '../../../config/color-config';

describe('🔴 ADR-739 §48 — η φορά: δεξιόστροφα ⇒ ΑΡΝΗΤΙΚΟ offset', () => {
  it('ΒΑΣΗ — στο μηδέν η φάση είναι μηδέν', () => {
    expect(marchingAntsDashOffsetPx(0)).toBe(0);
  });

  it('🔴 ΤΟ ΠΡΟΣΗΜΟ — κάθε στιγμή μέσα στην πρώτη περίοδο δίνει offset ≤ 0', () => {
    // Ένα θετικό offset θα έστρεφε τα μυρμήγκια **αριστερόστροφα**, δηλαδή θα ήταν λάθος
    // ακριβώς στο ένα πράγμα που ζήτησε ο ιδιοκτήτης — με τα πάντα άλλα σωστά.
    for (let ms = 0; ms <= 400; ms += 25) {
      expect(marchingAntsDashOffsetPx(ms)).toBeLessThanOrEqual(0);
    }
  });

  it('μειώνεται μονότονα μέσα στην ίδια περίοδο', () => {
    const periodMs = (MARCHING_ANTS_PERIOD_PX / MARCHING_ANTS_SPEED_PX_PER_SEC) * 1000;
    let previous = marchingAntsDashOffsetPx(0);
    for (let ms = periodMs / 8; ms < periodMs; ms += periodMs / 8) {
      const current = marchingAntsDashOffsetPx(ms);
      expect(current).toBeLessThan(previous);
      previous = current;
    }
  });

  it('🔴 τυλίγεται στην περίοδο — αλλιώς η κίνηση «κολλάει» μετά από ώρες', () => {
    // Το τύλιγμα δεν είναι καλλωπισμός: χωρίς αυτό ο αριθμός θα μεγάλωνε απεριόριστα και θα
    // έχανε ακρίβεια κινητής υποδιαστολής στο μέγεθος του βήματος (~1,7 px).
    const periodMs = (MARCHING_ANTS_PERIOD_PX / MARCHING_ANTS_SPEED_PX_PER_SEC) * 1000;
    expect(marchingAntsDashOffsetPx(periodMs)).toBeCloseTo(0, 9);
    expect(marchingAntsDashOffsetPx(periodMs * 1000 + periodMs / 2)).toBeCloseTo(
      marchingAntsDashOffsetPx(periodMs / 2),
      6,
    );
    // Και ποτέ έξω από το ανοιχτό διάστημα (-period, 0].
    for (const ms of [1, 137, 5_000, 3_600_000]) {
      const offset = marchingAntsDashOffsetPx(ms);
      expect(offset).toBeGreaterThan(-MARCHING_ANTS_PERIOD_PX);
      expect(offset).toBeLessThanOrEqual(0);
    }
  });

  it('αρνητικός χρόνος δεν γεννά ΘΕΤΙΚΟ offset (σιωπηλή αντιστροφή φοράς)', () => {
    // Ο `%` της JavaScript κρατά το πρόσημο του αριστερού μέλους — χωρίς το `Math.max(0, …)`
    // ένα μελλοντικό «γύρνα την κίνηση πίσω» θα έστρεφε τα μυρμήγκια χωρίς να το δηλώσει.
    expect(marchingAntsDashOffsetPx(-500)).toBe(0);
  });
});

describe('🔴 ADR-739 §48 — το μοτίβο είναι ΜΕΤΡΗΜΕΝΟ από το Excel, όχι διαλεγμένο', () => {
  it('🔴 ΤΟ ΑΠΟΤΥΠΩΜΑ ΤΟΥ EXCEL — παύλα 7, κενό 2', () => {
    // Υποεικονοστοιχειακή ανάγνωση από στιγμιότυπο Excel, με δύο ανεξάρτητες βαθμονομήσεις
    // μέσα στην ίδια εικόνα (ύψος γραμμής 124/20 = 6,20× · πλάτος στήλης 401/64 = 6,27×):
    // παύλα 43,87 ÷ 6,2 = 7,04 · κενό 11,96 ÷ 6,2 = 1,92. Δες την κεφαλίδα του module.
    //
    // Το test γράφει τους αριθμούς **κυριολεκτικά** επίτηδες: είναι αποτέλεσμα μέτρησης, όχι
    // παράγωγο κάποιου άλλου κανόνα. Αν κάποιος τους αλλάξει, οφείλει να έχει νέα μέτρηση.
    //
    // ⚠️ Ελέγχεται η **μέτρηση**, όχι το ζωγραφισμένο μοτίβο: το δεύτερο κλιμακώνεται σκόπιμα
    // (§48.10). Αν το test κοιτούσε το `MARCHING_ANTS_DASH_PX`, κάθε δοκιμή μεγέθους θα το
    // έκανε κόκκινο και ο επόμενος θα «διόρθωνε» τη μέτρηση για να γίνει πράσινο — δηλαδή θα
    // έσβηνε ακριβώς το τεκμήριο που φυλάει.
    expect([...MARCHING_ANTS_EXCEL_DASH_PX]).toEqual([7, 2]);
  });

  it('η περίοδος είναι το άθροισμα του μοτίβου', () => {
    expect(MARCHING_ANTS_PERIOD_PX).toBe(MARCHING_ANTS_DASH_PX[0] + MARCHING_ANTS_DASH_PX[1]);
  });

  it('🔴 Η ΚΛΙΜΑΚΑ ΔΕΝ ΑΛΛΑΖΕΙ ΤΗΝ ΠΥΚΝΟΤΗΤΑ ΜΕΛΑΝΙΟΥ — 78%, σε κάθε μέγεθος', () => {
    // Ό,τι κι αν δοκιμαστεί ως μέγεθος, το μοτίβο πρέπει να παραμένει **το μοτίβο του Excel**:
    // ο λόγος παύλα:κενό είναι η ταυτότητά του. Ένα χειρόγραφο `[14, 3]` θα περνούσε τον έλεγχο
    // μεγέθους και θα άλλαζε σιωπηλά τον χαρακτήρα της γραμμής.
    expect([...MARCHING_ANTS_DASH_PX]).toEqual(
      MARCHING_ANTS_EXCEL_DASH_PX.map((segment) => segment * MARCHING_ANTS_DASH_SCALE),
    );
    const inkRatio = MARCHING_ANTS_DASH_PX[0] / MARCHING_ANTS_PERIOD_PX;
    expect(inkRatio).toBeCloseTo(7 / 9, 10);
  });

  it('🔴 Ο ΡΥΘΜΟΣ ΕΙΝΑΙ Η ΑΝΑΛΛΟΙΩΤΗ — 2,5 περίοδοι/δευτ, ό,τι κι αν γίνει με το μέγεθος', () => {
    // Η ταχύτητα είναι σε px/s, άρα αλλάζοντας **μόνο** την περίοδο άλλαζε σιωπηλά ο ρυθμός που
    // βλέπει το μάτι (8 → 9 px θα έριχνε τα 20 px/s από 2,50 σε 2,22 περιόδους/δευτ). Από το
    // §48.10 η εξάρτηση είναι **αντεστραμμένη**: ο ρυθμός είναι η πρωταρχική σταθερά και η
    // ταχύτητα παράγεται — άρα το λάθος δεν είναι πια «φυλαγμένο», είναι **μη εκφράσιμο**.
    expect(MARCHING_ANTS_CYCLES_PER_SEC).toBeCloseTo(2.5, 10);
    expect(MARCHING_ANTS_SPEED_PX_PER_SEC).toBeCloseTo(
      MARCHING_ANTS_CYCLES_PER_SEC * MARCHING_ANTS_PERIOD_PX,
      10,
    );
  });
});

describe('🔴 ADR-739 §48 — ξεχωρίζει από το περίγραμμα λειτουργίας, που ζει ΤΑΥΤΟΧΡΟΝΑ', () => {
  it('🔴 ΔΕΝ είναι το μοτίβο του `TABLE_MODE_OUTLINE`', () => {
    // Τα δύο διακεκομμένα ζουν **ταυτόχρονα** γύρω από τα ίδια κελιά. Ίδιο μοτίβο θα σήμαινε
    // ότι η μόνη διάκριση μένει η απόχρωση — και σε σμίκρυνση χάνεται κι αυτή.
    //
    // ⚠️ Συγκρίνεται με τη **ζωντανή** σταθερά, όχι με αντίγραφο `[6, 4]`: η προηγούμενη μορφή
    // αυτού του test έγραφε το literal, δηλαδή θα έμενε πράσινη αν το περίγραμμα λειτουργίας
    // μετακινούνταν πάνω στο μοτίβο των μυρμηγκιών — ακριβώς η σύγκρουση που υποτίθεται ότι
    // φυλάει.
    expect([...MARCHING_ANTS_DASH_PX]).not.toEqual([...TABLE_MODE_OUTLINE.dashPx]);
  });

  it('🔴 ΤΟ ΠΑΧΟΣ ΕΙΝΑΙ ΤΟ ΤΕΤΑΡΤΟ ΚΑΝΑΛΙ — 1 px έναντι 2, και είναι σκόπιμο', () => {
    // Το πάχος είναι το κανάλι που επιβιώνει στη σμίκρυνση, όπου δύο πυκνά μοτίβα συγχέονται
    // πρώτα. Είναι επίσης **ρητή παρέκκλιση** από τον κανόνα των 2 px (WCAG 2.2 SC 2.4.13
    // δεσμεύει τον δείκτη ΕΣΤΙΑΣΗΣ — εδώ αυτός είναι ο δρομέας κελιού, που μένει στα 2 px).
    // Η αιτιολόγηση ζει γραπτά στο `color-config.ts`· εδώ κλειδώνεται ότι δεν θα επιστρέψει
    // σιωπηλά στα 2 px «για ομοιομορφία», που θα έκανε το marquee να φαίνεται συμπαγές:
    // το μετρημένο κενό είναι 2 px, όσο και το πάχος που θα το έπνιγε.
    expect(TABLE_COPY_MARQUEE.lineWidthPx).toBe(1);
    expect(TABLE_COPY_MARQUEE.lineWidthPx).toBeLessThan(TABLE_MODE_OUTLINE.lineWidthPx);
    // Και το κενό δεν επιτρέπεται να πέσει κάτω από το πάχος — εκεί ακριβώς παύει να διαβάζεται
    // ως διακεκομμένη γραμμή.
    expect(MARCHING_ANTS_DASH_PX[1]).toBeGreaterThanOrEqual(TABLE_COPY_MARQUEE.lineWidthPx);
  });
});
