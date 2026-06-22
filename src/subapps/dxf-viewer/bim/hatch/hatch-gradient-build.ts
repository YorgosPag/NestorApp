/**
 * Hatch Gradient build SSoT (ADR-507 Φ5 UI).
 *
 * Pure leaf: χτίζει το nested `HatchGradient` object από flat πεδία (draw-defaults
 * ή ribbon edits), ΜΙΑ φορά, ώστε να το μοιράζονται το ribbon bridge
 * (`useRibbonHatchBridge`) και η δημιουργία οντότητας (`buildHatchEntityFromBoundary`).
 *
 * Επειδή το `gradient` είναι nested, κάθε αλλαγή ΕΝΟΣ πεδίου ξαναχτίζει ΟΛΟ το object
 * (immutable) μέσω του `withGradientPatch` — μηδέν partial-merge bug, μηδέν διπλό
 * object-assembly. Το entity αποθηκεύει την «trimmed» μορφή (προαιρετικά πεδία που
 * ισούνται με το ουδέτερο παραλείπονται)· το `toRaw` ανακτά τα πλήρη πεδία από τα
 * defaults ώστε το merge να μη χάνει το color2 ενός single-color gradient.
 *
 * @see ./hatch-gradient (model + resolveGradientStops)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8 (Φ5 UI)
 */

import type { HatchGradient, HatchGradientType } from './hatch-gradient';

/**
 * Flat gradient ρυθμίσεις — πηγή για το `HatchGradient`. Τα ονόματα ταιριάζουν με τα
 * αντίστοιχα πεδία του `HatchDrawDefaults` (structural reuse → μηδέν mapping).
 */
export interface GradientDefaults {
  readonly gradientType: HatchGradientType;
  readonly gradientColor1: string;
  readonly gradientColor2: string;
  readonly gradientSingleColor: boolean;
  readonly gradientAngle: number;
  readonly gradientShift: number;
}

/** Εργοστασιακές προεπιλογές gradient (μπλε → λευκό, γραμμικό, centered). */
export const DEFAULT_GRADIENT_DEFAULTS: GradientDefaults = {
  gradientType: 'linear',
  gradientColor1: '#2980b9',
  gradientColor2: '#ffffff',
  gradientSingleColor: false,
  gradientAngle: 0,
  gradientShift: 0,
};

/** Ένα πεδίο gradient που μπορεί να αλλάξει το ribbon (1-προς-1 με τα command keys). */
export type GradientFieldPatch =
  | { readonly field: 'type'; readonly value: HatchGradientType }
  | { readonly field: 'color1'; readonly value: string }
  | { readonly field: 'color2'; readonly value: string }
  | { readonly field: 'singleColor'; readonly value: boolean }
  | { readonly field: 'angleDeg'; readonly value: number }
  | { readonly field: 'shift'; readonly value: number };

/** Εσωτερική «πλήρης» μορφή (όλα τα πεδία παρόντα) — εύκολο immutable merge. */
interface RawGradient {
  type: HatchGradientType;
  color1: string;
  color2: string;
  singleColor: boolean;
  angleDeg: number;
  shift: number;
}

/** Trimmed canonical `HatchGradient`: παραλείπει προαιρετικά πεδία στο ουδέτερό τους. */
function finalize(raw: RawGradient): HatchGradient {
  return {
    type: raw.type,
    color1: raw.color1,
    // single-color → color2 παράγεται από tint· δεν αποθηκεύεται.
    color2: raw.singleColor ? undefined : raw.color2,
    singleColor: raw.singleColor || undefined,
    angleDeg: raw.angleDeg || undefined,
    shift: raw.shift || undefined,
  };
}

/** Ανάκτηση πλήρους `RawGradient` από (trimmed entity gradient ?? defaults). */
function toRaw(current: HatchGradient | undefined, d: GradientDefaults): RawGradient {
  return {
    type: current?.type ?? d.gradientType,
    color1: current?.color1 ?? d.gradientColor1,
    // entity single-color → color2 undefined· ανάκτησέ το από τα defaults.
    color2: current?.color2 ?? d.gradientColor2,
    singleColor: current?.singleColor ?? d.gradientSingleColor,
    angleDeg: current?.angleDeg ?? d.gradientAngle,
    shift: current?.shift ?? d.gradientShift,
  };
}

/** Χτίζει `HatchGradient` από τα flat defaults (next-hatch creation). */
export function buildGradientFromDefaults(d: GradientDefaults): HatchGradient {
  return finalize(toRaw(undefined, d));
}

/**
 * Immutable merge: ξαναχτίζει ΟΛΟ το `HatchGradient` από (current ?? defaults) +
 * την αλλαγή ενός πεδίου. Καταναλώνεται από το ribbon bridge όταν αλλάζει ένα πεδίο
 * gradient σε επιλεγμένη γραμμοσκίαση.
 */
export function withGradientPatch(
  current: HatchGradient | undefined,
  defaults: GradientDefaults,
  patch: GradientFieldPatch,
): HatchGradient {
  const raw = toRaw(current, defaults);
  switch (patch.field) {
    case 'type': raw.type = patch.value; break;
    case 'color1': raw.color1 = patch.value; break;
    case 'color2': raw.color2 = patch.value; break;
    case 'singleColor': raw.singleColor = patch.value; break;
    case 'angleDeg': raw.angleDeg = patch.value; break;
    case 'shift': raw.shift = patch.value; break;
  }
  return finalize(raw);
}
