/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **πού ακριβώς κάθεται η υπογράμμιση ενός κελιού.**
 *
 * Μία συνάρτηση, δύο πλαίσια συντεταγμένων: ο ζωγράφος του καμβά τη ρωτά σε **px οθόνης**,
 * η γέφυρα εξαγωγής σε **sheet-mm**. Και τα δύο πλαίσια είναι y-κάτω και οι αποκρίσεις
 * είναι γραμμικές στο `em`, οπότε η **ίδια** συνάρτηση απαντά και στα δύο — δεν υπάρχει
 * σημείο όπου η υπογράμμιση της οθόνης και η υπογράμμιση του αρχείου να διαφωνήσουν.
 *
 * ## 🔴 Το ελάττωμα που έκλεισε εδώ — η υπογράμμιση ήταν 0,2·em ΨΗΛΑ
 *
 * Ο ζωγράφος του βήματος 3 τοποθετούσε τη γραμμή στο `em × (UNDERLINE_EM − 1)` με το σχόλιο
 * «όπως κάνει και ο `TextRenderer`». **Δεν το κάνει.** Και οι δύο καταναλωτές του
 * `TEXT_DECORATION_RATIOS` — `TextRenderer.paintDecorations` και
 * `explode-text.emitSpanDecorations` — αφαιρούν το `anchorBandFraction(baseline, …)`, όχι
 * τη μονάδα:
 *
 * ```
 *   fillRect(x, y + emPx * (UNDERLINE_EM - baselineVOffset), width, thickness)
 * ```
 *
 * Το `1` σημαίνει «η άγκυρα είναι η **γραμμή καθόδου**» (0 = ανιούσα, 1 = κατιούσα, όπως
 * λέει ρητά η τεκμηρίωση του `anchorBandFraction`). Η άγκυρα όμως ενός `TableTextRun` είναι
 * η **γραμμή βάσης** (`textBaseline = 'alphabetic'`), που κάθεται στο
 * `ascent ÷ (ascent + descent)` της ζώνης — **0,8** με τις ονομαστικές αναλογίες του έργου
 * (`TEXT_METRICS_RATIOS`), 0,81 με τις πραγματικές μετρήσεις της Arial.
 *
 * Η διαφορά είναι `1 − 0,8 = 0,2·em`: η γραμμή έβγαινε **πάνω** από τη βάση (στο −0,10·em
 * αντί για +0,10·em) και έκοβε τα ίδια τα γράμματα. Σε κείμενο κελιού 3mm είναι 0,6mm.
 * Κανένα test δεν το έπιασε επειδή το test αντέγραφε τον **ίδιο** τύπο με τον κώδικα —
 * κλείδωνε τη συμπεριφορά, δεν τη διασταύρωνε με τον SSoT που επικαλείτο το σχόλιο.
 *
 * ## Γιατί ονομαστικές αναλογίες και όχι πραγματικές μετρήσεις γραμματοσειράς
 * Ο ζωγράφος του πίνακα περνά από `ctx.fillText` (CSS), όχι από περιγράμματα opentype —
 * είναι η ίδια διαδρομή που το `NOMINAL` του `text-vertical-metrics` υπηρετεί όταν καμία
 * γραμματοσειρά δεν έχει φορτωθεί. Επιπλέον η **εξαγωγή** πρέπει να παράγει την ίδια
 * γεωμετρία σε περιβάλλον χωρίς DOM (jest, worker), όπου δεν υπάρχει τι να μετρηθεί. Μία
 * σταθερή, δηλωμένη ζώνη είναι εδώ η **σωστή** απάντηση, όχι συμβιβασμός: η απόκλιση από
 * τις πραγματικές μετρήσεις της Arial είναι 0,01·em (0,03mm σε κείμενο 3mm).
 *
 * @module subapps/dxf-viewer/bim/table/table-text-decoration
 */

import { TEXT_DECORATION_RATIOS, TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
import { anchorBandFraction } from '../../text-engine/fonts/text-vertical-metrics';
import { anchorOffset } from '../../text-engine/fonts/text-horizontal-anchor';
import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';

/**
 * Πού κάθεται η **γραμμή βάσης** μέσα στη ζώνη ανιούσας→κατιούσας, ως κλάσμα της ζώνης.
 * Υπολογίζεται από το ΙΔΙΟ SSoT που καλούν ο `TextRenderer` και το explode
 * (`anchorBandFraction`), με τις ονομαστικές αναλογίες του έργου — **κανένας νέος αριθμός**.
 */
export const TABLE_BASELINE_BAND_FRACTION: number = anchorBandFraction('alphabetic', {
  ascent: TEXT_METRICS_RATIOS.ASCENT_RATIO,
  descent: TEXT_METRICS_RATIOS.DESCENT_RATIO,
});

/** Η γραμμή υπογράμμισης ενός run, στις μονάδες του πλαισίου που ρώτησε (px ή mm). */
export interface TableUnderlineGeometry {
  /** Αριστερή ακμή, **σχετικά με την άγκυρα** του run (αρνητική σε κέντρο/δεξιά στοίχιση). */
  readonly x: number;
  /** Απόσταση **κάτω** από τη γραμμή βάσης (θετική = προς τα κάτω, y-down πλαίσιο). */
  readonly y: number;
  readonly width: number;
  readonly thickness: number;
}

/**
 * Η γραμμή υπογράμμισης για ένα run με μέγεθος `em` και μετρημένο πλάτος `advance`.
 *
 * Το `hAlign` καθορίζει από ποια μεριά της άγκυρας απλώνεται το κείμενο — ίδια σύμβαση με
 * το `ctx.textAlign` του καμβά **και** με το `anchorXMm` της διάταξης, ώστε η γραμμή να
 * ακολουθεί τη στοίχιση χωρίς δεύτερο ternary σε κάθε καταναλωτή. Το «πού ξεκινούν τα
 * γράμματα» το απαντά το {@link anchorOffset} — το ΙΔΙΟ SSoT με τον renderer, το explode και
 * το clip (ADR-753 Φ4). Εδώ ζούσε ως ιδιωτικό `tableAnchorOffsetMm`: η Φ3 ένωσε τα δύο
 * σώματα του `bim/table`, η Φ4 τα ένωσε και με τα τέσσερα έξω από αυτό.
 */
export function tableUnderlineGeometry(
  em: number, advance: number, hAlign: TextAlign,
): TableUnderlineGeometry {
  return {
    x: anchorOffset(hAlign, advance),
    y: em * (TEXT_DECORATION_RATIOS.UNDERLINE_EM - TABLE_BASELINE_BAND_FRACTION),
    width: advance,
    thickness: em * TEXT_DECORATION_RATIOS.THICKNESS_EM,
  };
}
