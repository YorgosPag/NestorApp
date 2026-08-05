/**
 * glyph-atlas-overflow.test.ts — ADR-739 Φ.Θ / **Φ1: η υπερχείλιση έγινε ορατή**.
 *
 * ## Τι φυλάει
 * Πριν το Φ1 ο γεμάτος `GlyphAtlas` γύριζε `hasInk:false` + **ένα** `console.warn`. Δηλαδή:
 * **κείμενο που εξαφανίζεται από την οθόνη με όλες τις πύλες πράσινες** — και σε πίνακα
 * ποσοτήτων το `17` γίνεται `1`, που δεν είναι κενό αλλά **λάθος τιμή**.
 *
 * Το Φ1 το γύρισε ανάποδα σε δύο επίπεδα, και **και τα δύο** χρειάζονται πύλη:
 * 1. **Στα pixels** — κελί `▯` (tofu) με πραγματικό μελάνι και UV.
 * 2. **Στο μοντέλο** — `glyph-atlas-report-store`, με μετρητές και δείγμα των χαμένων.
 *
 * ## Τι σπάει αν φύγει αυτό το αρχείο
 * Η επιστροφή στο `hasInk:false` περνά **κάθε** υπάρχον test (κανένα δεν ρωτούσε), κάθε
 * lint, κάθε ratchet — και βγαίνει στην παραγωγή ως αόρατη αλλοίωση αριθμών. Είναι το ακριβές
 * σχήμα «`0` = κανείς δεν κοίταξε» που το CLAUDE.md ονομάζει τέσσερις φορές.
 *
 * @see bim-3d/converters/glyph-atlas.ts — `admitNotdef` / `reserveNotdef`
 * @see bim-3d/converters/glyph-atlas-report-store.ts — η κατάσταση
 */

import { GlyphAtlas } from '../glyph-atlas';
import { resolveTextFont } from '../dxf-text-font-resolution';
import {
  getGlyphAtlasReport,
  hasGlyphAtlasLoss,
  subscribeGlyphAtlasReport,
  clearGlyphAtlasReport,
  MISS_REPORT_CAP,
} from '../glyph-atlas-report-store';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';

function textWithStyle(style: DxfText['textStyle']): DxfText {
  return {
    id: 't', type: 'text', text: 'A', height: 10, position: { x: 0, y: 0 }, textStyle: style,
  } as DxfText;
}

/** Γεμίζει τον atlas μέχρι να καταγραφεί η πρώτη απώλεια· επιστρέφει πόσες ζητήθηκαν. */
function fillUntilOverflow(atlas: GlyphAtlas, limit = 4000): number {
  const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));
  let asked = 0;
  for (let cp = 0x0100; cp < 0x0100 + limit; cp++) {
    atlas.getCell(font, String.fromCodePoint(cp));
    asked++;
    if (atlas.getStats().missingCount > 0) break;
  }
  return asked;
}

describe('GlyphAtlas — υπερχείλιση (ADR-739 Φ.Θ / Φ1)', () => {
  let cleanup: () => void;

  beforeAll(() => { cleanup = installStubFont(0.6, 'arial'); });
  afterAll(() => cleanup());
  beforeEach(() => clearGlyphAtlasReport());

  it('η χαμένη γλυφή παίρνει ΟΡΑΤΟ κελί tofu — όχι κενό', () => {
    const atlas = new GlyphAtlas();
    fillUntilOverflow(atlas);
    const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));

    const lost = atlas.getCell(font, '漢');
    expect(lost.hasInk).toBe(true);
    expect(lost.u1).toBeGreaterThan(lost.u0);
    expect(lost.v1).toBeGreaterThan(lost.v0);
    // Το tofu κάθεται στη γραμμή βάσης και έχει ύψος κεφαλαίου — δεν βυθίζεται ούτε πετάει.
    expect(lost.bottomEm).toBe(0);
    expect(lost.topEm).toBeGreaterThan(0);

    atlas.dispose();
  });

  it('ο store μαθαίνει: μετρητές + δείγμα με όψη και χαρακτήρα', () => {
    const atlas = new GlyphAtlas();
    fillUntilOverflow(atlas);

    const report = getGlyphAtlasReport();
    expect(hasGlyphAtlasLoss(report)).toBe(true);
    expect(report.missingCount).toBeGreaterThan(0);
    expect(report.requested).toBeGreaterThan(report.admitted);
    // Το δείγμα ονομάζει ΤΙ χάθηκε — αλλιώς ο μηχανικός ξέρει μόνο «κάτι».
    expect(report.missing.length).toBeGreaterThan(0);
    expect(report.missing[0].faceKey).toContain('arial');
    expect(report.missing[0].char).toHaveLength(1);

    atlas.dispose();
  });

  it('η λίστα δειγμάτων είναι ΚΟΜΜΕΝΗ αλλά ο μετρητής λέει την αλήθεια', () => {
    const atlas = new GlyphAtlas();
    fillUntilOverflow(atlas);
    const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));

    // Πολύ περισσότερες απώλειες από το cap.
    for (let cp = 0x4e00; cp < 0x4e00 + MISS_REPORT_CAP * 3; cp++) {
      atlas.getCell(font, String.fromCodePoint(cp));
    }

    const report = getGlyphAtlasReport();
    // Η λίστα δεν μεγαλώνει απεριόριστα (θα ήταν διαρροή σε δομή που ζει όσο το αρχείο)…
    expect(report.missing.length).toBeLessThanOrEqual(MISS_REPORT_CAP);
    // …αλλά ο αριθμός ΔΕΝ ψεύδεται. Το να αναφέρεις 50 ενώ χάθηκαν 200 είναι το ίδιο σφάλμα
    // με το να μην αναφέρεις τίποτα — απλώς πιο πειστικό.
    expect(report.missingCount).toBeGreaterThan(MISS_REPORT_CAP);

    atlas.dispose();
  });

  it('ειδοποιεί τους συνδρομητές (leaf subscriber, ADR-040)', () => {
    const atlas = new GlyphAtlas();
    const seen: number[] = [];
    const unsub = subscribeGlyphAtlasReport(() => seen.push(getGlyphAtlasReport().missingCount));

    fillUntilOverflow(atlas);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBeGreaterThan(0);
    unsub();
    atlas.dispose();
  });

  it('το dispose καθαρίζει — το banner δεν επιβιώνει του σχεδίου που το γέννησε', () => {
    const atlas = new GlyphAtlas();
    fillUntilOverflow(atlas);
    expect(hasGlyphAtlasLoss()).toBe(true);

    atlas.dispose();

    // Αλλιώς ο χρήστης ανοίγει ΑΛΛΟ σχέδιο και βλέπει προειδοποίηση για το προηγούμενο.
    expect(hasGlyphAtlasLoss()).toBe(false);
    expect(getGlyphAtlasReport().missingCount).toBe(0);
  });

  it('χωρίς υπερχείλιση: καμία απώλεια, καθαρή αναφορά', () => {
    const atlas = new GlyphAtlas();
    const font = resolveTextFont(textWithStyle({ fontFamily: 'arial' }));
    for (const ch of 'ΑΒΓΔΕαβγδε0123456789') atlas.getCell(font, ch);

    const report = getGlyphAtlasReport();
    expect(hasGlyphAtlasLoss(report)).toBe(false);
    expect(report.missing).toHaveLength(0);
    expect(atlas.getStats().admitted).toBe(atlas.getStats().requested);

    atlas.dispose();
  });
});
