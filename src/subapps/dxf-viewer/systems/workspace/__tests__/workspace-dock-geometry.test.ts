/**
 * ADR-724 Φ0 — Ο κανόνας πλάτους της αγκυρωμένης παλέτας.
 *
 * Καθαρές συναρτήσεις, μηδέν DOM: αν κάποια μέρα χρειαστούν jsdom, κάτι έχει διαρρεύσει μέσα τους.
 */

import {
  clampDockWidth,
  parseDockWidth,
  dockToFloatGeometry,
  resolveDropTarget,
  DOCK_DROP_ZONE_WIDTH,
  FLOAT_SPAWN_OFFSET,
} from '../workspace-dock-geometry';
// Ο κανόνας ορίων ελέγχεται με το **ίδιο** εργαλείο που τον επιβάλλει (ADR-723): αν το test
// έγραφε δική του σύγκριση ορίων, θα ήταν δεύτερη υλοποίηση του κανόνα μέσα στον φύλακά του.
import { isPanelGeometryWithinBounds, DEFAULT_MIN_PANEL_SIZE } from '@/components/ui/floating';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

const { WIDTH_DEFAULT, WIDTH_MIN, WIDTH_MAX } = PANEL_LAYOUT.WORKSPACE_DOCK;

describe('ADR-724 — workspace-dock-geometry', () => {
  describe('οι τιμές του συμβολαίου (§6.4)', () => {
    it('η προεπιλογή είναι το σημερινό πλάτος (w-96) ⇒ μηδενική οπτική αλλαγή', () => {
      expect(WIDTH_DEFAULT).toBe(384);
    });

    it('το ελάχιστο ταυτίζεται με το DEFAULT_MIN_PANEL_SIZE.width του ADR-723', () => {
      // Μία έννοια «στενότερο λειτουργικό πλάτος παλέτας» σε όλη την εφαρμογή.
      expect(WIDTH_MIN).toBe(280);
    });

    it('η προεπιλογή βρίσκεται εντός των ορίων', () => {
      expect(WIDTH_DEFAULT).toBeGreaterThanOrEqual(WIDTH_MIN);
      expect(WIDTH_DEFAULT).toBeLessThanOrEqual(WIDTH_MAX);
    });
  });

  describe('clampDockWidth', () => {
    it('αφήνει αυτούσιο ένα πλάτος εντός ορίων', () => {
      expect(clampDockWidth(500)).toBe(500);
    });

    it('κρατά και τα δύο άκρα (κλειστό διάστημα)', () => {
      expect(clampDockWidth(WIDTH_MIN)).toBe(WIDTH_MIN);
      expect(clampDockWidth(WIDTH_MAX)).toBe(WIDTH_MAX);
    });

    it('ανεβάζει ένα υπερβολικά στενό πλάτος στο ελάχιστο', () => {
      expect(clampDockWidth(120)).toBe(WIDTH_MIN);
    });

    it('κατεβάζει ένα υπερβολικά πλατύ πλάτος στο μέγιστο', () => {
      expect(clampDockWidth(5000)).toBe(WIDTH_MAX);
    });

    it.each([NaN, Infinity, -Infinity, 0, -300])(
      'επιστρέφει την ΠΡΟΕΠΙΛΟΓΗ (όχι το πλησιέστερο όριο) για μη έγκυρη είσοδο: %p',
      (value) => {
        // Ένα NaN που γινόταν 280 θα έκρυβε ότι η πηγή του είναι χαλασμένη.
        expect(clampDockWidth(value)).toBe(WIDTH_DEFAULT);
      },
    );

    it('είναι ιδεματικό (idempotent) — δεύτερη εφαρμογή δεν αλλάζει τίποτα', () => {
      for (const value of [120, 500, 5000, NaN]) {
        expect(clampDockWidth(clampDockWidth(value))).toBe(clampDockWidth(value));
      }
    });
  });

  describe('parseDockWidth', () => {
    it('δέχεται πεπερασμένο θετικό αριθμό αυτούσιο — ΧΩΡΙΣ clamp', () => {
      // Σκόπιμα: «η αποθήκευση λέει 5000» και «το 5000 είναι αποδεκτό» είναι δύο ερωτήματα.
      expect(parseDockWidth(5000)).toBe(5000);
      expect(parseDockWidth(384)).toBe(384);
    });

    it.each([
      ['string', '384'],
      ['null', null],
      ['undefined', undefined],
      ['αντικείμενο', { width: 384 }],
      ['πίνακας', [384]],
      ['boolean', true],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['μηδέν', 0],
      ['αρνητικό', -384],
    ])('επιστρέφει null για %s', (_label, value) => {
      expect(parseDockWidth(value)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADR-724 Φ3 — ΜΕΤΑΒΑΣΗ ΚΑΙ ΖΩΝΕΣ ΑΠΟΘΕΣΗΣ
// ═══════════════════════════════════════════════════════════════════════════════

describe('ADR-724 Φ3 — dockToFloatGeometry (§7)', () => {
  /** Ρεαλιστικός χώρος εργασίας: ο viewer κάθεται δεξιά της ράγας και κάτω από το ribbon. */
  const WORKSPACE = { left: 48, top: 140, width: 2000, height: 900 };
  const VIEWPORT = { width: 2400, height: 1120 };

  it('γεννά την παλέτα ΜΕΣΑ στον χώρο εργασίας, όχι στη γωνία του παραθύρου', () => {
    const geometry = dockToFloatGeometry({
      side: 'docked-left', dockedWidth: 384, workspace: WORKSPACE, viewport: VIEWPORT,
    });
    // Θα ήταν 24 αν μετρούσαμε από το παράθυρο — δηλαδή πάνω στη ράγα πλοήγησης.
    expect(geometry.x).toBe(WORKSPACE.left + FLOAT_SPAWN_OFFSET);
    expect(geometry.y).toBe(WORKSPACE.top + FLOAT_SPAWN_OFFSET);
  });

  it('🔴 η μετατόπιση είναι ΠΡΟΣ ΤΑ ΜΕΣΑ και στις δύο πλευρές', () => {
    // Μια σταθερή «+24» θα έσπρωχνε τη δεξιά παλέτα εκτός οθόνης· το clamp θα την κολλούσε
    // στην ακμή και οι δύο πλευρές θα φαίνονταν ασύμμετρες.
    const right = dockToFloatGeometry({
      side: 'docked-right', dockedWidth: 384, workspace: WORKSPACE, viewport: VIEWPORT,
    });
    expect(right.x).toBe(WORKSPACE.left + WORKSPACE.width - 384 - FLOAT_SPAWN_OFFSET);
    expect(right.x + right.width).toBeLessThan(WORKSPACE.left + WORKSPACE.width);
  });

  it('κρατά το πλάτος που είχε αγκυρωμένη — η αιώρηση δεν είναι αλλαγή μεγέθους', () => {
    const geometry = dockToFloatGeometry({
      side: 'docked-left', dockedWidth: 520, workspace: WORKSPACE, viewport: VIEWPORT,
    });
    expect(geometry.width).toBe(520);
  });

  it('παράλογο αποθηκευμένο πλάτος περνά από τον ΙΔΙΟ clamp με την αγκύρωση', () => {
    const geometry = dockToFloatGeometry({
      side: 'docked-left', dockedWidth: 99999, workspace: WORKSPACE, viewport: VIEWPORT,
    });
    expect(geometry.width).toBe(WIDTH_MAX);
  });

  it('🔴 η γεωμετρία είναι ΠΑΝΤΑ εντός των ορίων του ADR-723 — δεν γεννιέται χαμένη', () => {
    // Το τεκμηριωμένο «palette lost off-screen»: χώρος εργασίας που δεν χωρά στο παράθυρο
    // (π.χ. αποσυνδέθηκε δεύτερη οθόνη πριν προλάβει να ξαναμετρηθεί).
    const geometry = dockToFloatGeometry({
      side: 'docked-right',
      dockedWidth: 700,
      workspace: { left: 3000, top: 2000, width: 1200, height: 800 },
      viewport: VIEWPORT,
    });
    expect(isPanelGeometryWithinBounds(geometry, VIEWPORT)).toBe(true);
  });

  it('ποτέ ύψος κάτω από το λειτουργικό ελάχιστο, όσο κοντός κι αν είναι ο χώρος', () => {
    const geometry = dockToFloatGeometry({
      side: 'docked-left', dockedWidth: 384,
      workspace: { left: 0, top: 0, width: 1000, height: 20 },
      viewport: VIEWPORT,
    });
    expect(geometry.height).toBeGreaterThanOrEqual(DEFAULT_MIN_PANEL_SIZE.height);
  });
});

describe('ADR-724 Φ3 — resolveDropTarget (§7.1)', () => {
  const WORKSPACE = { left: 100, top: 0, width: 1000, height: 800 };
  const RIGHT_EDGE = WORKSPACE.left + WORKSPACE.width; // 1100

  it('η ζώνη είναι 64px — ο κανόνας του Revit, όχι στρογγυλοποίηση', () => {
    expect(DOCK_DROP_ZONE_WIDTH).toBe(64);
  });

  it('μέσα στην αριστερή ζώνη ⇒ αγκύρωση αριστερά', () => {
    expect(resolveDropTarget(WORKSPACE.left, WORKSPACE)).toBe('docked-left');
    expect(resolveDropTarget(WORKSPACE.left + 63, WORKSPACE)).toBe('docked-left');
  });

  it('το όριο ανήκει στη ζώνη (≤), και το επόμενο pixel ΟΧΙ', () => {
    expect(resolveDropTarget(WORKSPACE.left + 64, WORKSPACE)).toBe('docked-left');
    expect(resolveDropTarget(WORKSPACE.left + 65, WORKSPACE)).toBeNull();
  });

  it('μέσα στη δεξιά ζώνη ⇒ αγκύρωση δεξιά', () => {
    expect(resolveDropTarget(RIGHT_EDGE, WORKSPACE)).toBe('docked-right');
    expect(resolveDropTarget(RIGHT_EDGE - 64, WORKSPACE)).toBe('docked-right');
    expect(resolveDropTarget(RIGHT_EDGE - 65, WORKSPACE)).toBeNull();
  });

  it('στη μέση ⇒ null: η παλέτα μένει αιωρούμενη', () => {
    expect(resolveDropTarget(WORKSPACE.left + WORKSPACE.width / 2, WORKSPACE)).toBeNull();
  });

  it('🔴 ΠΕΡΑ από την ακμή ⇒ αγκύρωση σε ΕΚΕΙΝΗ την πλευρά, ποτέ null', () => {
    /*
      ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ TEST (αναφορά Giorgio, 2026-07-29):
      *«όταν ξεκρεμάω το πάνελ δεν μπορώ με drag+drop να το ξαναβάλω στη θέση του»*.

      Η πρώτη γραφή είχε `if (distanceToLeft < 0) return null` με σκεπτικό «ο χρήστης έσυρε
      αλλού». Λάθος: σέρνοντας την παλέτα προς τα αριστερά, ο δείκτης περνά **πάνω από τη ράγα
      πλοήγησης** της εφαρμογής — δηλαδή ακριβώς η πιο εμφατική χειρονομία αγκύρωσης
      ακυρωνόταν. «Πιο έξω» σημαίνει «σίγουρα εκεί», όχι «άκυρο».
    */
    expect(resolveDropTarget(WORKSPACE.left - 1, WORKSPACE)).toBe('docked-left');
    expect(resolveDropTarget(WORKSPACE.left - 500, WORKSPACE)).toBe('docked-left');
    expect(resolveDropTarget(RIGHT_EDGE + 1, WORKSPACE)).toBe('docked-right');
    expect(resolveDropTarget(RIGHT_EDGE + 500, WORKSPACE)).toBe('docked-right');
  });

  describe('🔴 η ακμή ΤΗΣ ΠΑΛΕΤΑΣ ως δεύτερη πηγή πρόθεσης (Photoshop/Illustrator)', () => {
    /*
      Ο χρήστης κοιτάζει το **panel**, όχι τον κέρσορα. Αν πιάσει τη λαβή κοντά στο «⋮»
      (≈370px από την αριστερή ακμή μιας παλέτας 384px), τότε για να μπει ο ΔΕΙΚΤΗΣ σε ζώνη
      64px, η παλέτα πρέπει να έχει βγει ~300px εκτός οθόνης. Κανείς δεν σέρνει τόσο.
    */
    const farFromEdges = WORKSPACE.left + 500; // ο δείκτης ΔΕΝ βοηθά καθόλου

    it('η αριστερή ακμή της παλέτας πέρασε έξω ⇒ αγκύρωση αριστερά', () => {
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: WORKSPACE.left - 1, right: 400 }))
        .toBe('docked-left');
    });

    it('η δεξιά ακμή της παλέτας πέρασε έξω ⇒ αγκύρωση δεξιά', () => {
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: 800, right: RIGHT_EDGE + 1 }))
        .toBe('docked-right');
    });

    it('🔴 το κατώφλι της παλέτας είναι 0, ΟΧΙ 64 — αλλιώς η αιώρηση κοντά στην ακμή είναι αδύνατη', () => {
      /*
        Η γεωμετρία εκκίνησης γεννά την παλέτα στα `+FLOAT_SPAWN_OFFSET` (24px) από την ακμή.
        Με κατώφλι 64px η παλέτα θα ήταν ΗΔΗ μέσα στη ζώνη τη στιγμή που αιωρείται: το πρώτο
        σύρσιμο θα την ξανα-αγκύρωνε αμέσως.
      */
      const justInside = { left: WORKSPACE.left + FLOAT_SPAWN_OFFSET, right: 500 };
      expect(resolveDropTarget(farFromEdges, WORKSPACE, justInside)).toBeNull();
      // Ακριβώς πάνω στην ακμή = ακόμη μέσα.
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: WORKSPACE.left, right: 500 }))
        .toBeNull();
    });

    it('παλέτα εντός ορίων + δείκτης στη μέση ⇒ μένει αιωρούμενη', () => {
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: 300, right: 700 })).toBeNull();
    });

    it('χωρίς ακμές παλέτας, ο κανόνας του δείκτη ισχύει αναλλοίωτος', () => {
      expect(resolveDropTarget(WORKSPACE.left + 10, WORKSPACE, undefined)).toBe('docked-left');
      expect(resolveDropTarget(farFromEdges, WORKSPACE, undefined)).toBeNull();
    });

    it.each([
      ['NaN', { left: NaN, right: NaN }],
      ['Infinity', { left: -Infinity, right: Infinity }],
    ])('αλλοιωμένες ακμές (%s) αγνοούνται αντί να αγκυρώσουν τυχαία', (_label, panel) => {
      expect(resolveDropTarget(farFromEdges, WORKSPACE, panel)).toBeNull();
    });

    it('🔴 ΕΚΦΥΛΙΣΜΕΝΟ ορθογώνιο (μηδενικό πλάτος) δεν αγκυρώνει — έχει σημείο, όχι ακμές', () => {
      /*
        `{left:0,right:0}` προκύπτει από αποπροσαρτημένο στοιχείο, από στοιχείο πριν από την
        πρώτη διάταξη, και από το jsdom. Χωρίς φύλακα ικανοποιεί πάντα το
        `panel.left < workspace.left` ⇒ **κάθε** απόθεση θα αγκύρωνε αριστερά. Εντοπίστηκε από
        δύο κόκκινα tests («η μεσαία απόθεση αγκύρωσε αριστερά»), όχι από πρόβλεψη.
      */
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: 0, right: 0 })).toBeNull();
      expect(resolveDropTarget(farFromEdges, WORKSPACE, { left: 900, right: 400 })).toBeNull();
    });
  });

  it('🔴 σε ΣΤΕΝΟ χώρο (ζώνες που επικαλύπτονται) η δεξιά αγκύρωση παραμένει προσπελάσιμη', () => {
    /*
      Η παγίδα: `if (αριστερή) … else if (δεξιά)` θα έδινε «αριστερά» σε ΟΛΟ το πλάτος όταν
      workspace.width < 128 — δηλαδή η δεξιά αγκύρωση θα γινόταν σιωπηλά απροσπέλαστη σε στενή
      οθόνη, και μόνο εκεί. Η σύγκριση αποστάσεων απαντά σωστά σε κάθε πλάτος.
    */
    /*
      ⚠️ ΤΑ ΣΗΜΕΙΑ ΕΠΙΛΕΓΟΝΤΑΙ ΩΣΤΕ ΝΑ ΕΙΝΑΙ ΣΕ **ΑΜΦΟΤΕΡΕΣ** ΤΙΣ ΖΩΝΕΣ.

      Πρώτη γραφή αυτού του test χρησιμοποιούσε x=10 και x=90: το x=90 έχει
      `distanceToLeft = 90 > 64`, άρα **δεν** είναι στην αριστερή ζώνη — ο κλάδος της
      επικάλυψης δεν εκτελούνταν ποτέ. Το test ήταν πράσινο και **δεν μπορούσε να κοκκινίσει**:
      αποδείχθηκε με μετάλλαξη (2026-07-29, M2 — «προτεραιότητα αριστερά» έμεινε πράσινη).

      Με width=100 και ζώνη 64, η επικάλυψη είναι το διάστημα [36, 64].
    */
    const narrow = { left: 0, top: 0, width: 100, height: 500 };
    expect(resolveDropTarget(40, narrow)).toBe('docked-left');  // 40 vs 60 ⇒ αριστερά
    expect(resolveDropTarget(60, narrow)).toBe('docked-right'); // 60 vs 40 ⇒ δεξιά
    // …και εκτός επικάλυψης η απάντηση παραμένει η προφανής.
    expect(resolveDropTarget(10, narrow)).toBe('docked-left');
    expect(resolveDropTarget(90, narrow)).toBe('docked-right');
  });

  it('ισοπαλία ΜΕΣΑ στην επικάλυψη ⇒ αριστερά (η προεπιλογή), ντετερμινιστικά', () => {
    const narrow = { left: 0, top: 0, width: 100, height: 500 };
    expect(resolveDropTarget(50, narrow)).toBe('docked-left');
  });

  it.each([NaN, Infinity, -Infinity])('μη-πεπερασμένος δείκτης (%p) ⇒ null', (x) => {
    expect(resolveDropTarget(x, WORKSPACE)).toBeNull();
  });

  it('μηδενικού πλάτους χώρος ⇒ null αντί για διαίρεση με το τίποτα', () => {
    expect(resolveDropTarget(0, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});
