/**
 * @fileoverview **ΤΑ ΜΑΘΗΜΑΤΙΚΑ ΤΟΥ ΖΟΥΜ** — όρια, βήμα, ζουμ γύρω από σημείο, λογαριθμικό ρυθμιστικό. Καθαρό, μηδέν DOM.
 * @related `hooks/useZoomPan.ts` (ζουμ με CSS transform — ADR-187) · `lib/spatial-tour/viewer/tour-plan-zoom.ts` (ζουμ με
 *   στενότερο `viewBox` — ADR-884 Φ2στ-γ Γ2)
 * @module lib/geometry/zoom-pan-math
 *
 * 🔑 **ΕΝΑΣ τύπος για «το σημείο κάτω από τον δείκτη μένει ακίνητο»**, όποια κι αν είναι η αναπαράσταση:
 *   `scaleAbout(τιμή, άγκυρα, λόγος) = άγκυρα + (τιμή − άγκυρα) · λόγος`.
 *   - μετατόπιση οθόνης (CSS transform): λόγος = `επόμενο / προηγούμενο` ζουμ·
 *   - κέντρο κόσμου (`viewBox`): λόγος = `προηγούμενο / επόμενο` — το ορατό κομμάτι του κόσμου **μικραίνει** όσο μεγεθύνεις.
 *   Πριν από αυτό το αρχείο ο τύπος ζούσε γραμμένος με το χέρι μέσα στον χειριστή τροχού του `useZoomPan`.
 * 📏 **Λογαριθμικό ρυθμιστικό** (Figma · Google Maps · Matterport): κάθε ίση απόσταση στη ράγα = ίσος **λόγος** μεγέθυνσης.
 *   Γραμμική ράγα 1×–5× θα ξόδευε το 75% του μήκους της πάνω από 2× — εκεί όπου σπάνια χρειάζεται λεπτός έλεγχος.
 */

import { clamp, clamp01 } from './scalar';

export interface ZoomLimits {
  readonly min: number;
  readonly max: number;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Το ζουμ μέσα στα όρια. */
export function clampZoom(zoom: number, limits: ZoomLimits): number {
  return clamp(zoom, limits.min, limits.max);
}

/**
 * Ένα βήμα κουμπιού: **πολλαπλασιαστικό** όταν δίνεται `factor` (Figma/Revit — λίγα κλικ διασχίζουν βαθύ εύρος), αλλιώς
 * προσθετικό κατά `step`. `direction` = +1 μεγέθυνση, −1 σμίκρυνση.
 */
export function stepZoom(zoom: number, limits: ZoomLimits, direction: 1 | -1, by: { readonly factor?: number; readonly step?: number }): number {
  if (by.factor !== undefined) return clampZoom(direction > 0 ? zoom * by.factor : zoom / by.factor, limits);
  return clampZoom(zoom + direction * (by.step ?? 0), limits);
}

/** Κλιμάκωση ενός σημείου γύρω από μια άγκυρα — ο ΕΝΑΣ τύπος του «ζουμ γύρω από τον δείκτη». */
export function scaleAbout(value: Vec2, anchor: Vec2, ratio: number): Vec2 {
  return { x: anchor.x + (value.x - anchor.x) * ratio, y: anchor.y + (value.y - anchor.y) * ratio };
}

/** Ζουμ από τον τροχό: πολλαπλασιαστικό, ώστε ίσο «γύρισμα» = ίσος λόγος σε κάθε βάθος. */
export function wheelZoom(zoom: number, deltaY: number, sensitivity: number, limits: ZoomLimits): number {
  return clampZoom(zoom * (1 - deltaY * sensitivity), limits);
}

/** Ζουμ → θέση στη ράγα `[0, 1]`, λογαριθμικά. */
export function zoomToUnit(zoom: number, limits: ZoomLimits): number {
  if (limits.max <= limits.min) return 0;
  return Math.log(clampZoom(zoom, limits) / limits.min) / Math.log(limits.max / limits.min);
}

/** Θέση στη ράγα `[0, 1]` → ζουμ, λογαριθμικά (αντίστροφο του {@link zoomToUnit}). */
export function unitToZoom(unit: number, limits: ZoomLimits): number {
  return limits.min * Math.pow(limits.max / limits.min, clamp01(unit));
}

/** Ευκλείδεια απόσταση δύο σημείων (pinch). */
export function pointDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Μέσο δύο σημείων — η άγκυρα του pinch (Apple/Google Photos: μεγεθύνει εκεί που είναι τα δάχτυλα, όχι στο κέντρο). */
export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Πλάτος × ύψος σε css px. */
export interface Extent {
  readonly width: number;
  readonly height: number;
}

/**
 * **Περιορισμός pan** (Google Photos): η μετατόπιση (από το κέντρο) δεν αφήνει την άκρη του ζωγραφισμένου να μπει μέσα στο
 * κουτί. Περιθώριο ανά άξονα = `max(0, (ζωγραφισμένο − κουτί) / 2)` ⇒ όσο η εικόνα χωρά, η μετατόπιση είναι 0.
 * Το `painted` είναι ό,τι **βλέπει** ο θεατής (μετά το zoom και τη στροφή) — ο καλών το ξέρει, εδώ μόνο η γεωμετρία.
 */
export function confinePan(pan: Vec2, painted: Extent, box: Extent): Vec2 {
  return { x: confineAxis(pan.x, painted.width, box.width), y: confineAxis(pan.y, painted.height, box.height) };
}

/** Ένας άξονας του {@link confinePan}· όταν χωρά, **ακριβώς** 0 (όχι `-0` — ο θεατής δεν το βλέπει, οι άγκυρες ναι). */
function confineAxis(value: number, painted: number, box: number): number {
  const margin = Math.max(0, (painted - box) / 2);
  return margin === 0 ? 0 : clamp(value, -margin, margin);
}

/** Η ΜΙΑ συμβολοσειρά του μετασχηματισμού όψης: `translate · scale · rotate` γύρω από το κέντρο. */
export function viewTransformOf(view: { readonly pan: Vec2; readonly scale: number; readonly rotation: number }): string {
  return `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.scale}) rotate(${view.rotation}deg)`;
}

/** Η έκταση μετά από στροφή κατά πολλαπλάσιο του 90°: στα 90°/270° πλάτος και ύψος ανταλλάσσονται. */
export function quarterTurnExtent(extent: Extent, rotationDeg: number): Extent {
  const quarter = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  return quarter % 2 === 1 ? { width: extent.height, height: extent.width } : extent;
}
