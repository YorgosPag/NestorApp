/**
 * SSoT — **πώς φαίνεται μια raster εικόνα που δεν έχει (ακόμη) περιεχόμενο** (ADR-736 Φ2).
 *
 * 🔴 **Η απόφαση σχεδιασμού, σε μία πρόταση:** στον Revit ένας χαμένος σύνδεσμος απλώς
 * **εξαφανίζεται** — ο χρήστης βλέπει κενό και δεν μαθαίνει ποτέ ότι κάτι έλειπε. Εδώ το
 * πλαίσιο μένει στη **θέση, στις διαστάσεις και στη γωνία** που δηλώνει το σχέδιο, και φέρει
 * το **όνομα του αρχείου** που ζητά. Ο χρήστης βλέπει **τι** λείπει **και πού** ανήκει —
 * δηλαδή έχει αρκετή πληροφορία για να το βρει, χωρίς να ανοίξει κανένα μητρώο.
 *
 * **Δύο καταστάσεις, ένα σχήμα — και αυτό είναι σκόπιμο:**
 *   · *φορτώνει* (υπάρχει `url`, δεν έχει γίνει decode ακόμη) → σκέτο διακεκομμένο πλαίσιο·
 *   · *ανεπίλυτη αναφορά* (δεν υπάρχει `url`) → ίδιο πλαίσιο **συν** το όνομα.
 * Η παρουσία της ετικέτας είναι η διάκριση. **Κανένα χρώμα συναγερμού**: το μοντέλο ορίζει
 * ρητά ότι το `missing` είναι **φυσιολογική κατάσταση, όχι σφάλμα** (ίδια στάση με Revit
 * *Manage Links* / AutoCAD *External References*) — κόκκινο πλαίσιο θα αντέφασκε με το ίδιο
 * μας το μοντέλο και θα ούρλιαζε σε κάθε άνοιγμα ενός απολύτως υγιούς σχεδίου.
 *
 * ⚠️ Καθαρή συνάρτηση καμβά: **μηδέν** store, **μηδέν** React, μηδέν `useSyncExternalStore`
 * (ADR-040 — ο `ImageRenderer` είναι pure leaf). Δέχεται **screen** κορυφές· η προβολή έχει
 * ήδη γίνει από τον καλούντα.
 *
 * @see rendering/entities/ImageRenderer.ts — ο καταναλωτής (on-screen)
 * @see types/dxf-external-reference.ts — γιατί το «λείπει» δεν είναι σφάλμα
 */

import type { Point2D } from '../../types/Types';
import { CAD_UI_COLORS } from '../../../config/color-config';
import { buildUIFont } from '../../../config/text-rendering-config';
import { fitCanvasPathToWidth, fitCanvasTextToWidth } from './canvas-text-fit';

/** Μοτίβο παύλας του πλαισίου (screen px) — ίδιο ιδίωμα με τα υπόλοιπα fallback περιγράμματα. */
const PLACEHOLDER_DASH: readonly [number, number] = [4, 4];

/** Γραμματοσειρά ετικέτας — η ίδια οικογένεια/μέγεθος με τις ετικέτες μέτρησης (ADR-091). */
const PLACEHOLDER_LABEL_FONT = buildUIFont(11, 'arial');

/**
 * Κάτω από αυτό το μέγεθος (screen px της περιβάλλουσας του πλαισίου) η ετικέτα **παραλείπεται**.
 * Ένα υπόβαθρο σε zoom-extents μπορεί να είναι 20px· ένα όνομα εκεί δεν διαβάζεται και μόνο
 * λερώνει το σχέδιο. Ίδιο LOD σκεπτικό με τη γραμμοσκίαση (`hatch-density-lod`).
 */
const MIN_LABEL_BOX_PX = { width: 48, height: 16 } as const;

/** Ποσοστό του πλάτους της περιβάλλουσας που επιτρέπεται να καταλάβει η ετικέτα. */
const LABEL_WIDTH_RATIO = 0.9;

/**
 * Διακεκομμένο πλαίσιο στις **πραγματικές** κορυφές (άρα σέβεται περιστροφή), με προαιρετική
 * ετικέτα στο κέντρο.
 *
 * Η ετικέτα ζωγραφίζεται **οριζόντια στον χώρο οθόνης**, όχι στραμμένη μαζί με το πλαίσιο:
 * σε στραμμένο υπόβαθρο (και ειδικά κοντά στις 180°) η «πιστή» στραμμένη ετικέτα διαβάζεται
 * ανάποδα. Το ίδιο κάνουν Figma/ArchiCAD για τα σήματα συνδέσμων — η ετικέτα είναι **σχόλιο
 * του εργαλείου**, όχι περιεχόμενο του σχεδίου.
 */
export function paintImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  screenCorners: readonly Point2D[],
  label?: string,
  path?: string,
): void {
  if (screenCorners.length < 2) return;

  ctx.save();
  ctx.strokeStyle = CAD_UI_COLORS.entity.default;
  ctx.lineWidth = 1;
  ctx.setLineDash([...PLACEHOLDER_DASH]);
  ctx.beginPath();
  screenCorners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
  if (label) paintPlaceholderLabel(ctx, screenCorners, label, path);
  ctx.restore();
}

/**
 * Η ετικέτα, κεντραρισμένη στην **περιβάλλουσα** των screen κορυφών. Η περιβάλλουσα (και όχι
 * το μήκος κάποιας ακμής) είναι το σωστό μέτρο: η ετικέτα είναι οριζόντια, οπότε ο διαθέσιμος
 * χώρος της είναι το οριζόντιο άνοιγμα του πλαισίου **όπως φαίνεται**, σε οποιαδήποτε γωνία.
 */
function paintPlaceholderLabel(
  ctx: CanvasRenderingContext2D,
  screenCorners: readonly Point2D[],
  label: string,
  path?: string,
): void {
  const xs = screenCorners.map((p) => p.x);
  const ys = screenCorners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxX - minX < MIN_LABEL_BOX_PX.width || maxY - minY < MIN_LABEL_BOX_PX.height) return;

  // Η γραμματοσειρά μπαίνει ΠΡΙΝ το fit — το `fitCanvasTextToWidth` μετρά με την τρέχουσα
  // κατάσταση του context, και μέτρηση με άλλη γραμματοσειρά από τη σχεδίαση δεν χωράει.
  ctx.font = PLACEHOLDER_LABEL_FONT;
  const available = (maxX - minX) * LABEL_WIDTH_RATIO;

  /**
   * ADR-736 §2.Β — **υπερσύνολο του AutoCAD, όχι εναλλακτική του.** Η κλίμακα αποφασίζει πόση
   * αλήθεια χωράει, και η υποβάθμιση είναι μονότονη: πλήρης διαδρομή → μεσαία αποκοπή →
   * σκέτο όνομα → τίποτα (το τελευταίο το έκοψε ήδη το LOD πιο πάνω). Ο AutoCAD μένει στο
   * πρώτο σκαλί σε **κάθε** zoom, οπότε σε zoom-extents γεμίζει το σχέδιο μουτζούρες.
   */
  const fitted =
    (path ? fitCanvasPathToWidth(ctx, path, available) : null) ??
    fitCanvasTextToWidth(ctx, label, available);
  if (!fitted) return;

  ctx.setLineDash([]);
  ctx.fillStyle = CAD_UI_COLORS.entity.default;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitted, (minX + maxX) / 2, (minY + maxY) / 2);
}
