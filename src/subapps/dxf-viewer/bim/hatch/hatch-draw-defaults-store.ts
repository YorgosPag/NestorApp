/**
 * Hatch draw-defaults store (ADR-507 S2 / Φ1b).
 *
 * SSoT για τις προεπιλεγμένες ιδιότητες που εφαρμόζονται στην ΕΠΟΜΕΝΗ
 * γραμμοσκίαση που σχεδιάζει ο χρήστης (Revit «διάλεξε μοτίβο → σχεδίασε»).
 * Καταναλωτές:
 *   - `createEntityFromTool` (`case 'hatch'`) — διαβάζει τα defaults τη στιγμή
 *     της δημιουργίας του `HatchEntity` (mirror του `getXLineModeState`).
 *   - `useRibbonHatchBridge` — όταν δεν υπάρχει επιλεγμένο hatch (tool-active),
 *     το contextual panel «Γραμμοσκίαση» διαβάζει/γράφει αυτά τα defaults.
 *
 * Zero-React imperative store + `useSyncExternalStore`-συμβατό `subscribe`/
 * `getSnapshot` (low-frequency — user edits μόνο, ADR-040-safe).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { HatchEntity, LineweightMm } from '../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import type { HatchGradientType } from './hatch-gradient';
import { DEFAULT_GRADIENT_DEFAULTS } from './hatch-gradient-build';

/** Οι ρυθμίσεις σχεδίασης που κουβαλάει μια νέα γραμμοσκίαση. */
export interface HatchDrawDefaults {
  /** 'solid' = συμπαγές· 'user-defined' = παράλληλες γραμμές· 'predefined' = PAT μοτίβο. */
  readonly fillType: NonNullable<HatchEntity['fillType']>;
  /** Χρώμα γεμίσματος/γραμμών (hex). */
  readonly fillColor: string;
  /** Γωνία γραμμών (μοίρες) — μόνο user-defined. */
  readonly lineAngle: number;
  /** Κάθετη απόσταση γραμμών (mm) — μόνο user-defined. */
  readonly lineSpacing: number;
  /** Διπλή (σταυρωτή) γραμμοσκίαση — μόνο user-defined. */
  readonly doubleCrossHatch: boolean;
  /** Island detection style (DXF code 75). */
  readonly islandStyle: NonNullable<HatchEntity['islandStyle']>;
  /** Όνομα predefined μοτίβου (PAT catalog) — μόνο predefined. */
  readonly patternName: string;
  /** Κλίμακα predefined μοτίβου (×) — μόνο predefined. */
  readonly patternScale: number;
  /** Γωνία predefined μοτίβου (μοίρες) — μόνο predefined. */
  readonly patternAngle: number;
  /** Πάχος γραμμών (AutoCAD LWT). -2 = ByLayer (default → renderer fallback). */
  readonly lineweightMm: LineweightMm;
  /** Τύπος gradient (DXF 470) — μόνο fillType='gradient'. */
  readonly gradientType: HatchGradientType;
  /** Πρώτο χρώμα gradient (hex). */
  readonly gradientColor1: string;
  /** Δεύτερο χρώμα gradient (hex) — αγνοείται όταν single-color. */
  readonly gradientColor2: string;
  /** Single-color gradient (color1 → tint προς λευκό, αγνοεί color2). */
  readonly gradientSingleColor: boolean;
  /** Γωνία περιστροφής gradient (μοίρες). */
  readonly gradientAngle: number;
  /** Μετατόπιση gradient 0..1 (DXF 461) — 0=centered. */
  readonly gradientShift: number;
}

/** Εργοστασιακές προεπιλογές — συμπαγής γκρι poché (η συνηθέστερη χρήση). */
const DEFAULT_HATCH_DRAW_DEFAULTS: HatchDrawDefaults = {
  fillType: 'solid',
  fillColor: '#808080',
  lineAngle: 45,
  lineSpacing: 100,
  doubleCrossHatch: false,
  islandStyle: 'normal',
  patternName: 'ANSI31',
  patternScale: 1,
  patternAngle: 0,
  lineweightMm: LINEWEIGHT_SPECIAL.BYLAYER,
  // Gradient defaults (ADR-507 Φ5 UI) — μπλε → λευκό, γραμμικό· SSoT στο hatch-gradient-build.
  ...DEFAULT_GRADIENT_DEFAULTS,
};

let state: HatchDrawDefaults = DEFAULT_HATCH_DRAW_DEFAULTS;
const listeners = new Set<() => void>();

/** Τρέχοντα defaults (stable reference — αλλάζει μόνο σε set). */
export function getHatchDrawDefaults(): HatchDrawDefaults {
  return state;
}

/** Patch ενός ή περισσότερων default πεδίων + ειδοποίηση subscribers. */
export function setHatchDrawDefaults(patch: Partial<HatchDrawDefaults>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** `useSyncExternalStore` subscribe. */
export function subscribeHatchDrawDefaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Επαναφορά στις εργοστασιακές (test helper). */
export function resetHatchDrawDefaults(): void {
  state = DEFAULT_HATCH_DRAW_DEFAULTS;
  for (const l of listeners) l();
}
