/**
 * 🔴 ADR-786 — **ΟΙ ΑΓΚΥΡΕΣ ΠΟΥ ΜΠΟΡΟΥΝ ΝΑ ΚΟΚΚΙΝΙΣΟΥΝ.**
 *
 * ## Γιατί κάθε test εδώ εγκαθιστά ρητά γραμματοσειρά
 *
 * Στο jsdom **δεν υπάρχει καμία φορτωμένη γραμματοσειρά CAD**, οπότε το `resolveEntityFont`
 * επιστρέφει `null`, το `emSizeForTextHeight` αφήνει το ύψος **αμετάβλητο** και η μετατροπή
 * «ύψος κεφαλαίου → em» γίνεται **ταυτοτική**. Δηλαδή: μια άγκυρα γραμμένη χωρίς
 * `installStubFont()` είναι πράσινη **και με τον διορθωμένο κώδικα και με τον σπασμένο** —
 * ακριβώς ο λόγος που το ελάττωμα έζησε μήνες με 826 πράσινα tests από πάνω του.
 *
 * Το stub έχει `sCapHeight/upm = 0,8`, άρα **em = 1,25 × ύψος κεφαλαίου**. Ο αριθμός δεν
 * γράφεται ποτέ ωμός σε αναμονή: ζητιέται από το ίδιο SSoT (`stubEmSize`), ώστε το test να
 * **διασταυρώνει** αντί να κλειδώνει τη συμπεριφορά (μάθημα ADR-739 Φ.Ε/Φ2 βήμα 4).
 *
 * @see rendering/entities/table/__tests__/table-typography-paint.test.ts — ο ζωγράφος
 * @see ui/table-cell-editor/__tests__/table-cell-editor-frame.test.ts — η αναλλοίωτη Α2
 */

import { tableTextFace, tableTextFont, tableCellFont } from '../table-text-font';
import {
  installStubFont,
  stubEmSize,
} from '../../../text-engine/fonts/__tests__/_stub-font';

/** Ύψος **κεφαλαίου** σε px — ό,τι δίνει η διάταξη (`heightMm × pxPerMm`). */
const CAP_PX = 20;

// ── Κ: η μετατροπή που έλειπε ────────────────────────────────────────────────

describe('🔴 Κ — ύψος ΚΕΦΑΛΑΙΟΥ μπαίνει, em βγαίνει', () => {
  describe('με φορτωμένο face (tier 1) — το μόνο tier όπου η ερώτηση έχει νόημα', () => {
    let restore: () => void;
    beforeAll(() => { restore = installStubFont(0.6, 'arial'); });
    afterAll(() => restore());

    it('Κ1 — το `em` ΔΕΝ είναι το ύψος: διαιρείται με τον λόγο cap/em του face', () => {
      expect(tableTextFont(CAP_PX, false, false).em).toBeCloseTo(stubEmSize(CAP_PX), 9);
      // Ο παρονομαστής της άγκυρας: αν κάποιος ξαναπεράσει ωμό το ύψος, αυτό γίνεται ισότητα.
      expect(tableTextFont(CAP_PX, false, false).em).not.toBeCloseTo(CAP_PX, 6);
    });

    it('Κ2 — το CSS shorthand φέρει το **em**, όχι το ύψος κεφαλαίου', () => {
      const font = tableTextFont(CAP_PX, false, false);
      expect(font.css).toContain(`${font.em}px`);
      expect(font.css).not.toContain(`${CAP_PX}px`);
    });

    it('Κ3 — `emPerCap` είναι ο ΙΔΙΟΣ συντελεστής με τη μετατροπή, όχι δεύτερη ανάγνωση', () => {
      const face = tableTextFace(false, false);
      expect(CAP_PX * face.emPerCap).toBeCloseTo(tableTextFont(CAP_PX, false, false).em, 9);
    });
  });

  describe('χωρίς face (tier CSS) — η ΙΔΙΑ γραμμή δίνει τη σωστή απάντηση', () => {
    it('Κ4 — το ύψος περνά αμετάβλητο, γιατί εκεί ακριβώς αυτό μετρά κι ο μετρητής', () => {
      expect(tableTextFont(CAP_PX, false, false).em).toBe(CAP_PX);
      expect(tableTextFace(false, false).emPerCap).toBe(1);
    });

    it('Κ5 — ΤΟ ΟΡΓΑΝΟ: χωρίς face η μετατροπή είναι ταυτοτική, άρα ένα test εδώ ΔΕΝ κρίνει', () => {
      // Αυτή η άγκυρα δεν ελέγχει τον κώδικα — τεκμηριώνει **γιατί** τα υπόλοιπα εγκαθιστούν
      // stub. Αν κάποτε πάψει να ισχύει (bundled fonts στο jest), τα Κ4/Κ5 θα το πουν.
      expect(tableTextFont(CAP_PX, false, false).em).toBe(tableTextFont(CAP_PX, false, false).em);
      expect(tableTextFace(false, false).resolved).toBeNull();
    });
  });
});

// ── Γ: η ΟΨΗ — ποιο face ζωγραφίζει πράγματι ─────────────────────────────────

describe('🔴 Γ — το CSS ζητά το face που ΖΩΓΡΑΦΙΖΕΙ, όχι αυτό που ζητήθηκε', () => {
  describe('υποκατάσταση: το αιτούμενο δεν υπάρχει, το υποκατάστατο ναι', () => {
    let restore: () => void;
    beforeAll(() => { restore = installStubFont(0.6, 'Liberation Sans'); });
    afterAll(() => restore());

    it('Γ1 — `verdana` ⇒ CSS «Liberation Sans»: η βλάβη Arial-vs-Roboto του §4', () => {
      // Ο καμβάς ζωγραφίζει τα περιγράμματα του υποκατάστατου (catch-all `'*'`). Ένα ωμό
      // `verdana` στο DOM θα έβαζε τον επεξεργαστή να ζωγραφίσει **άλλη** γραμματοσειρά πάνω
      // στην ίδια θέση — δύο σωστά κείμενα, μία σπασμένη αναλλοίωτη.
      const face = tableTextFace(false, false, 'verdana');
      expect(face.resolved?.cacheName).toBe('Liberation Sans');
      expect(face.cssFamily).toBe('"Liberation Sans"');
      expect(face.cssFamily).not.toContain('verdana');
    });

    it('Γ3 — ΕΝΤΟΝΑ: δεν υπάρχει bundled bold face ⇒ ο επεξεργαστής ακολουθεί τον καμβά ΠΙΣΩ στο CSS', () => {
      // Αυτό είναι το ουσιώδες: η πτώση tier αλλάζει **και** την οικογένεια **και** το em,
      // και οι δύο επιφάνειες οφείλουν να πέσουν μαζί. Η αιτούμενη οικογένεια επιστρέφει,
      // γιατί ακριβώς αυτήν βάζει ο ζωγράφος στο `ctx.font` σε εκείνο το tier.
      const face = tableTextFace(true, false, 'verdana');
      expect(face.resolved).toBeNull();
      expect(face.cssFamily).toBe('"verdana"');
      expect(face.cssBold).toBe(true);
      expect(tableTextFont(CAP_PX, true, false, 'verdana').em).toBe(CAP_PX);
    });

    it('Γ4 — ΠΛΑΓΙΑ: ίδιος κανόνας, ίδια πτώση (δεν υπάρχουν bundled italic faces)', () => {
      const face = tableTextFace(false, true, 'verdana');
      expect(face.resolved).toBeNull();
      expect(face.cssItalic).toBe(true);
      expect(tableTextFont(CAP_PX, false, true, 'verdana').css).toMatch(/^italic /);
    });
  });

  describe('🔴 Γ2 — όταν το ΕΝΤΟΝΟ face ΥΠΑΡΧΕΙ, το CSS δεν επιτρέπεται να παχύνει δεύτερη φορά', () => {
    // ⚠️ Η πρώτη γραφή αυτής της άγκυρας ζητούσε `bold: false` και **επέζησε** της μετάλλαξης
    // `cssBold: bold` — έλεγχε περίπτωση όπου η σωστή και η λάθος απάντηση συμπίπτουν. Εδώ το
    // έντονο face **υπάρχει**, οπότε ο καμβάς ζωγραφίζει τα δικά του περιγράμματα· ένα `bold`
    // στο CSS θα ζητούσε από τον browser να τα παχύνει **ξανά** — γράμματα πιο χοντρά από του
    // καμβά, στην ίδια ακριβώς θέση.
    let restore: Array<() => void> = [];
    beforeAll(() => {
      restore = [installStubFont(0.6, 'Liberation Sans'), installStubFont(0.6, 'Liberation Sans Bold')];
    });
    afterAll(() => restore.forEach((r) => r()));

    it('το έντονο λύνεται στο δικό του face και το CSS ζητά κανονικό βάρος', () => {
      const face = tableTextFace(true, false, 'verdana');
      expect(face.resolved?.cacheName).toBe('Liberation Sans Bold');
      expect(face.cssFamily).toBe('"Liberation Sans Bold"');
      expect(face.cssBold).toBe(false);
      expect(tableTextFont(CAP_PX, true, false, 'verdana').css).not.toContain('bold');
    });
  });

  it('Γ5 — το όνομα οικογένειας βγαίνει ΣΕ ΕΙΣΑΓΩΓΙΚΑ: αλλιώς ένα άκυρο shorthand αγνοείται σιωπηλά', () => {
    // Ένα πολυλεκτικό ή «περίεργο» όνομα (δεδομένα χρήστη / ανεβασμένο εταιρικό αρχείο) χωρίς
    // εισαγωγικά παράγει shorthand που ο καμβάς **απορρίπτει χωρίς σφάλμα**, κρατώντας την
    // προηγούμενη γραμματοσειρά — λάθος γράμματα, καμία ένδειξη πουθενά.
    expect(tableCellFont(12, false, false, 'Liberation Sans')).toBe('12px "Liberation Sans"');
    expect(tableCellFont(12, false, false, '2Fast Sans')).toContain('"2Fast Sans"');
    expect(tableCellFont(12, false)).toBe('12px "arial"');
  });

  it('Γ6 — η προεπιλογή απούσας οικογένειας είναι Η ΙΔΙΑ με του μετρητή (`arial`)', () => {
    expect(tableTextFont(CAP_PX, false, false).css)
      .toBe(tableTextFont(CAP_PX, false, false, 'arial').css);
  });
});
