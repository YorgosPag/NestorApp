/**
 * @fileoverview **Ο 2×3 ΑΦΙΝΙΚΟΣ ΠΙΝΑΚΑΣ ΤΟΥ ΕΠΙΠΕΔΟΥ** (SSoT): τύπος, σύνθεση, εφαρμογή, αντιστροφή (ADR-929 Φ0).
 * @module lib/geometry/affine-2x3
 *
 * 🔴 **Γιατί υπάρχει.** Ο τύπος και η σύνθεσή του ζούσαν μέσα σε αρχείο **ενός εργαλείου** του DXF viewer
 * (`hooks/tools/transform-ghost-matrix.ts`, ADR-646). Η **εφαρμογή** σε σημείο υπήρχε **μόνο μέσα σε test**, και αντιστροφή
 * δεν υπήρχε πουθενά. Ο ίδιος μετασχηματισμός `T·R·S` του υποβάθρου κάτοψης ήταν γραμμένος **με το χέρι** στον διακομιστή
 * (`services/floorplan-background/calibration-remap.service.ts`, μαζί με τον αντίστροφό του) και, ξεχωριστά, ως σειρά
 * `ctx.translate/rotate/scale` στον ζωγράφο. Η αναγνώριση κάτοψης από εικόνα (ADR-929 Δ3) χρειάζεται και τα τέσσερα. Ζει
 * στο `lib/` και όχι στο subapp ώστε ο διακομιστής να μην εισάγει από το `dxf-viewer` (CHECK 3.62), όπως το
 * `planar-polygon.ts`.
 *
 * 🏆 **Πρότυπο.** Ακριβώς ο πίνακας του Canvas 2D (`ctx.transform(a,b,c,d,e,f)`), του SVG (`matrix(a b c d e f)`) και του
 * Skia (`SkMatrix` affine): ένα σχήμα, γνωστή σημασιολογία, καμία μετάφραση στο όριο με τον καμβά.
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή εδώ.** Καθαρή αριθμητική· τρέχει σε πελάτη, Worker και διακομιστή.
 */

/** Σημείο στο επίπεδο (δομικά συμβατό με κάθε `{x, y}` του έργου). */
export interface AffinePoint {
  readonly x: number;
  readonly y: number;
}

/** 2×3 affine με τη σημασιολογία του `ctx.transform(a,b,c,d,e,f)`: `x'=a·x+c·y+e ; y'=b·x+d·y+f`. */
export interface Affine2x3 {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly e: number; readonly f: number;
}

export const IDENTITY_AFFINE: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `compose(m2, m1)` εφαρμόζει πρώτα το `m1` και μετά το `m2` (δηλαδή `x → m2(m1(x))`). */
export function composeAffine(m2: Affine2x3, m1: Affine2x3): Affine2x3 {
  return {
    a: m2.a * m1.a + m2.c * m1.b,
    b: m2.b * m1.a + m2.d * m1.b,
    c: m2.a * m1.c + m2.c * m1.d,
    d: m2.b * m1.c + m2.d * m1.d,
    e: m2.a * m1.e + m2.c * m1.f + m2.e,
    f: m2.b * m1.e + m2.d * m1.f + m2.f,
  };
}

/** Εφαρμογή σε σημείο. */
export function applyAffine(m: Affine2x3, p: AffinePoint): { x: number; y: number } {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/**
 * Σχετικό κατώφλι εκφυλισμού: ορίζουσα μικρότερη από `ε · (κλίμακα)²` σημαίνει ότι ο πίνακας «πατικώνει» το επίπεδο σε
 * γραμμή ή σημείο (π.χ. `scaleX = 0`). Σχετικό και όχι απόλυτο, ώστε ένας έγκυρος πίνακας σε μικρή κλίμακα (pixel → μέτρα,
 * ~1e-3) να μη χαρακτηρίζεται εκφυλισμένος.
 */
const SINGULAR_RELATIVE_EPSILON = 1e-12;

/**
 * Αντίστροφος πίνακας, ή `null` όταν ο πίνακας είναι εκφυλισμένος.
 *
 * Γιατί `null` και όχι `NaN`/`Infinity`: ο καλών πρέπει να **αποφασίσει** τι σημαίνει «δεν αντιστρέφεται» (π.χ. «το
 * υπόβαθρο έχει μηδενική κλίμακα»). Ένα σιωπηλό `NaN` θα ταξίδευε ως γεωμετρία μέχρι τη σκηνή.
 */
export function invertAffine(m: Affine2x3): Affine2x3 | null {
  const det = m.a * m.d - m.b * m.c;
  const scale = Math.max(Math.abs(m.a), Math.abs(m.b), Math.abs(m.c), Math.abs(m.d));
  if (!Number.isFinite(det) || Math.abs(det) <= SINGULAR_RELATIVE_EPSILON * scale * scale) return null;
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  };
}

/** Εφαρμόζει τον πίνακα στον καμβά, **πάνω** από ό,τι μετασχηματισμό έχει ήδη (π.χ. DPR). */
export function transformContext(ctx: CanvasRenderingContext2D, m: Affine2x3): void {
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
}
