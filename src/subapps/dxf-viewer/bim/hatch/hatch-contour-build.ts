/**
 * Hatch Contour-Pen build SSoT (ADR-507 — «περίγραμμα» pen: ορατότητα / χρώμα /
 * πάχος / τύπος γραμμής, ArchiCAD-style boundary pen).
 *
 * Pure leaf: χτίζει το nested `HatchContourPen` object από flat πεδία (draw-defaults
 * ή ribbon edits), ΜΙΑ φορά — mirror του `hatch-gradient-build.ts` / `hatch-image-build.ts`.
 * Το μοιράζονται το ribbon bridge (`useRibbonHatchBridge` / `hatch-contour-bridge.ts`)
 * και η δημιουργία οντότητας (`hatch-completion.ts` → `buildHatchEntityFromBoundary`).
 *
 * Sentinels — «καμία αλλαγή» ⇒ γράφεται ΑΠΟΝ στο τελικό `HatchContourPen` (ζωντανή
 * κληρονομιά, μηδέν regression για hatches που δεν αγγίζουν ποτέ το περίγραμμα):
 *   - `contourColor === ''` ⇒ `color` απόν ⇒ κληρονομεί το `fillColor` (βλ. entities.ts).
 *   - `contourLineweightMm` μη-concrete (ByLayer/default) ⇒ `lineweightMm` απόν ⇒ 1px hairline.
 *   - `contourLinetypeName === ''` ⇒ `linetypeName` απόν ⇒ `Continuous`.
 *
 * @see ./hatch-properties.ts — `isHatchContourVisible` (read SSoT της ορατότητας)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { HatchContourPen, LineweightMm } from '../../types/entities';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/**
 * Flat contour-pen ρυθμίσεις — πηγή για το `HatchContourPen`. Τα ονόματα ταιριάζουν
 * με τα αντίστοιχα πεδία του `HatchDrawDefaults` (structural reuse → μηδέν mapping).
 */
export interface ContourDefaults {
  readonly contourVisible: boolean;
  readonly contourColor: string;
  readonly contourLineweightMm: LineweightMm;
  readonly contourLinetypeName: string;
}

/** Ένα πεδίο contour pen που μπορεί να αλλάξει το ribbon (1-προς-1 με τα command keys). */
export type ContourFieldPatch =
  | { readonly field: 'visible'; readonly value: boolean }
  | { readonly field: 'color'; readonly value: string }
  | { readonly field: 'lineweightMm'; readonly value: LineweightMm }
  | { readonly field: 'linetypeName'; readonly value: string };

/** Εσωτερική «πλήρης» μορφή (όλα τα πεδία παρόντα) — εύκολο immutable merge. */
interface RawContourPen {
  visible: boolean;
  color: string; // '' = μη-customized
  lineweightMm: LineweightMm; // μη-concrete = μη-customized
  linetypeName: string; // '' = μη-customized
}

/** Trimmed canonical `HatchContourPen`: παραλείπει πεδία στο ουδέτερό τους (sentinel). */
function finalize(raw: RawContourPen): HatchContourPen {
  return {
    visible: raw.visible,
    color: raw.color !== '' ? raw.color : undefined,
    lineweightMm: isConcreteLineweight(raw.lineweightMm) ? raw.lineweightMm : undefined,
    linetypeName: raw.linetypeName !== '' ? raw.linetypeName : undefined,
  };
}

/** Ανάκτηση πλήρους `RawContourPen` από (trimmed entity contourPen ?? defaults). */
function toRaw(current: HatchContourPen | undefined, d: ContourDefaults): RawContourPen {
  return {
    visible: current?.visible ?? d.contourVisible,
    color: current?.color ?? d.contourColor,
    lineweightMm: current?.lineweightMm ?? d.contourLineweightMm,
    linetypeName: current?.linetypeName ?? d.contourLinetypeName,
  };
}

/** Χτίζει `HatchContourPen` από τα flat defaults (next-hatch creation). */
export function buildContourPenFromDefaults(d: ContourDefaults): HatchContourPen {
  return finalize(toRaw(undefined, d));
}

/**
 * Immutable merge: ξαναχτίζει ΟΛΟ το `HatchContourPen` από (current ?? defaults) +
 * την αλλαγή ενός πεδίου. Καταναλώνεται από το ribbon bridge όταν αλλάζει ένα πεδίο
 * περιγράμματος σε επιλεγμένη γραμμοσκίαση.
 */
export function withContourPenPatch(
  current: HatchContourPen | undefined,
  defaults: ContourDefaults,
  patch: ContourFieldPatch,
): HatchContourPen {
  const raw = toRaw(current, defaults);
  switch (patch.field) {
    case 'visible': raw.visible = patch.value; break;
    case 'color': raw.color = patch.value; break;
    case 'lineweightMm': raw.lineweightMm = patch.value; break;
    case 'linetypeName': raw.linetypeName = patch.value; break;
  }
  return finalize(raw);
}

/**
 * `true` όταν τα draw-defaults δεν διαφέρουν καθόλου από το ιστορικό «απόν» baseline
 * (ορατό, μηδέν overrides) — τότε η νέα γραμμοσκίαση παραλείπει το `contourPen` εντελώς
 * (zero-diff με πριν την προσθήκη του UI ελέγχου, μηδέν αχρείαστο churn σε ήδη σωστά
 * αποθηκευμένα έγγραφα).
 */
export function isContourAtBaseline(d: ContourDefaults): boolean {
  return d.contourVisible === true
    && d.contourColor === ''
    && !isConcreteLineweight(d.contourLineweightMm)
    && d.contourLinetypeName === '';
}
