/**
 * glyph-atlas-notdef.ts — το κελί «λείπει γλυφή» (tofu) του κοινού atlas (ADR-739 Φ.Θ / Φ1).
 *
 * ## Γιατί tofu και όχι κενό
 * Όταν το atlas γεμίσει, ο `GlyphAtlas` γύριζε κελί **χωρίς μελάνι**: η διάταξη συνέχιζε να
 * «δουλεύει» (το advance διατηρούνταν) και ο χαρακτήρας απλώς **δεν ζωγραφιζόταν**. Σε πίνακα
 * ποσοτήτων αυτό δεν είναι κενό — είναι **αλλαγμένος αριθμός**: το `17` γίνεται `1`, και ο
 * μηχανικός διαβάζει λάθος τιμή χωρίς κανένα σημάδι.
 *
 * **Καμία μηχανή τυπογραφίας δεν αποδίδει την απουσία ως κενό.** Ο browser, το FreeType, το
 * DirectWrite, το Unity TextMeshPro — όλα βάφουν `.notdef` (το «tofu» ▯). Το ίδιο κάνουμε: ο
 * χρήστης βλέπει *«λείπει γλυφή»*, δεν διαβάζει λάθος διάσταση. Είναι η ίδια αρχή με το
 * ADR-720 («ένα κατασκευασμένο νούμερο σε παραδοτέο είναι μέτρηση που κανείς δεν πήρε»), μια
 * στάθμη πιο κάτω.
 *
 * ## Γιατί δεσμεύεται ΠΡΩΤΟ
 * Το κελί που δηλώνει «γέμισα» δεν επιτρέπεται να χρειάζεται χώρο τη στιγμή που δεν υπάρχει
 * χώρος. Δεσμεύεται στο **πρώτο** πράγμα που μπαίνει στο atlas, ώστε να είναι πάντα διαθέσιμο.
 *
 * @module subapps/dxf-viewer/bim-3d/converters/glyph-atlas-notdef
 * @see bim-3d/converters/glyph-atlas.ts — ο μοναδικός καταναλωτής
 */

/** Πλάτος του tofu ÷ em — στενότερο από μέσο γράμμα, ώστε να μη χαλά τη ροή της γραμμής. */
const NOTDEF_W_EM = 0.5;
/** Ύψος του tofu ÷ em — από τη γραμμή βάσης προς τα πάνω, ύψος κεφαλαίου. */
const NOTDEF_H_EM = 0.7;
/** Πάχος περιγράμματος ÷ em — ορατό σε μικρό μέγεθος, χωρίς να γεμίζει το κουτί. */
const NOTDEF_STROKE_EM = 0.06;

/** Οι διαστάσεις του κελιού σε px για δεδομένο em ραστεροποίησης. */
export function notdefCellSizePx(rasterEm: number): { wPx: number; hPx: number } {
  return {
    wPx: Math.ceil(NOTDEF_W_EM * rasterEm),
    hPx: Math.ceil(NOTDEF_H_EM * rasterEm),
  };
}

/**
 * Οι em-μετρικές του κελιού, στη σύμβαση του `GlyphCell` (γραμμή βάσης στο 0, y προς τα πάνω).
 * Καθαρή — το `emitGlyphQuad` τις δέχεται αυτούσιες, όπως κάθε άλλο κελί.
 */
export function notdefCellMetricsEm(): {
  advanceEm: number; leftEm: number; rightEm: number; topEm: number; bottomEm: number;
} {
  return {
    advanceEm: NOTDEF_W_EM,
    leftEm: 0,
    rightEm: NOTDEF_W_EM,
    topEm: NOTDEF_H_EM,
    bottomEm: 0, // κάθεται στη γραμμή βάσης
  };
}

/**
 * Ζωγραφίζει το tofu (κενό ορθογώνιο) στο `(px, py)` του atlas καμβά.
 *
 * Λευκό περίγραμμα, όπως κάθε γλυφή του atlas: η κάλυψη ζει στο άλφα και ο χρωματισμός γίνεται
 * ανά κορυφή στο mesh — άρα το tofu παίρνει **το χρώμα του κειμένου που αντικαθιστά** και
 * φαίνεται ότι ανήκει εκεί, αντί να μοιάζει με ξένο σφάλμα.
 */
export function drawNotdefCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  rasterEm: number,
): void {
  const { wPx, hPx } = notdefCellSizePx(rasterEm);
  const lw = Math.max(1, Math.round(NOTDEF_STROKE_EM * rasterEm));
  const half = lw / 2;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lw;
  // Το inset κατά μισό πάχος κρατά ΟΛΟ το περίγραμμα μέσα στο δεσμευμένο κελί: ένα
  // `strokeRect` κεντράρει τη γραμμή στην ακμή, οπότε χωρίς αυτό το μισό πάχος θα έβαφε
  // γειτονικό κελί — δηλαδή θα λέρωνε άσχετη γλυφή του atlas.
  ctx.strokeRect(px + half, py + half, Math.max(1, wPx - lw), Math.max(1, hPx - lw));
  ctx.restore();
}
