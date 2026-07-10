/**
 * ADR-513 §line-parity — «Δαχτυλίδι Εντολών» tool-agnostic configuration (SSoT).
 *
 * Το `RadialCommandRing` component είναι ΠΛΕΟΝ ανεξάρτητο εργαλείου: παίρνει ένα
 * `RingConfig` που περιγράφει ΠΟΙΑ πεδία έχει το δαχτυλίδι, σε ΠΟΙΑ θέση, πώς
 * διαβάζονται (`seed`) και πώς καταχωρούνται (`commitNumeric` / `commitSelect`).
 *
 * - **Τοίχος** (`wall-ring-config.ts`): Μήκος / Γωνία / Πάχος / Ύψος (4 numeric).
 * - **Γραμμή** (`line-ring-config.ts`): Μήκος / Γωνία / **Τύπος γραμμής** (2 numeric + 1 select).
 *
 * **FULL SSoT — μηδέν νέο store:** Μήκος/Γωνία κλειδώνουν στο ΙΔΙΟ `DynamicInputLockStore`
 * (κοινοί builders εδώ, χρησιμοποιούνται ΚΑΙ από τον τοίχο ΚΑΙ από τη γραμμή). Τα tool-specific
 * πεδία (Πάχος/Ύψος → wall bridge· Τύπος → `QuickStyleStore`) ζουν στα αντίστοιχα config αρχεία.
 *
 * Zero React / DOM dependencies — fully unit-testable.
 */

import type { Point2D } from '../../rendering/types/Types';
import { type DisplayUnit, formatDisplayValue, fromDisplay } from '../../config/units';
import { type SceneUnits, mmToSceneUnits } from '../../utils/scene-units';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import { lengthDisplayToSceneLock } from './radial-ring-logic';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';

/** Μονάδες την ώρα του commit/seed (display + scene) — περνιούνται από το component. */
export interface RingUnitContext {
  readonly displayUnit: DisplayUnit;
  readonly sceneUnits: SceneUnits;
}

/** Επιλογή για πεδίο τύπου `select` (π.χ. τύπος γραμμής). */
export interface RingSelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Ορισμός ενός πεδίου του δαχτυλιδιού. `numeric` → popup input + lock/override·
 * `select` → popup dropdown λίστα (επιλογή, π.χ. τύπος γραμμής).
 */
export interface RingFieldDef {
  /** Σταθερό id πεδίου ('length' | 'angle' | 'thickness' | 'height' | 'linetype'). */
  readonly key: string;
  /** i18n key της ετικέτας (namespace `dxf-viewer-shell`). */
  readonly labelKey: string;
  /** Τρόπος εισαγωγής. */
  readonly kind: 'numeric' | 'select';
  /** `true` → το wedge φωτίζεται ως «κλειδωμένο/ορισμένο». */
  isLocked(): boolean;
  /** Τρέχουσα τιμή ως string (αρχικοποίηση popup). */
  seed(ctx: RingUnitContext): string;
  /** kind==='numeric': καταχώρηση αριθμητικής τιμής (lock ή override). */
  commitNumeric?(value: number, ctx: RingUnitContext): void;
  /**
   * ADR-513 §direct-distance-entry — προαιρετικό reset «μιας βολής» μετά την τοποθέτηση σημείου
   * (Enter → place). AutoCAD direct distance entry: το Μήκος είναι one-shot ανά segment, οπότε
   * καθαρίζεται ώστε το επόμενο segment να ξεκινά ελεύθερο. Το field κατέχει το δικό του reset (SSoT).
   */
  clearOnPlace?(): void;
  /** kind==='select': οι διαθέσιμες επιλογές (live). */
  options?(): readonly RingSelectOption[];
  /** kind==='select': καταχώρηση επιλεγμένης τιμής. */
  commitSelect?(value: string): void;
}

/** Πλήρης διάταξη δαχτυλιδιού ανά εργαλείο. */
export interface RingConfig {
  /** i18n key του aria-label του δαχτυλιδιού. */
  readonly ariaLabelKey: string;
  /**
   * Τα πεδία με ΣΕΙΡΑ. Ο κύκλος χωρίζεται σε ΤΟΣΕΣ ΙΣΕΣ φέτες όσα τα πεδία (`computeRingSlices`):
   * το πεδίο index 0 παίρνει τη φέτα που κεντράρει ΠΑΝΩ, τα υπόλοιπα δεξιόστροφα. 2 πεδία → 2 ημικύκλια·
   * 3 → 3×120°· 4 → cardinal. (Άρα η σειρά εδώ ορίζει τη διάταξη — μηδέν σταθερή cardinal θέση.)
   */
  readonly fields: readonly RingFieldDef[];
  /**
   * ADR-513 §rectangle — ποιο πεδίο ανοίγει το heads-up direct-numeric typing (πρώτο ψηφίο →
   * αυτόματο popup). Default `'length'` (γραμμή/τοίχος/δοκός)· το ορθογώνιο το θέτει `'width'`.
   */
  readonly headsUpFieldKey?: string;
  /** Συνδρομή στα stores που τρέφουν highlight/seed — ένα re-render σε κάθε αλλαγή. */
  subscribe(cb: () => void): () => void;
}

/**
 * Σταθερό re-init key του δαχτυλιδιού ανά segment (αλλάζει όταν τοποθετηθεί νέα αρχή → re-center).
 * Κοινό SSoT για όλους τους caller (2D τοίχος/γραμμή + 3D), ώστε το `${x},${y}` idiom να μην σπαρθεί inline.
 */
export function ringStartKey(point: Readonly<Point2D> | null | undefined, fallback = ''): string {
  return point ? `${point.x},${point.y}` : fallback;
}

/** Ένωσε πολλές store-συνδρομές σε ΜΙΑ (ένα unsubscribe καθαρίζει όλες). */
export function combineSubscribers(
  ...subs: ReadonlyArray<(cb: () => void) => () => void>
): (cb: () => void) => () => void {
  return (cb) => {
    const unsubs = subs.map((s) => s(cb));
    return () => {
      for (const u of unsubs) u();
    };
  };
}

// ─── Injectable lock target: γενικεύει το «πεδίο δαχτυλιδιού που κλειδώνει σε store» ───
// SSoT ώστε ΓΡΑΜΜΗ/ΤΟΙΧΟΣ (DynamicInputLockStore) ΚΑΙ ΟΡΘΟΓΩΝΙΟ (RectLockStore) να μοιράζονται
// ΤΟΝ ΙΔΙΟ builder — μηδέν sibling clone (N.18). Η διαφορά ζει μόνο στο injected target.

/** Αφηρημένος στόχος κλειδώματος ενός numeric πεδίου (ποιο store, πώς διαβάζεται/γράφεται). */
export interface RingLockTarget {
  isLocked(): boolean;
  /** Τρέχουσα locked τιμή (scene units για length-like, μοίρες για angle-like) ή null. */
  read(): number | null;
  /** Καταχώρηση της raw display τιμής (η μετατροπή/normalize γίνεται μέσα στο target). */
  lock(value: number, ctx: RingUnitContext): void;
  /** Προαιρετικό one-shot reset μετά την τοποθέτηση. */
  clearOnPlace?(): void;
}

/** Length-like πεδίο (seed: scene→display formatted). Reuse για Μήκος (γραμμή) & Πλάτος/Ύψος (ορθογώνιο). */
export function sceneLengthRingField(key: string, labelKey: string, target: RingLockTarget): RingFieldDef {
  return {
    key,
    labelKey,
    kind: 'numeric',
    isLocked: target.isLocked,
    seed: (ctx) => {
      const v = target.read();
      return v !== null ? formatDisplayValue(v / mmToSceneUnits(ctx.sceneUnits), ctx.displayUnit) : '';
    },
    commitNumeric: (value, ctx) => target.lock(value, ctx),
    clearOnPlace: target.clearOnPlace,
  };
}

/** Angle-like πεδίο (seed: μοίρες toFixed(2)). Reuse για Γωνία (γραμμή) & Γωνία κλίσης (ορθογώνιο). */
export function degreeRingField(key: string, labelKey: string, target: RingLockTarget): RingFieldDef {
  return {
    key,
    labelKey,
    kind: 'numeric',
    isLocked: target.isLocked,
    seed: () => {
      const a = target.read();
      return a !== null ? a.toFixed(2) : '';
    },
    commitNumeric: (value, ctx) => target.lock(value, ctx),
    clearOnPlace: target.clearOnPlace,
  };
}

/**
 * ΚΟΙΝΟ πεδίο Μήκους — κλειδώνει στο `DynamicInputLockStore` (ίδιο για τοίχο & γραμμή).
 * Κρατά την κατεύθυνση, σταθεροποιεί την απόσταση (preview≡commit μέσω `applyLengthAngleLock`).
 */
export function lengthRingField(labelKey: string): RingFieldDef {
  return sceneLengthRingField('length', labelKey, {
    isLocked: () => DynamicInputLockStore.getLocked().length !== null,
    read: () => DynamicInputLockStore.getLocked().length,
    lock: (value, ctx) =>
      DynamicInputLockStore.lockLength(lengthDisplayToSceneLock(value, ctx.displayUnit, ctx.sceneUnits)),
    // ADR-513 §direct-distance-entry — το Μήκος είναι one-shot: μετά την τοποθέτηση ξεκλειδώνει
    // (η Γωνία μένει, polar-like) ώστε το επόμενο segment να είναι ελεύθερο κατά μήκος.
    clearOnPlace: () => DynamicInputLockStore.unlockLength(),
  });
}

/**
 * ΚΟΙΝΟ πεδίο Γωνίας — κλειδώνει στο `DynamicInputLockStore` (ίδιο για τοίχο & γραμμή).
 * Κρατά την απόσταση, σταθεροποιεί τη γωνία (μοίρες, 0..360).
 */
export function angleRingField(labelKey: string): RingFieldDef {
  return degreeRingField('angle', labelKey, {
    isLocked: () => DynamicInputLockStore.getLocked().angle !== null,
    read: () => DynamicInputLockStore.getLocked().angle,
    lock: (value) => DynamicInputLockStore.lockAngle(normalizeAngleDeg(value)),
  });
}

// ─── Tool-specific numeric OVERRIDE fields (SSoT: τοίχος πάχος/ύψος, δοκός πλάτος/ύψος) ───

/** Bridge store που ένα ενεργό εργαλείο εκθέτει (`null` όταν δεν τρέχει) — reader + writer overrides. */
export interface RingOverrideBridge<TOverrides> {
  get(): { readonly overrides: TOverrides; setParamOverrides(next: TOverrides): void } | null;
}
/** Preview store (πάντα παρόν) — fallback source των overrides όταν δεν υπάρχει ενεργό bridge handle. */
export interface RingOverridePreview<TOverrides> {
  get(): { readonly overrides: TOverrides };
}
/** Ορισμός ενός numeric override-πεδίου: ποιο κλειδί, ετικέτα, και πώς προκύπτει η seed τιμή (mm). */
export interface NumericOverrideFieldSpec<TOverrides> {
  readonly key: keyof TOverrides & string;
  readonly labelKey: string;
  /** Τρέχουσα τιμή (mm) του πεδίου από τα overrides — π.χ. `resolveWallThicknessMm(o)` ή `o.width ?? DEFAULT`. */
  readonly resolveSeedMm: (overrides: TOverrides) => number;
}

/**
 * SSoT για τα **override-based** numeric πεδία δαχτυλιδιού (τοίχος Πάχος/Ύψος, δοκός Πλάτος/Ύψος).
 *
 * Το idiom «bridge-ή-preview reader + bridge writer + numeric `RingFieldDef` builder» ήταν
 * αντιγραμμένο byte-identical στα `wall-ring-config.ts` + `beam-ring-config.ts` (μόνη διαφορά:
 * το ζεύγος stores, ο τύπος overrides, και η per-field seed resolver). Εδώ γενικεύεται μία φορά:
 *   - `currentOverrides()` — bridge handle overrides, αλλιώς preview fallback,
 *   - `setOverride(key, mm)` — γράψε ένα override στο bridge (no-op χωρίς ενεργό handle),
 *   - `numericOverrideField(spec)` — δόμησε το `RingFieldDef` (lock = override ορισμένο, seed σε display units, commit = fromDisplay → override).
 */
export function createOverrideRingFields<TOverrides>(
  bridge: RingOverrideBridge<TOverrides>,
  preview: RingOverridePreview<TOverrides>,
): {
  currentOverrides: () => TOverrides;
  setOverride: (key: keyof TOverrides & string, valueMm: number) => void;
  numericOverrideField: (spec: NumericOverrideFieldSpec<TOverrides>) => RingFieldDef;
} {
  const currentOverrides = (): TOverrides => bridge.get()?.overrides ?? preview.get().overrides;

  const setOverride = (key: keyof TOverrides & string, valueMm: number): void => {
    const handle = bridge.get();
    if (!handle) return;
    // computed-key partial update· `number` ταιριάζει στο πεδίο. Ρητή assertion για το γνωστό TS
    // widening του computed-key spread (ΟΧΙ `any` — διατηρεί τον συγκεκριμένο τύπο overrides).
    handle.setParamOverrides({ ...handle.overrides, [key]: valueMm } as TOverrides);
  };

  const numericOverrideField = (spec: NumericOverrideFieldSpec<TOverrides>): RingFieldDef => ({
    key: spec.key,
    labelKey: spec.labelKey,
    kind: 'numeric',
    isLocked: () => currentOverrides()[spec.key] !== undefined,
    seed: (ctx) => formatDisplayValue(spec.resolveSeedMm(currentOverrides()), ctx.displayUnit),
    commitNumeric: (value, ctx) => setOverride(spec.key, fromDisplay(value, ctx.displayUnit)),
  });

  return { currentOverrides, setOverride, numericOverrideField };
}
