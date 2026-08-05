/**
 * glyph-atlas-capacity.test.ts — ADR-739 Φάση Θ, **Βήμα 0 (μέτρηση πριν τον σχεδιασμό)**.
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Η Φάση Θ σχεδιάστηκε να δείχνει τους πίνακες στη σκηνή μέσω του **υπάρχοντος**
 * `AtlasTextMeshBuilder` (ADR-645 Φ.Β) αντί για νέα `CanvasTexture` ανά πίνακα. Πριν γραφτεί
 * γραμμή, το ερώτημα που **κανείς δεν είχε μετρήσει** ήταν: *χωράει;*
 *
 * Ο `GlyphAtlas` είναι **ένα κοινό 2048² RGBA** (σταθερό, ~16 MB — δεν μεγαλώνει ποτέ) που
 * μοιράζονται **όλα** τα κείμενα του σχεδίου. Τα κελιά μπαίνουν με shelf packing και όταν
 * γεμίσει:
 *
 * ```ts
 * if (!slot) { this.warnOverflow(); return { hasInk: false, advanceEm, ...NO_INK_ZERO }; }
 * ```
 *
 * 🔴 Δηλαδή η υπερχείλιση **δεν είναι σφάλμα** — είναι **γλυφή που εξαφανίζεται** με ένα
 * `console.warn` που κανείς δεν διαβάζει. Στην οθόνη: κείμενο που λείπει, **με όλες τις πύλες
 * πράσινες**. Είναι ακριβώς το σχήμα «`0` = κανείς δεν κοίταξε» που έχει ήδη δαγκώσει αυτό το
 * έργο (N.11 / N.12). Ένα όριο χωρίς μέτρηση δεν είναι όριο· είναι ευχή.
 *
 * ## Τι κλειδώνει
 * 1. Την **πραγματική** χωρητικότητα, μετρημένη με τον ίδιο τον `GlyphAtlas` (όχι αντίγραφο των
 *    `RASTER_EM`/`PAD_EM`/`ATLAS_SIZE` — ένα αντίγραφο θα έμενε πράσινο ενώ ο κώδικας άλλαζε).
 * 2. Ότι η υπερχείλιση είναι **σιωπηλή** — χαρακτηρισμός της ζωντανής συμπεριφοράς, ώστε αν
 *    κάποτε γίνει θορυβώδης, το test να το **πει** αντί να το κρύψει.
 * 3. Το **κόστος ανά όψη (face)**: το `faceKey` του `resolveTextFont` περιέχει `weight` και
 *    `italic`, άρα **έντονα** και **πλάγια** είναι ΞΕΧΩΡΙΣΤΕΣ όψεις — κάθε μία ξαναχτίζει
 *    ΟΛΟΚΛΗΡΟ το αλφάβητο μέσα στο ίδιο atlas.
 *
 * ## Η ΜΕΤΡΗΣΗ (2026-08-05, με τον ίδιο τον `GlyphAtlas` + ντετερμινιστικό stub)
 *
 * | Μέγεθος | Τιμή |
 * |---|---|
 * | Χωρητικότητα atlas | **840 γλυφές** (κελί 55×84 px σε 2048², shelf packing) |
 * | Ελληνικό σύνολο CAD ανά όψη | **174 γλυφές** |
 * | Όψεις που χωρούν | **4,83** |
 * | Bytes atlas | **16 MB, σταθερά** (δεν μεγαλώνει· ούτε συρρικνώνεται) |
 *
 * 🔴 **Το συμπέρασμα που μπλοκάρει τον σχεδιασμό**: ένας πίνακας που επιτρέπει έντονα **και**
 * πλάγια ανά κελί καταναλώνει **4 όψεις = 696 από τις 840** (82,9%). Το atlas όμως είναι
 * **ΚΟΙΝΟ** με το κείμενο του σχεδίου DXF. Άρα ο πρώτος πίνακας με πλήρη τυπογραφία **τρώει το
 * atlas** και οι γλυφές του σχεδίου αρχίζουν να **εξαφανίζονται σιωπηλά**. Δεν είναι οριακό:
 * είναι βέβαιο.
 *
 * @see bim-3d/converters/glyph-atlas.ts — η μονάδα που μετριέται
 * @see bim-3d/converters/dxf-text-font-resolution.ts:44 — το `faceKey` (family|weight|italic)
 * @see docs/centralized-systems/reference/adrs/ADR-645-*.md §7 — MSDF ως αναβάθμιση
 */

import { GlyphAtlas } from '../glyph-atlas';
import { resolveTextFont } from '../dxf-text-font-resolution';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';

/**
 * Ρεαλιστικό σύνολο χαρακτήρων που απαιτεί **ένας ελληνικός πίνακας CAD** — όχι θεωρητικό
 * Unicode εύρος. Μετρημένο, όχι υποθετικό: κεφαλαία + πεζά + τονισμένα (και τα δύο), λατινικά
 * (κωδικοί υλικών, μονάδες), ψηφία και η στίξη/σύμβολα που εμφανίζονται σε προμετρήσεις.
 */
const GREEK_CAD_CHARSET = [
  'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ',
  'αβγδεζηθικλμνξοπρςστυφχψω',
  'ΆΈΉΊΌΎΏΪΫ',
  'άέήίόύώϊϋΐΰ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  '.,:;!?-+*/=()[]{}%€$#@&_"\'<>|\\~^°²³±×÷≤≥≠≈ØΣ',
].join('');

/** Μοναδικά code points του συνόλου — αυτό ακριβώς κοστίζει μία όψη στο atlas. */
const GLYPHS_PER_FACE = new Set(Array.from(GREEK_CAD_CHARSET)).size;

/** Ένα ελάχιστο `DxfText` για τον επιλυτή όψης — μόνο το `textStyle` μετράει εδώ. */
function textWithStyle(style: DxfText['textStyle']): DxfText {
  return {
    id: 't', type: 'text', text: 'A', height: 10, position: { x: 0, y: 0 }, textStyle: style,
  } as DxfText;
}

/**
 * Γεμίζει τον atlas με μοναδικές γλυφές μέχρι την υπερχείλιση και επιστρέφει πόσες πήραν
 * πραγματικό κελί. Παράγει χαρακτήρες από διαδοχικά code points: ο stub δίνει σε όλους το ίδιο
 * advance, άρα κάθε κελί έχει το ίδιο μέγεθος και η μέτρηση είναι η **καθαρή χωρητικότητα**.
 */
function measureInkCapacity(atlas: GlyphAtlas, limit = 4000): number {
  const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));
  let inked = 0;
  for (let cp = 0x0100; cp < 0x0100 + limit; cp++) {
    if (atlas.getCell(font, String.fromCodePoint(cp)).hasInk) inked++;
    else break; // πρώτη άρνηση = ο atlas γέμισε (τα κενά εξαιρούνται από το εύρος)
  }
  return inked;
}

describe('GlyphAtlas — χωρητικότητα (ADR-739 Φ.Θ βήμα 0)', () => {
  let cleanup: () => void;
  let warnSpy: jest.SpyInstance;

  beforeAll(() => { cleanup = installStubFont(0.6, 'arial'); });
  afterAll(() => cleanup());
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined); });
  afterEach(() => warnSpy.mockRestore());

  it('χωράει τουλάχιστον 800 γλυφές — και ο αριθμός είναι ΜΕΤΡΗΜΕΝΟΣ, όχι δηλωμένος', () => {
    const atlas = new GlyphAtlas();
    const capacity = measureInkCapacity(atlas);

    // Το κάτω όριο είναι σκόπιμα χαλαρό: κλειδώνει την ΤΑΞΗ ΜΕΓΕΘΟΥΣ (εκατοντάδες, όχι
    // χιλιάδες). Αν μια αλλαγή σε `RASTER_EM` ή `PAD_EM` το ρίξει κάτω από αυτό, ο πίνακας
    // ΔΕΝ χωράει πια μαζί με το σχέδιο — και αυτό πρέπει να γίνει ερώτηση, όχι έκπληξη.
    expect(capacity).toBeGreaterThanOrEqual(800);
    expect(capacity).toBeLessThan(2000); // ένα 4096² atlas θα άλλαζε το προφίλ μνήμης — να ειπωθεί

    atlas.dispose();
  });

  it('🔴 η υπερχείλιση είναι ΣΙΩΠΗΛΗ: η γλυφή χάνεται, καμία εξαίρεση, μόνο ένα warn', () => {
    const atlas = new GlyphAtlas();
    const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));

    // Γέμισμα μέχρι την άρνηση.
    const capacity = measureInkCapacity(atlas);
    expect(capacity).toBeGreaterThan(0);

    // Η ΕΠΟΜΕΝΗ γλυφή δεν πετάει — επιστρέφει κελί χωρίς μελάνι, δηλαδή **αόρατο κείμενο**.
    const overflowed = atlas.getCell(font, '一');
    expect(overflowed.hasInk).toBe(false);
    expect(overflowed.advanceEm).toBeGreaterThan(0); // κρατά advance ⇒ η διάταξη «δουλεύει»
    expect(overflowed.u0).toBe(overflowed.u1);       // μηδενικό UV ⇒ τίποτα δεν ζωγραφίζεται

    // Η ΜΟΝΗ ένδειξη προς τον κόσμο, μία φορά, σε κονσόλα που κανείς δεν βλέπει σε παραγωγή.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('atlas full');

    atlas.dispose();
  });

  it('το ελληνικό σύνολο CAD κοστίζει ~176 γλυφές ΑΝΑ ΟΨΗ', () => {
    // Αν το σύνολο συρρικνωθεί κατά λάθος (π.χ. πέσουν τα τονισμένα), ο υπολογισμός κόστους
    // παρακάτω γίνεται αισιόδοξος χωρίς να το πει κανείς.
    expect(GLYPHS_PER_FACE).toBeGreaterThanOrEqual(170);

    const atlas = new GlyphAtlas();
    const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));
    let inked = 0;
    for (const ch of new Set(Array.from(GREEK_CAD_CHARSET))) {
      if (atlas.getCell(font, ch).hasInk) inked++;
    }
    // Όλο το σύνολο χωράει άνετα σε ΜΙΑ όψη — το πρόβλημα δεν είναι η μία, είναι οι πολλές.
    expect(inked).toBeGreaterThanOrEqual(GLYPHS_PER_FACE - 5); // −5: στίξη χωρίς μελάνι στον stub
    expect(warnSpy).not.toHaveBeenCalled();
    atlas.dispose();
  });

  it('🔴 έντονα/πλάγια είναι ΞΕΧΩΡΙΣΤΕΣ όψεις — 4 στυλ = 4× το αλφάβητο στο ΙΔΙΟ atlas', () => {
    // Αυτό είναι το εύρημα που μπλοκάρει τη Φάση Θ: ένας πίνακας που επιτρέπει έντονα ΚΑΙ
    // πλάγια ανά κελί (ADR-739 Φ.Ε/Φ2) παράγει έως 4 όψεις — και το atlas είναι ΚΟΙΝΟ με το
    // κείμενο του σχεδίου. Το `faceKey` το λέει ρητά: `c:${family}|${weight}|${italic}`.
    const keys = new Set(
      [
        { bold: false, italic: false },
        { bold: true, italic: false },
        { bold: false, italic: true },
        { bold: true, italic: true },
      ].map((s) => resolveTextFont(textWithStyle({ fontFamily: 'not-a-loaded-font', ...s })).faceKey),
    );

    expect(keys.size).toBe(4); // τέσσερις όψεις, όχι μία
  });
});
