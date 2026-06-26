/**
 * T-beam effective flange width `b_eff` (EC2 §5.3.2.1) — SSoT (ADR-534 Φ3b).
 *
 * Σε **μονολιθική πλακοδοκό** (η πλάκα χύνεται μαζί με τη δοκό, ADR-534) η πλάκα
 * λειτουργεί ως **θλιβόμενο πέλμα** της δοκού. Το ενεργό πλάτος του πέλματος που
 * συμμετέχει στη θλίψη ΔΕΝ είναι όλο το άνοιγμα της πλάκας — περιορίζεται από τη
 * διατμητική υστέρηση (shear lag) στο `b_eff` (EC2 §5.3.2.1, Σχ. 5.3):
 *
 *   `b_eff = b_w + Σ b_eff,i`         (≤ συνολικό διαθέσιμο πλάτος πέλματος)
 *   `b_eff,i = min(0.2·b_i + 0.1·l_0,  0.2·l_0,  b_i)`
 *
 * όπου `b_w` = πλάτος κορμού, `b_i` = διαθέσιμη προεξοχή πλάκας ανά πλευρά,
 * `l_0` = απόσταση σημείων μηδενικής ροπής (Σχ. 5.2). Όταν το `b_i` είναι άγνωστο
 * (καμία ρητή γειτονική δοκός), **κυριαρχεί ο όρος `0.2·l_0`** → `b_eff,i = 0.2·l_0`.
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm. Geometry-is-SSoT: ο caller που γνωρίζει
 * αν/πόσο η πλάκα καλύπτει τη δοκό (scene access) παράγει τα ορίσματα· η αμιγής δοκός
 * (καμία καλύπτουσα πλάκα) ΔΕΝ καλεί καθόλου → `b_eff = b_w` (ορθογώνια, μηδέν regression).
 *
 * @see ./suggest-reinforcement.ts — καμπτική πύλη (consumer: σαγκ. ροπή → πλάτος θλίψης = b_eff)
 * @see ../beam-flange-context.ts — detector (καλύπτουσα πλάκα → b_eff μέσω αυτού του SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §Φ3b
 */

import type { BeamSupportType } from '../../types/beam-types';

/**
 * EC2 Σχ. 5.2 — απόσταση σημείων μηδενικής ροπής `l_0` ως κλάσμα του ανοίγματος `l`,
 * ανά συνθήκη στήριξης (απλοποιημένη, μελετητική σύμβαση):
 *   · αμφιέρειστη (`simple`)      → 1.00·l (μηδενική ροπή στα δύο άκρα)
 *   · συνεχής/αμφίπακτη           → 0.70·l (αντιπροσωπευτικό εσωτερικό άνοιγμα)
 *   · πρόβολος (`cantilever`)     → 2.00·l (μηδενική ροπή μόνο στο ελεύθερο άκρο)
 */
export function zeroMomentSpanFactor(supportType: BeamSupportType): number {
  switch (supportType) {
    case 'cantilever':
      return 2.0;
    case 'continuous':
    case 'fixed':
      return 0.7;
    default:
      return 1.0;
  }
}

/** Παράμετροι υπολογισμού `b_eff` (EC2 §5.3.2.1). */
export interface EffectiveFlangeInput {
  /** Πλάτος κορμού δοκού `b_w` (mm). */
  readonly webWidthMm: number;
  /** Καθαρό άνοιγμα / μήκος δοκού `l` (mm). */
  readonly spanMm: number;
  /** Συνθήκη στήριξης → `l_0` μέσω {@link zeroMomentSpanFactor}. */
  readonly supportType: BeamSupportType;
  /**
   * Πλήθος πλευρών με πέλμα: εσωτερική δοκός (πλάκα εκατέρωθεν) = **2** (T-beam)·
   * ακραία/περιμετρική (πλάκα μία πλευρά) = **1** (L-beam). Default 2 (μονολιθική
   * πλάκα οροφής που καλύπτει — ADR-534). Edge/L auto-detection = DEFER.
   */
  readonly flangeSides?: 1 | 2;
  /**
   * Διαθέσιμη προεξοχή πλάκας ανά πλευρά `b_i` (mm) — μισή καθαρή απόσταση προς τη
   * γειτονική δοκό. Όταν δοθεί, εφαρμόζεται ο πλήρης EC2 περιορισμός· απών ⇒ κυριαρχεί
   * το `0.2·l_0` (καμία ρητή γειτονική δοκός, άνω φράγμα EC2).
   */
  readonly slabOverhangEachSideMm?: number;
}

/** Συνεισφορά πέλματος μίας πλευράς `b_eff,i` (mm), EC2 §5.3.2.1(3). */
function flangeContributionPerSideMm(zeroMomentSpanMm: number, overhangMm?: number): number {
  const cap = 0.2 * zeroMomentSpanMm;
  if (overhangMm === undefined) return cap; // b_i άγνωστο → κυριαρχεί ο cap 0.2·l_0
  const bi = Math.max(0, overhangMm);
  return Math.min(0.2 * bi + 0.1 * zeroMomentSpanMm, cap, bi);
}

/**
 * Ενεργό πλάτος πέλματος `b_eff` (mm), EC2 §5.3.2.1. Πάντα `≥ b_w` (το πέλμα προστίθεται
 * στον κορμό). Εκφυλισμένη είσοδος (μη-θετικό `b_w`/`span`) ⇒ `max(0, b_w)`.
 */
export function computeEffectiveFlangeWidthMm(input: EffectiveFlangeInput): number {
  const bw = Math.max(0, input.webWidthMm);
  if (bw <= 0 || input.spanMm <= 0) return bw;
  const l0 = input.spanMm * zeroMomentSpanFactor(input.supportType);
  const sides = input.flangeSides ?? 2;
  return bw + sides * flangeContributionPerSideMm(l0, input.slabOverhangEachSideMm);
}
