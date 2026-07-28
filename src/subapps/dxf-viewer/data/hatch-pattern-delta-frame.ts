/**
 * 🏢 SSoT: **σε ποιο σύστημα αξόνων ζει το `PatternLine.delta`** — PAT (τοπικό) ↔ DXF (world).
 *
 * ## Το πρόβλημα που λύνει (ADR-507 / ADR-647 — μετρημένο, όχι θεωρητικό)
 *
 * Ο τύπος {@link PatternLine} έχει **ΜΙΑ** δηλωμένη σύμβαση, αυτή του **αρχείου `.pat`**:
 *
 * ```
 * angle, x-origin, y-origin, delta-x, delta-y [, dash1, …]
 *   delta-x = μετατόπιση ΚΑΤΑ ΜΗΚΟΣ της γραμμής ανά διαδοχική παράλληλη (stagger)
 *   delta-y = ΚΑΘΕΤΗ απόσταση μεταξύ των παράλληλων («πόσο πυκνά»)
 * ```
 *
 * Δηλαδή `delta` = **τοπικό** διάνυσμα, στο σύστημα της ίδιας της γραμμής. Όλος ο πυρήνας το
 * θεωρεί δεδομένο: το `buildPatternLineSegments` παίρνει `dy = |delta[1]|` ως το βήμα, το
 * `hatchMinWorldSpacing` το ίδιο, το `transformInlinePattern` στρέφει το μοτίβο κάνοντας
 * `angle + angleDeg` και **αφήνει το `delta` άθικτο** (σωστό ΜΟΝΟ σε τοπικό frame).
 *
 * **Το DXF όμως αποθηκεύει το ίδιο μέγεθος σε WORLD συντεταγμένες.** Οι κωδικοί `45`/`46` του
 * HATCH είναι το τοπικό `[delta-x, delta-y]` **ήδη στραμμένο κατά τη γωνία της γραμμής** (`53`).
 * Δεν είναι ερμηνεία μας — είναι η συμπεριφορά του AutoCAD, επιβεβαιωμένη σε τρία ανεξάρτητα σημεία:
 *
 * 1. **ezdxf** (`render/hatching.py`, MIT — η αναφορική υλοποίηση): *«The hatch pattern parameters
 *    are already **scaled and rotated** for direct [use]. The stored scale and angle is just for
 *    reconstructing the base pattern.»* — και χειρίζεται το `offset` **ως διάνυσμα**
 *    (`origin + offset * factor`), με κάθετη απόσταση από **cross product**, ΟΧΙ από `offset.y`.
 * 2. **Πραγματικό αρχείο AutoCAD** (`47_ergasia.dxf`, ANSI31 @ `41=0.4`):
 *    `45=-0.0353553, 46=0.0353553` ⇒ `|delta| = 0,05` = `0.125″ × 0.4` ✓, με διεύθυνση **135°**
 *    = κάθετη στη γραμμή των **45°**. Στο τοπικό frame η ίδια τιμή είναι απλώς `(0, 0.05)`.
 * 3. **Ο άλλος μας importer** (`dxf-hatch-xdata-converter`, μονοπάτι R12/R14) έκανε ήδη αυτή
 *    ακριβώς την αντιστροφή inline — σωστά. Ο native `convertHatch` **δεν** την έκανε.
 *
 * ## 💥 Τι κόστισε η απόκλιση (γιατί «φτιάχναμε το ένα και χαλούσε το άλλο»)
 *
 * Ένα ANSI31 με πραγματικό βήμα **250 mm** έμπαινε στη σκηνή με `delta = [211.08, 133.96]`.
 * Ο πυρήνας διάβαζε `dy = 133.96` ⇒
 *   - **λάθος πυκνότητα** στον καμβά (βήμα 133,96 αντί 250 — ούτε καν σταθερός συντελεστής:
 *     εξαρτάται από τη γωνία κάθε γραμμοσκίασης, γι' αυτό «άλλες φαίνονταν, άλλες όχι»)·
 *   - **λάθος `dx`** ⇒ ψευδο-stagger σε μοτίβα με dashes·
 *   - **λάθος density-LOD** (`hatchMinWorldSpacing` → κατώφλι px/χαρτιού)·
 *   - **σιωπηλή καταστροφή σε rotate/block-placement**: το `transformInlinePattern` πρόσθετε
 *     γωνία **χωρίς** να στρέψει το (world) `delta` ⇒ το μοτίβο ξεσυγχρονιζόταν από το όριό του·
 *   - **γωνία ≈ 45° ή 225° ⇒ `delta[1] ≈ 0` ⇒ `dy < EPS` ⇒ ΚΑΜΙΑ γραμμή** (ολικά αόρατη).
 *
 * ⚠️ Το round-trip έβγαινε παρ' όλα αυτά «byte-ίδιο» επειδή **ο writer έκανε το κατοπτρικό λάθος**
 * (έγραφε το τοπικό `delta` ωμό στα `45/46`). **Δύο λάθη αλληλοακυρώνονταν στο αρχείο, ενώ η
 * σκηνή στη μνήμη ήταν λάθος.** Γι' αυτό οι έλεγχοι round-trip ήταν πράσινοι επί μήνες.
 * Οι δύο κατευθύνσεις ζουν πλέον **εδώ, ζευγαρωμένες**, ώστε να μην μπορούν να ξεχωρίσουν.
 *
 * @module subapps/dxf-viewer/data/hatch-pattern-delta-frame
 * @see data/hatch-pattern-catalog.ts — ο τύπος `PatternLine` + `transformInlinePattern`
 * @see AutoCAD DXF Reference: HATCH — pattern data (53 = angle, 43/44 = base point, 45/46 = offset)
 */

import { rotateVector } from '../bim/grips/grip-math';

/** Το `[delta-x, delta-y]` μιας `PatternLine` (τοπικό ή world — το λέει η συνάρτηση). */
export type PatternDelta = readonly [number, number];

/**
 * **DXF → πυρήνας.** Ξε-στρέφει το world offset (`45`/`46`) στο τοπικό frame της γραμμής, δηλαδή
 * σε `[stagger κατά μήκος, κάθετη απόσταση]` — τη μοναδική σύμβαση που καταλαβαίνει ο πυρήνας.
 *
 * `local = R(−angle) · world`
 *
 * @param world  Το ζεύγος `[45, 46]` όπως γράφτηκε στο DXF (world coords).
 * @param lineAngleDeg Η **τελική** γωνία της γραμμής — DXF group `53` (μοίρες, CCW από +X).
 */
export function patternDeltaFromWorld(world: PatternDelta, lineAngleDeg: number): [number, number] {
  const v = rotateVector({ x: world[0], y: world[1] }, -lineAngleDeg);
  return [v.x, v.y];
}

/**
 * **Πυρήνας → DXF.** Το ακριβές αντίστροφο του {@link patternDeltaFromWorld}: στρέφει το τοπικό
 * `[along, perp]` στο world offset που περιμένουν τα group codes `45`/`46`.
 *
 * `world = R(+angle) · local`
 *
 * @param local Το κανονικό `PatternLine.delta` (τοπικό frame).
 * @param lineAngleDeg Η **τελική** γωνία της γραμμής που θα γραφτεί στο group `53` —
 *   για μοτίβο catalog αυτή είναι `pl.angle + patternAngle`, **όχι** σκέτο `patternAngle`
 *   (το AutoCAD ψήνει ΟΛΗ τη γωνία μέσα στο offset· επιβεβαιωμένο στο `47_ergasia.dxf`).
 */
export function patternDeltaToWorld(local: PatternDelta, lineAngleDeg: number): [number, number] {
  const v = rotateVector({ x: local[0], y: local[1] }, lineAngleDeg);
  return [v.x, v.y];
}
