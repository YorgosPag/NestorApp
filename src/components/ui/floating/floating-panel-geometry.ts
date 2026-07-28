/**
 * ADR-723 — Floating panel geometry: **ΕΝΑΣ** κανόνας για το «πού επιτρέπεται να κάθεται μια παλέτα».
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ──
 *
 * Μέχρι το ADR-723 ο κανόνας ζούσε **inline** μέσα στο `FloatingPanel.tsx`, ως δύο literals
 * (`minPosition` / `maxPosition`) στην κλήση του `useDraggable`. Όσο ο μόνος καταναλωτής ήταν
 * το σύρσιμο, αυτό ήταν αρκετό. Με την **επαναφορά αποθηκευμένης θέσης** (ADR-723 §4) και την
 * **αλλαγή μεγέθους** εμφανίζονται δύο ακόμη καταναλωτές του **ίδιου** κανόνα. Τρία αντίγραφα
 * του «πόσο μπορεί να βγει εκτός οθόνης» αποκλίνουν σιωπηλά: το σύρσιμο θα σταματούσε στα 40px
 * και η επαναφορά θα επέτρεπε 0px — δηλαδή μια παλέτα που **δεν πιάνεται** μετά από restore.
 * Γι' αυτό ο κανόνας είναι εδώ, καθαρές συναρτήσεις, και τον **εισάγουν** και οι τρεις.
 *
 * ── ΤΟ ΕΛΑΤΤΩΜΑ ΤΟΥ ΚΛΑΔΟΥ ΠΟΥ ΚΛΕΙΝΕΙ ΕΔΩ ──
 *
 * «Layer Properties palette lost off-screen» είναι **τεκμηριωμένο** πρόβλημα του AutoCAD: η
 * παλέτα αποθηκεύει x/y, ο χρήστης αποσυνδέει τη δεύτερη οθόνη, και στο επόμενο άνοιγμα η
 * παλέτα επαναφέρεται σε συντεταγμένες που **δεν υπάρχουν πια**. Ίδιο σχήμα και στα Windows
 * (γι' αυτό υπάρχει το «Remember window locations based on monitor connection»). Η θεραπεία
 * είναι πάντα χειροκίνητη (registry / Move+βελάκια).
 *
 * Εδώ **δεν** εμπιστευόμαστε ποτέ την αποθηκευμένη γεωμετρία: κάθε ανάγνωση περνά από
 * {@link clampPanelGeometry} με το **τρέχον** viewport, και το ίδιο ξανασυμβαίνει σε κάθε
 * `resize` του παραθύρου. Η παλέτα δεν μπορεί δομικά να χαθεί.
 *
 * Framework-free επίτηδες (καμία εξάρτηση από React / DOM) ⇒ πλήρως ελέγξιμο με jest χωρίς jsdom.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ΤΥΠΟΙ
// ─────────────────────────────────────────────────────────────────────────────

/** Θέση πάνω-αριστερής γωνίας, σε CSS pixels του viewport. */
export interface PanelPosition {
  readonly x: number;
  readonly y: number;
}

/** Διαστάσεις παλέτας, σε CSS pixels. */
export interface PanelSize {
  readonly width: number;
  readonly height: number;
}

/** Θέση + μέγεθος — η πλήρης γεωμετρία που αποθηκεύεται και επαναφέρεται. */
export interface PanelGeometry extends PanelPosition, PanelSize {}

/** Διαστάσεις της ορατής περιοχής. Δίνεται ρητά ώστε οι συναρτήσεις να μένουν καθαρές. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ΣΤΑΘΕΡΕΣ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ADR-030 — «Minimum Visible Header»: η λωρίδα που πρέπει **πάντα** να μένει ορατή ώστε ο
 * χρήστης να μπορεί να ξαναπιάσει την παλέτα με το ποντίκι.
 *
 * Πρακτική Autodesk / Adobe / Microsoft: η παλέτα επιτρέπεται να βγει μερικώς εκτός οθόνης
 * (χρήσιμο σε στενές οθόνες), αλλά **ποτέ** τόσο ώστε να μη μένει τίποτα να πιαστεί.
 */
export const MINIMUM_VISIBLE_HEADER = 40;

/**
 * Κάτω όριο μεγέθους. Κάτω από αυτό η επικεφαλίδα (τίτλος + λαβή + κλείσιμο) δεν χωρά, οπότε
 * η παλέτα γίνεται μη-λειτουργική αντί για «μικρή».
 */
export const DEFAULT_MIN_PANEL_SIZE: PanelSize = { width: 280, height: 160 };

// ─────────────────────────────────────────────────────────────────────────────
// 3. ΒΟΗΘΗΤΙΚΑ
// ─────────────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  // `max` μπροστά: όταν min > max (viewport μικρότερο από το ελάχιστο μέγεθος) κερδίζει το
  // `min`, δηλαδή η παλέτα μένει λειτουργική και ξεχειλίζει — αντί να συρρικνωθεί στο μηδέν.
  return Math.max(min, Math.min(value, max));
}

/** `true` μόνο για πραγματικό, πεπερασμένο αριθμό (κόβει `NaN`, `Infinity`, `null`, strings). */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ο ΚΑΝΟΝΑΣ — μία υλοποίηση, τρεις καταναλωτές
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Τα όρια μέσα στα οποία επιτρέπεται να κινηθεί η **πάνω-αριστερή γωνία** της παλέτας.
 *
 * Αυτή είναι η **αυθεντική** διατύπωση του κανόνα ADR-030· το σύρσιμο
 * ({@link useDraggable}) και η επαναφορά ({@link clampPanelPosition}) τη μοιράζονται.
 *
 * - `min.x = -(width - 40)` → η παλέτα μπορεί να βγει αριστερά, μένουν 40px από τη δεξιά της άκρη.
 * - `max.x = viewport.width - 40` → μπορεί να βγει δεξιά, μένουν 40px από την αριστερή της άκρη.
 * - `min.y = 0` → η επικεφαλίδα **ποτέ** πάνω από την κορυφή: εκεί δεν υπάρχει τίποτα να πιαστεί.
 * - `max.y = viewport.height - 40` → μένει τουλάχιστον η επικεφαλίδα ορατή στο κάτω μέρος.
 */
export function panelDragBounds(
  size: PanelSize,
  viewport: ViewportSize,
): { readonly min: PanelPosition; readonly max: PanelPosition } {
  return {
    min: { x: -size.width + MINIMUM_VISIBLE_HEADER, y: 0 },
    max: {
      x: viewport.width - MINIMUM_VISIBLE_HEADER,
      y: viewport.height - MINIMUM_VISIBLE_HEADER,
    },
  };
}

/**
 * Περιορίζει το **μέγεθος** στο [minSize, viewport].
 *
 * Το πάνω όριο είναι το viewport και όχι κάποιο αυθαίρετο max: μια παλέτα μεγαλύτερη από την
 * οθόνη έχει περιεχόμενο που δεν φτάνεις ποτέ. Το `maxSize` (προαιρετικό) στενεύει περαιτέρω.
 */
export function clampPanelSize(
  size: PanelSize,
  viewport: ViewportSize,
  minSize: PanelSize = DEFAULT_MIN_PANEL_SIZE,
  maxSize?: PanelSize,
): PanelSize {
  const maxWidth = Math.min(viewport.width, maxSize?.width ?? Number.POSITIVE_INFINITY);
  const maxHeight = Math.min(viewport.height, maxSize?.height ?? Number.POSITIVE_INFINITY);
  return {
    width: clamp(size.width, minSize.width, maxWidth),
    height: clamp(size.height, minSize.height, maxHeight),
  };
}

/** Περιορίζει τη **θέση** στα {@link panelDragBounds} του δοσμένου μεγέθους. */
export function clampPanelPosition(
  position: PanelPosition,
  size: PanelSize,
  viewport: ViewportSize,
): PanelPosition {
  const bounds = panelDragBounds(size, viewport);
  return {
    x: clamp(position.x, bounds.min.x, bounds.max.x),
    y: clamp(position.y, bounds.min.y, bounds.max.y),
  };
}

/**
 * Η **μία** πύλη επαναφοράς: μέγεθος πρώτα, θέση μετά.
 *
 * ⚠️ Η σειρά δεν είναι στιλιστική. Τα όρια θέσης εξαρτώνται από το **πλάτος** (`min.x` είναι
 * συνάρτηση του `width`). Αν περιοριζόταν πρώτα η θέση, θα κρινόταν με το **παλιό** πλάτος και
 * το αποτέλεσμα θα ήταν εκτός ορίων μετά τη συρρίκνωση.
 */
export function clampPanelGeometry(
  geometry: PanelGeometry,
  viewport: ViewportSize,
  minSize: PanelSize = DEFAULT_MIN_PANEL_SIZE,
  maxSize?: PanelSize,
): PanelGeometry {
  const size = clampPanelSize(geometry, viewport, minSize, maxSize);
  const position = clampPanelPosition(geometry, size, viewport);
  return { ...position, ...size };
}

/**
 * `true` όταν η γεωμετρία είναι **ήδη** εντός κανόνα — δηλαδή το
 * {@link clampPanelGeometry} θα την επέστρεφε αυτούσια.
 *
 * Χρησιμοποιείται από τον φύλακα του `window.resize` ώστε να **μη** γράφει state (και άρα να
 * μην προκαλεί re-render) όταν δεν χρειάζεται διάσωση. Σε μια απλή αλλαγή μεγέθους παραθύρου
 * που δεν αγγίζει την παλέτα, το κόστος είναι μία σύγκριση.
 */
export function isPanelGeometryWithinBounds(
  geometry: PanelGeometry,
  viewport: ViewportSize,
  minSize: PanelSize = DEFAULT_MIN_PANEL_SIZE,
  maxSize?: PanelSize,
): boolean {
  const clamped = clampPanelGeometry(geometry, viewport, minSize, maxSize);
  return (
    clamped.x === geometry.x &&
    clamped.y === geometry.y &&
    clamped.width === geometry.width &&
    clamped.height === geometry.height
  );
}

/**
 * Επικυρώνει **άγνωστο** δεδομένο (από localStorage, από query string, από παλιότερη έκδοση
 * σχήματος) ως {@link PanelGeometry}.
 *
 * Επιστρέφει `null` σε ό,τι δεν είναι τέσσερις πεπερασμένοι αριθμοί με θετικές διαστάσεις.
 * Ο καλών **οφείλει** να πέσει πίσω στις προεπιλογές — ποτέ να μη «διορθώσει» μερικώς ένα
 * χαλασμένο record, γιατί ένα `width: NaN` που γίνεται `280` κρύβει το γεγονός ότι η αποθήκευση
 * είναι κατεστραμμένη.
 */
export function parsePanelGeometry(value: unknown): PanelGeometry | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { x, y, width, height } = record;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}
