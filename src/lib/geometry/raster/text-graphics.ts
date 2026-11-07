/**
 * =============================================================================
 * ΔΙΑΧΩΡΙΣΜΟΣ ΚΕΙΜΕΝΟΥ / ΓΡΑΦΙΚΩΝ — ΥΠΟΨΗΦΙΟΙ ΓΛΥΦΟΙ (SSoT)
 * =============================================================================
 *
 * Πάνω σε μάσκα από την οποία ο καλών έχει **ήδη σβήσει** τις γραμμές (ό,τι εξήγησαν οι ζώνες της Φ2), οι συνεκτικές
 * συνιστώσες με μέγεθος και πυκνότητα «γλύφου» είναι οι υποψήφιοι χαρακτήρες: ψηφία διαστάσεων, γράμματα ονομάτων.
 * Είναι το κριτήριο μεγέθους του Fletcher–Kasturi (1988), πάνω στον **ΕΝΑ** ετικετοποιητή (`componentStats`, 8-γειτονιά).
 *
 * 🔑 **Κανένα όριο σε mm.** Τα όρια έρχονται από τον καλούντα, σχετικά με την τυπική πινελιά και το μέγεθος του σχεδίου:
 * η κλίμακα μπορεί να είναι άγνωστη (ADR-929 Δ4).
 *
 * @module lib/geometry/raster/text-graphics
 */

import { componentStats } from './component-stats';

/** Ένας υποψήφιος χαρακτήρας: κέντρο και διαστάσεις του πλαισίου του, σε px (κλειστό πλαίσιο ⇒ +1). */
export interface Glyph {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly area: number;
}

export interface GlyphOptions {
  /** Ελάχιστο εμβαδόν (κελιά): κάτω από αυτό είναι κόκκος θορύβου. */
  readonly minAreaPx: number;
  /** Η **μεγάλη** πλευρά του πλαισίου στο `[minSidePx, maxSidePx]`. */
  readonly minSidePx: number;
  readonly maxSidePx: number;
  /** Ελάχιστη πυκνότητα (εμβαδόν / πλαίσιο): ένα τόξο ή μια μακριά διαγώνιος είναι αραιά, ένας χαρακτήρας όχι. */
  readonly minDensity: number;
}

/** Οι υποψήφιοι γλύφοι μιας μάσκας. Ντετερμινιστική σειρά: η σειρά των ετικετών (σάρωση γραμμή-γραμμή). */
export function glyphCandidates(mask: Uint8Array, cols: number, rows: number, o: GlyphOptions): Glyph[] {
  const { count, areas, boxes } = componentStats(mask, cols, rows, 8);
  const out: Glyph[] = [];
  for (let l = 1; l <= count; l++) {
    const b = boxes[l];
    const width = b.maxX - b.minX + 1;
    const height = b.maxY - b.minY + 1;
    const side = Math.max(width, height);
    if (areas[l] < o.minAreaPx || side < o.minSidePx || side > o.maxSidePx) continue;
    if (areas[l] / (width * height) < o.minDensity) continue;
    out.push({ cx: (b.minX + b.maxX + 1) / 2, cy: (b.minY + b.maxY + 1) / 2, width, height, area: areas[l] });
  }
  return out;
}

/** Ο διάμεσος της μεγάλης πλευράς των γλύφων: το τυπικό ύψος κειμένου του σχεδίου. `null` ⇒ κανένας γλύφος. */
export function medianGlyphSize(glyphs: readonly Glyph[]): number | null {
  if (glyphs.length === 0) return null;
  const sides = glyphs.map((g) => Math.max(g.width, g.height)).sort((a, b) => a - b);
  return sides[Math.floor(sides.length / 2)];
}
