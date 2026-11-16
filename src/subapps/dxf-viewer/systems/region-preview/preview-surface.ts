/**
 * preview-surface — **πάνω σε τι ζωγραφίζεται η ζώνη;** (ADR-911 §Φ3β-palette).
 *
 * Δύο ερωτήσεις, δύο καθαρές συναρτήσεις:
 *
 *   1. {@link effectivePreviewSurfaceHex} — το χρώμα που βλέπει **πραγματικά** το μάτι κάτω από τη ζώνη: το χαρτί
 *      ενός ορατού υποβάθρου, συνθεμένο με τη διαφάνειά του πάνω στον καμβά (ίδιος τύπος με τον browser), αλλιώς ο
 *      ίδιος ο καμβάς (ή το χαρτί, σε print pass — `liveDrawingSurfaceHex`).
 *   2. {@link choosePreviewSurface} — η παλέτα με τη **μεγαλύτερη ελάχιστη** αντίθεση απέναντι σε αυτό το χρώμα.
 *      Κανένα «μαγικό» κατώφλι φωτεινότητας: η ίδια η μέτρηση WCAG αποφασίζει, για **κάθε** φόντο — και για ενδιάμεσα
 *      (υπόβαθρο σε 50%, θέμα καμβά `#1a1a1a`, λευκός καμβάς).
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store· το ζωντανό καλώδιο ζει στο `usePreviewSurface`.
 *
 * @see ./preview-zone-style.ts — οι δύο παλέτες
 * @see ../../config/adaptive-entity-color.ts — `liveDrawingSurfaceHex` (ADR-509, το ίδιο ερώτημα για τις οντότητες)
 */

import { compositeOverHex, contrastRatio, parseHex } from '../../config/color-math';
import {
  PREVIEW_SURFACE_KEYS,
  PREVIEW_SURFACES,
  type PreviewSurface,
} from './preview-zone-style';

/** Ένα ορατό υπόβαθρο κάτω από τις ζώνες: μόνο η διαφάνειά του μετρά (το χαρτί του είναι το `light.surface`). */
export interface PreviewUnderlay {
  /** 0..1 */
  readonly opacity: number;
}

/**
 * Το χρώμα κάτω από τη ζώνη. Υπόβαθρο ⇒ χαρτί (`PREVIEW_SURFACES.light.surface`) με τη διαφάνειά του πάνω στον καμβά·
 * αλλιώς ο καμβάς αυτούσιος. Άκυρο χρώμα καμβά ⇒ επιστρέφεται αυτούσιο (ο επιλογέας θα το κρίνει, δεν μαντεύουμε).
 */
export function effectivePreviewSurfaceHex(canvasHex: string, underlay: PreviewUnderlay | null): string {
  if (underlay === null || underlay.opacity <= 0) return canvasHex;
  const paper = parseHex(PREVIEW_SURFACES.light.surface);
  if (paper === null || parseHex(canvasHex) === null) return canvasHex;
  return compositeOverHex({ ...paper, a: Math.min(1, underlay.opacity) }, canvasHex);
}

/** Η χειρότερη αντίθεση μιας παλέτας απέναντι σε ένα φόντο (WCAG 1.4.11). */
function worstContrast(surface: PreviewSurface, backgroundHex: string): number {
  return Math.min(...Object.values(PREVIEW_SURFACES[surface].stroke).map((hex) => contrastRatio(hex, backgroundHex)));
}

/**
 * Η παλέτα που διαβάζεται **καλύτερα** πάνω σε αυτό το φόντο: η μεγαλύτερη ελάχιστη αντίθεση. Ισοπαλία ⇒ η πρώτη
 * του `PREVIEW_SURFACE_KEYS` (σταθερό αποτέλεσμα, καμία εξάρτηση από σειρά αντικειμένου).
 */
export function choosePreviewSurface(backgroundHex: string): PreviewSurface {
  let best: PreviewSurface = PREVIEW_SURFACE_KEYS[0];
  let bestScore = -Infinity;
  for (const surface of PREVIEW_SURFACE_KEYS) {
    const score = worstContrast(surface, backgroundHex);
    if (score > bestScore) {
      best = surface;
      bestScore = score;
    }
  }
  return best;
}
