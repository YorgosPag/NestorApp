/**
 * overlay-label-layout — SSoT για ANTI-COLLISION τοποθέτηση overlay text labels.
 *
 * Επεκτείνει το τεκμηριωμένο ΣΥΜΒΟΛΑΙΟ μη-επικάλυψης που ξεκίνησε το `CURSOR_LABEL_SLOTS`
 * (`overlay-text-style.ts`): «η μη-επικάλυψη είναι ΣΥΜΒΟΛΑΙΟ, όχι σύμπτωση». Όπου το
 * `CURSOR_LABEL_SLOTS` στοιβάζει cursor-anchored tooltips, αυτό το module κατέχει τη γεωμετρία
 * για labels τοποθετημένα ΚΑΘΑΡΑ ΠΕΡΑ από έναν άξονα/anchor κατά μήκος μιας κατεύθυνσης — κάνοντας
 * την απόσταση **TEXT-BOX-AWARE** ώστε ένα πλατύ label να ΜΗΝ διασχίζει ποτέ τον άξονα ανεξάρτητα
 * από τη γωνία του τοίχου/τμήματος.
 *
 * **Root του «vertical-wall collapse»:** σε κάθετο/απότομο τοίχο η κάθετη-στον-άξονα κατεύθυνση
 * γίνεται σχεδόν οριζόντια· ένα σταθερό px offset (που αγνοεί το ΠΛΑΤΟΣ του κειμένου) αφήνει το
 * πλατύ κείμενο να «γεφυρώσει» απέναντι και να πέσει πάνω στο label της άλλης πλευράς. Η λύση:
 * η απόσταση να περιλαμβάνει το **μισό μέγεθος του box προβεβλημένο στην κατεύθυνση offset**.
 *
 * Big-player parity (Revit/AutoCAD): το dimension text κάθεται με gap που καθαρίζει το glyph box
 * της διάστασης· identity vs dimension σε ξεχωριστές baselines.
 *
 * Pure module — μηδέν React/stores/DOM. Screen-px παντού (ADR-040 micro-leaf safe).
 *
 * @see ./overlay-text-style.ts — `OVERLAY_TEXT_FONT` + `CURSOR_LABEL_SLOTS` (το συγγενικό contract)
 */

import { OVERLAY_TEXT_FONT } from './overlay-text-style';

/** Screen-px διαστάσεις ενός label box. */
export interface LabelBox {
  readonly w: number;
  readonly h: number;
}

/** Μηδενικό box — for labels χωρίς κείμενο ή για byte-identical (μη box-aware) συμπεριφορά. */
export const EMPTY_LABEL_BOX: LabelBox = { w: 0, h: 0 };

/**
 * Μέτρησε το screen-px box ενός label με τον canonical overlay font (ή έναν δοθέντα). Το ύψος
 * προκύπτει από το px-prefix του font string (`"<px>px ..."`) γιατί το `measureText().height`
 * (actualBoundingBox*) είναι αναξιόπιστο/ανύπαρκτο σε αρκετές μηχανές — ο canonical font είναι
 * πάντα `"<px>px <family>"`, οπότε το px είναι η αυθεντία για το line height.
 */
export function measureOverlayLabelBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string = OVERLAY_TEXT_FONT,
): LabelBox {
  if (!text) return EMPTY_LABEL_BOX;
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  const h = parseFloat(font) || 11;
  return { w, h };
}

/**
 * Μισή προβολή (screen px) ενός ΚΕΝΤΡΑΡΙΣΜΕΝΟΥ `box` πάνω σε μια screen-space ΜΟΝΑΔΙΑΙΑ κατεύθυνση
 * με απόλυτες συνιστώσες (|nx|, |ny|) = πόσο φτάνει η ακμή του box κατά μήκος αυτής της κατεύθυνσης
 * από το κέντρο του.
 *
 * Υπό τον DXF 2D μετασχηματισμό (scale + translate + Y-flip, ΧΩΡΙΣ rotation) οι **απόλυτες**
 * συνιστώσες της screen κάθετης ισούνται με αυτές της **world** μοναδιαίας κάθετης· έτσι ο caller
 * μπορεί να περάσει απευθείας τις world unit-perp συνιστώσες (μηδέν επιπλέον projection/`toScreen`).
 */
export function boxHalfExtentAlong(nx: number, ny: number, box: LabelBox): number {
  return Math.abs(nx) * (box.w / 2) + Math.abs(ny) * (box.h / 2);
}

/**
 * Screen-px απόσταση ώστε ένα ΚΕΝΤΡΑΡΙΣΜΕΝΟ label να κάθεται πλήρως ΚΑΘΑΡΟ ενός άξονα: βασικό κενό
 * `baseClearPx` ΣΥΝ το μισό μέγεθος του box κατά την κατεύθυνση offset. Η κοντινή ακμή του label
 * τελειώνει ακριβώς `baseClearPx` πέρα από τον άξονα — **ανεξάρτητα γωνίας** (κάθετο → καθαρίζει το
 * μισό ΠΛΑΤΟΣ· οριζόντιο → το μισό ΥΨΟΣ). Ένας τύπος σκοτώνει το vertical-wall overlap.
 */
export function clearanceForBox(nx: number, ny: number, box: LabelBox, baseClearPx: number): number {
  return baseClearPx + boxHalfExtentAlong(nx, ny, box);
}
