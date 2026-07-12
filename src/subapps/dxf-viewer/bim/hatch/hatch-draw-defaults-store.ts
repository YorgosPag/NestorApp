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
import { createExternalStore } from '../../stores/createExternalStore';
import type { HatchGradientType } from './hatch-gradient';
import { DEFAULT_GRADIENT_DEFAULTS } from './hatch-gradient-build';
// ADR-643 Φ2/Φ3 — starter material library (curated ids) + derived πραγματικό tile size.
import {
  listMaterialImages,
  getMaterialImageDefaultTileMm,
} from '../../data/material-image-catalog';

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
  /**
   * Gap tolerance (AutoCAD HPGAPTOL, σε DXF/world units) για pick-point (Τρόπος Β):
   * γεφυρώνει μικρά κενά στο όριο κατά την ανίχνευση. 0 = απενεργοποιημένο (ADR-507 §5β.1).
   */
  readonly gapTolerance: number;
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
  // ── ADR-643 Φ3 — image fill (μόνο fillType='image') ──
  /** Asset id υλικού εικόνας (catalog `matimg-*`). */
  readonly imageAssetId: string;
  /** Πραγματικό πλάτος tile εικόνας (mm). */
  readonly imageTileWidth: number;
  /** Πραγματικό ύψος tile εικόνας (mm). */
  readonly imageTileHeight: number;
  /** Γωνία περιστροφής μοτίβου εικόνας (μοίρες). */
  readonly imageAngle: number;
  // ── ADR-643 Φ5 — αρμοί (grout) πάνω από την εικόνα ──
  /** Ενεργοί αρμοί (γραμμές στα όρια των tiles). */
  readonly groutEnabled: boolean;
  /** Χρώμα αρμού (hex). */
  readonly groutColor: string;
  /** Πραγματικό πλάτος αρμού (mm). */
  readonly groutWidthMm: number;
}

// ADR-643 Φ3 — πρώτο catalog υλικό ως default· tile size DERIVED (SSoT, μηδέν διπλότυπη διάσταση).
const DEFAULT_IMAGE_ASSET_ID = listMaterialImages()[0]?.id ?? '';
const DEFAULT_IMAGE_TILE = getMaterialImageDefaultTileMm(DEFAULT_IMAGE_ASSET_ID);

/**
 * Εργοστασιακές προεπιλογές — «γραμμές» (user-defined) διαγώνιες 45° / 100 mm
 * (Giorgio 2026-07-07, ADR-507): η συνηθέστερη αρχιτεκτονική γραμμοσκίαση ξεκινά ως
 * παράλληλες διαγώνιες γραμμές, όχι συμπαγές γέμισμα.
 */
export const DEFAULT_HATCH_DRAW_DEFAULTS: HatchDrawDefaults = {
  fillType: 'user-defined',
  fillColor: '#808080',
  lineAngle: 45,
  lineSpacing: 100,
  doubleCrossHatch: false,
  islandStyle: 'normal',
  patternName: 'ANSI31',
  patternScale: 1,
  patternAngle: 0,
  lineweightMm: LINEWEIGHT_SPECIAL.BYLAYER,
  // Gap tolerance off by default (AutoCAD HPGAPTOL=0) — pick-point απαιτεί κλειστό όριο.
  gapTolerance: 0,
  // Gradient defaults (ADR-507 Φ5 UI) — μπλε → λευκό, γραμμικό· SSoT στο hatch-gradient-build.
  ...DEFAULT_GRADIENT_DEFAULTS,
  // Image defaults (ADR-643 Φ3) — πρώτο catalog υλικό, πραγματικό tile size (derived).
  imageAssetId: DEFAULT_IMAGE_ASSET_ID,
  imageTileWidth: DEFAULT_IMAGE_TILE.width,
  imageTileHeight: DEFAULT_IMAGE_TILE.height,
  imageAngle: 0,
  // Grout defaults (ADR-643 Φ5) — απενεργοποιημένοι· λευκός αρμός 5 mm (κοινό πλακιδίων).
  groutEnabled: false,
  groutColor: '#ffffff',
  groutWidthMm: 5,
};

// Plain single-state store (always-notify· ο caller στέλνει partial patch → πάντα νέο object).
const store = createExternalStore<HatchDrawDefaults>(DEFAULT_HATCH_DRAW_DEFAULTS);

/** Τρέχοντα defaults (stable reference — αλλάζει μόνο σε set). */
export function getHatchDrawDefaults(): HatchDrawDefaults {
  return store.get();
}

/** Patch ενός ή περισσότερων default πεδίων + ειδοποίηση subscribers. */
export function setHatchDrawDefaults(patch: Partial<HatchDrawDefaults>): void {
  store.set({ ...store.get(), ...patch });
}

/** `useSyncExternalStore` subscribe. */
export function subscribeHatchDrawDefaults(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Επαναφορά στις εργοστασιακές (test helper). Notify-άρει (mirror του παλιού). */
export function resetHatchDrawDefaults(): void {
  store.set(DEFAULT_HATCH_DRAW_DEFAULTS);
}
