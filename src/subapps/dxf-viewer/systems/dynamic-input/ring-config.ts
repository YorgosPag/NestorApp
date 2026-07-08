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
import { type DisplayUnit, formatDisplayValue } from '../../config/units';
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

/**
 * ΚΟΙΝΟ πεδίο Μήκους — κλειδώνει στο `DynamicInputLockStore` (ίδιο για τοίχο & γραμμή).
 * Κρατά την κατεύθυνση, σταθεροποιεί την απόσταση (preview≡commit μέσω `applyLengthAngleLock`).
 */
export function lengthRingField(labelKey: string): RingFieldDef {
  return {
    key: 'length',
    labelKey,
    kind: 'numeric',
    isLocked: () => DynamicInputLockStore.getLocked().length !== null,
    seed: (ctx) => {
      const l = DynamicInputLockStore.getLocked().length;
      return l !== null ? formatDisplayValue(l / mmToSceneUnits(ctx.sceneUnits), ctx.displayUnit) : '';
    },
    commitNumeric: (value, ctx) =>
      DynamicInputLockStore.lockLength(lengthDisplayToSceneLock(value, ctx.displayUnit, ctx.sceneUnits)),
    // ADR-513 §direct-distance-entry — το Μήκος είναι one-shot: μετά την τοποθέτηση ξεκλειδώνει
    // (η Γωνία μένει, polar-like) ώστε το επόμενο segment να είναι ελεύθερο κατά μήκος.
    clearOnPlace: () => DynamicInputLockStore.unlockLength(),
  };
}

/**
 * ΚΟΙΝΟ πεδίο Γωνίας — κλειδώνει στο `DynamicInputLockStore` (ίδιο για τοίχο & γραμμή).
 * Κρατά την απόσταση, σταθεροποιεί τη γωνία (μοίρες, 0..360).
 */
export function angleRingField(labelKey: string): RingFieldDef {
  return {
    key: 'angle',
    labelKey,
    kind: 'numeric',
    isLocked: () => DynamicInputLockStore.getLocked().angle !== null,
    seed: () => {
      const a = DynamicInputLockStore.getLocked().angle;
      return a !== null ? a.toFixed(2) : '';
    },
    commitNumeric: (value) => DynamicInputLockStore.lockAngle(normalizeAngleDeg(value)),
  };
}
