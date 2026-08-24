/**
 * FontResolver — maps a text entity's font family to a loaded opentype.Font
 * (ADR-530), reusing the existing FontCache + SHX substitution SSoT.
 *
 * Resolution order (Revit/AutoCAD model — "the real font if present, else the
 * closest open substitute"):
 *   1. Direct cache hit on the exact family (e.g. a company-uploaded font).
 *   2. SHX / unknown family → `lookupSubstitute()` catch-all → substitute family
 *      (e.g. romans.shx / arial → "Liberation Sans", txt.shx → "Liberation Mono").
 *
 * Returns `null` when no loaded font matches — the caller then falls back to the
 * CSS `ctx.fillText` path (zero regression). Un-bundled faces (bold / italic /
 * bold-italic) resolve to `null` **because the face is absent, not because the
 * resolver refuses to look** (ADR-799): drop the face into the FontCache under
 * `«<substitute> Bold»` / `«… Italic»` / `«… Bold Italic»` and it is used.
 *
 * @module text-engine/fonts/font-resolver
 */

import type { Font } from 'opentype.js';
import { fontCache } from './font-cache';
import { lookupSubstitute } from './font-substitution-table';

export interface FontResolveStyle {
  bold?: boolean;
  italic?: boolean;
}

export interface ResolvedFont {
  font: Font;
  /** The FontCache name the font was found under — used as the glyph-cache key. */
  cacheName: string;
}

/**
 * Το ΟΝΟΜΑ ΟΨΗΣ που ζητά ένα στυλ πάνω σε μια οικογένεια υποκατάστασης.
 *
 * 🔴 ADR-799 — **ΣΥΜΜΕΤΡΙΑ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ ΣΤΗΝ ΠΑΡΑΓΩΓΗ.**
 *
 * Μέχρι τις 2026-08-25 ο κλάδος του `italic` **βραχυκύκλωνε πριν κοιτάξει**
 * (`if (style?.italic) return null`), ενώ ο κλάδος του `bold` **έψαχνε** την όψη και
 * επέστρεφε `null` μόνο αν έλειπε. Δύο απαντήσεις στο ίδιο ερώτημα: το docblock υπόσχεται
 * «`null` **ώσπου να μπουν** οι όψεις», αλλά για το πλάγιο η υπόσχεση ήταν **ανεκπλήρωτη
 * εξ ορισμού** — μια όψη στην κρυφή μνήμη δεν θα χρησιμοποιούνταν ΠΟΤΕ.
 *
 * ⚠️ **Μηδενική αλλαγή συμπεριφοράς σήμερα, μετρημένη**: ο μόνος γραφέας της κρυφής μνήμης
 * είναι το `loadFont`, και ο μόνος παραγωγικός καλών του (`CAD_SUBSTITUTE_FONTS`) γράφει
 * **ένα** όνομα, «Liberation Sans». Καμία διαδρομή δεν παράγει «… Italic» ⇒ η αναζήτηση
 * αστοχεί ⇒ `null`, ταυτόσημα με πριν. Αλλάζει **μόνο** ότι μια όψη που ΥΠΑΡΧΕΙ πλέον
 * βρίσκεται — που είναι ακριβώς η γραμμένη πρόθεση.
 */
function faceNameFor(substitute: string, bold: boolean, italic: boolean): string {
  let face = substitute;
  if (bold && !/bold$/i.test(face)) face = `${face} Bold`;
  if (italic && !/italic$/i.test(face)) face = `${face} Italic`;
  return face;
}

/** Resolve a text entity's font family to a loaded glyph font, or null. */
export function resolveEntityFont(
  family: string | undefined,
  style?: FontResolveStyle,
): ResolvedFont | null {
  const wantBold = !!style?.bold;
  const wantItalic = !!style?.italic;
  const name = (family && family.trim()) || 'arial';

  // 1. Direct hit on the exact family (company-uploaded / referenced font).
  //    Παρακάμπτεται όταν ζητείται ΟΨΗ (bold/italic): το αρχείο κάτω από το σκέτο όνομα
  //    είναι η ΚΑΝΟΝΙΚΗ όψη, και το να ζωγραφιστεί ως έντονο/πλάγιο θα ήταν σιωπηλό ψέμα.
  if (!wantBold && !wantItalic) {
    const direct = fontCache.get(name);
    if (direct) return { font: direct, cacheName: name };
  }

  // 2. Reuse the substitution SSoT (catch-all '*' → Liberation Sans) + η ζητούμενη όψη.
  const substitute = lookupSubstitute(name).substituteFamily;
  const target = faceNameFor(substitute, wantBold, wantItalic);
  const subFont = fontCache.get(target);
  if (subFont) return { font: subFont, cacheName: target };

  return null;
}
