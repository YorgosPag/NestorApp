/**
 * `ribbon-icon-table` — τα εικονίδια κορδέλας που ανήκουν στις **contextual καρτέλες πίνακα**.
 *
 * Εξήχθη από το `RibbonButtonIcon.tsx` (N.7.1: 533 γραμμές) με **εξαγωγή, όχι κόψιμο**.
 * Ακολουθεί το σχήμα που το ίδιο αρχείο έχει ήδη τρεις φορές — `RibbonButtonIconPaths`,
 * `ribbon-icon-paths-view-measure`, `ribbon-icon-paths-annotation`: ένα module ανά περιοχή.
 *
 * 🔑 **Ένας ιδιοκτήτης**: όλα τα `table-*` εικονίδια ζουν εδώ. Όσο ήταν σκορπισμένα μέσα
 * στον μεγάλο διακόπτη, «ποιο εικονίδιο έχει ο πίνακας;» απαντιόταν μόνο με ανάγνωση 380
 * γραμμών — και κάθε νέα ομάδα (§52 → §56 → §57) πρόσθετε στη μέση.
 *
 * ⚠️ **Τα Β/Ι/Υ ΔΕΝ επαναλαμβάνονται εδώ** (ADR-739 §52): ο πίνακας χρησιμοποιεί αυτούσια
 * τα υπάρχοντα `text-bold` / `text-italic` / `text-underline`, γιατί είναι **η ίδια εντολή
 * σε άλλο συμφραζόμενο** — δύο γλυφές για «έντονα» θα ήταν δύο εικόνες που κάποτε αποκλίνουν.
 * Για τον ίδιο λόγο το `Scissors` ξαναχρησιμοποιείται από το crop / wall-split.
 *
 * @enterprise ADR-739 §52 · §56 (στοίχιση + αριθμός) · §57 (Πρόχειρο) · ADR-760 · ADR-767 Δ3
 */
import React from 'react';
import {
  AArrowDown, AArrowUp,
  AlignCenter, AlignLeft, AlignRight,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart,
  Columns3, Copy, Euro, IndentDecrease, IndentIncrease, Percent, RefreshCw, RotateCcw,
  Rows3, Scissors, Shrink, SquareDashedMousePointer, UnfoldVertical, WrapText,
} from 'lucide-react';

/** Πλάτος/ύψος ανά μέγεθος κουμπιού — ίδιος πίνακας με το `RibbonButtonIcon`. */
const sizePx = { large: 28, small: 16 } as const;

export type RibbonTableIconSize = keyof typeof sizePx;

/**
 * 🔴 **ADR-739 §56** — τα **γλυφά** του Excel (`000`, `.0←`, `.00→`) ως inline SVG κείμενο.
 *
 * ## Γιατί κείμενο και όχι εικονίδιο
 * Δεν **είναι** εικονίδια: είναι τα ίδια ψηφία σε κάθε γλώσσα, στην ίδια θέση της κορδέλας
 * του Excel εδώ και τριάντα χρόνια — και γι' αυτό **δεν μεταφράζονται**. Την ίδια απόφαση
 * παίρνει ήδη το `TableNumberFormatSection` του mini toolbar· εδώ αλλάζει μόνο το μέσο,
 * γιατί το `RibbonButtonIcon` επιστρέφει κόμβο **εικονιδίου** και όχι περιεχόμενο κουμπιού.
 *
 * ## Γιατί SVG και όχι `<span>` με κλάση
 * Το προσβάσιμο **όνομα** έρχεται από το `t()` του κουμπιού (`aria-hidden` εδώ), οπότε το
 * μόνο ζητούμενο είναι σχήμα που ακολουθεί το `currentColor` και τα δύο θέματα. Ένα `<span>`
 * θα απαιτούσε δικό του CSS module για μέγεθος/κεντράρισμα — δηλαδή **τρίτο σημείο** που
 * ξέρει πόσο μεγάλο είναι ένα εικονίδιο κορδέλας, ενώ ο {@link sizePx} το ξέρει ήδη.
 */
export function tableGlyphSvg(size: RibbonTableIconSize, glyph: string): React.ReactElement {
  const px = sizePx[size];
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
      {/* Το μακρύτερο γλυφό (`.00→`) χρειάζεται μικρότερο σώμα για να μη βγει από το πλαίσιο.
          Κατώφλι και όχι per-glyph πίνακας: η ερώτηση είναι «χωράει;», όχι «ποιο είναι;». */}
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={glyph.length > 3 ? 7 : 9}
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        {glyph}
      </text>
    </svg>
  );
}

/**
 * Επιστρέφει τον κόμβο εικονιδίου για ένα `table-*` κλειδί, ή **`null`** αν το κλειδί δεν
 * ανήκει εδώ.
 *
 * ⚠️ Το `null` είναι σημαντικό: ο καλών **συνεχίζει** τον δικό του διακόπτη και καταλήγει
 * στο δικό του `default`. Ένα fallback εικονίδιο εδώ θα έκρυβε άγνωστα κλειδιά **άλλων**
 * περιοχών πίσω από μια τελεία που μοιάζει σωστή.
 */
export function resolveTableRibbonIcon(
  /** Δέχεται και `undefined`: το κουμπί κορδέλας μπορεί να μην έχει καθόλου εικονίδιο. */
  icon: string | undefined,
  size: RibbonTableIconSize,
  className: string,
): React.ReactElement | null {
  const px = sizePx[size];
  switch (icon) {
    // ── §52: δομή (γραμμές / στήλες / επιλογή / μέγεθος γραμματοσειράς) ──────────────
    case 'table-row-insert-above': return <BetweenHorizontalStart width={px} height={px} className={className} />;
    case 'table-row-insert-below': return <BetweenHorizontalEnd width={px} height={px} className={className} />;
    case 'table-col-insert-left': return <BetweenVerticalStart width={px} height={px} className={className} />;
    case 'table-col-insert-right': return <BetweenVerticalEnd width={px} height={px} className={className} />;
    case 'table-row-delete': return <Rows3 width={px} height={px} className={className} />;
    case 'table-col-delete': return <Columns3 width={px} height={px} className={className} />;
    case 'table-select-all': return <SquareDashedMousePointer width={px} height={px} className={className} />;
    case 'table-size-up': return <AArrowUp width={px} height={px} className={className} />;
    case 'table-size-down': return <AArrowDown width={px} height={px} className={className} />;
    case 'table-reset-format': return <RotateCcw width={px} height={px} className={className} />;

    // ── §57: η ομάδα «Πρόχειρο» ──────────────────────────────────────────────────────
    // Η **Επικόλληση** δεν είναι εδώ: είναι widget με δικό του εικονίδιο
    // (`ClipboardPaste` μέσα στο `TablePasteMenu`), γιατί είναι split button.
    case 'table-cut': return <Scissors width={px} height={px} className={className} />;
    case 'table-copy': return <Copy width={px} height={px} className={className} />;

    // ── ADR-767 Δ3: «Ανανέωση» — ο πίνακας ξαναρωτά την πηγή του ─────────────────────
    // `RefreshCw` (κυκλικό, με φορά) και **όχι** `RotateCcw` — εκείνο σημαίνει ήδη
    // «επαναφορά μορφοποίησης» παραπάνω, και δύο εντολές του **ίδιου** πίνακα με το ίδιο
    // εικονίδιο θα ήταν δύο κουμπιά που μοιάζουν ίδια και κάνουν άσχετα πράγματα.
    case 'table-refresh-binding': return <RefreshCw width={px} height={px} className={className} />;

    // ── §56: οι έξι θέσεις στοίχισης ─────────────────────────────────────────────────
    // Τα ίδια εικονίδια με το mini toolbar (`TableAlignMenu`).
    case 'table-align-left': return <AlignLeft width={px} height={px} className={className} />;
    case 'table-align-center': return <AlignCenter width={px} height={px} className={className} />;
    case 'table-align-right': return <AlignRight width={px} height={px} className={className} />;
    case 'table-align-top': return <AlignVerticalJustifyStart width={px} height={px} className={className} />;
    case 'table-align-middle': return <AlignVerticalJustifyCenter width={px} height={px} className={className} />;
    case 'table-align-bottom': return <AlignVerticalJustifyEnd width={px} height={px} className={className} />;

    // ── §58 Γ2: «τι γίνεται όταν δεν χωράει» + «ποιος κατέχει το ύψος» ───────────────
    // Το `WrapText` είναι **το ίδιο** εικονίδιο με το mini toolbar (`TableFormatSection`):
    // ίδια εντολή σε άλλο συμφραζόμενο, όπως τα Β/Ι/Υ που η κεφαλίδα εξηγεί παραπάνω.
    case 'table-wrap-text': return <WrapText width={px} height={px} className={className} />;
    case 'table-shrink-text': return <Shrink width={px} height={px} className={className} />;
    // ── §59 Δ2: η εσοχή ──────────────────────────────────────────────────────────────
    // `IndentDecrease`/`IndentIncrease` της lucide — **οι ίδιες γλυφές** με του Excel και του
    // Word (γραμμές κειμένου + βέλος προς τα μέσα/έξω). Καμία δική μας ζωγραφιά: ο χρήστης
    // αναγνωρίζει το σχήμα πριν διαβάσει το tooltip, που είναι όλο το ζητούμενο του §56.
    case 'table-indent-decrease': return <IndentDecrease width={px} height={px} className={className} />;
    case 'table-indent-increase': return <IndentIncrease width={px} height={px} className={className} />;
    // `UnfoldVertical` (βέλη που ανοίγουν κατακόρυφα) και **όχι** `RotateCcw`/`RefreshCw`:
    // εκείνα σημαίνουν ήδη «επαναφορά μορφοποίησης» και «ανανέωση δεσμού» στον **ίδιο** πίνακα.
    case 'table-row-autofit': return <UnfoldVertical width={px} height={px} className={className} />;

    // ── §56 / ADR-760: η ομάδα «Αριθμός» ─────────────────────────────────────────────
    case 'table-number-accounting': return <Euro width={px} height={px} className={className} />;
    case 'table-number-percent': return <Percent width={px} height={px} className={className} />;
    case 'table-number-grouping': return tableGlyphSvg(size, '000');
    case 'table-decimal-down': return tableGlyphSvg(size, '.0←');
    case 'table-decimal-up': return tableGlyphSvg(size, '.00→');

    default: return null;
  }
}
