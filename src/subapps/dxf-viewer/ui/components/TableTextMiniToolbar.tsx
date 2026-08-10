'use client';

/**
 * ADR-739 §67 — **το δεξί κλικ ΜΕΣΑ σε κελί που επεξεργάζεσαι**: **μόνο** το mini toolbar.
 *
 * ## 🔴 §67.10 — ΤΟ ΜΕΝΟΥ ΕΦΥΓΕ, ΚΑΙ Η ΜΕΤΡΗΣΗ ΤΟ ΖΗΤΗΣΕ
 * Η πρώτη γραφή του §67 έδειχνε **και** μενού πέντε εντολών **και** τη γραμμή. Ο ιδιοκτήτης
 * μέτρησε το Excel (στιγμιότυπο 10/08, κελί `K15` σε Επεξεργασία): δεξί κλικ πάνω σε
 * μαρκαρισμένους χαρακτήρες ⇒ **μόνο η γραμμή**, κανένα μενού. Το μενού **διαγράφηκε** αντί να
 * κρυφτεί: ένα μητρώο πέντε εντολών που δεν αποδίδεται ποτέ είναι νεκρός κώδικας με πράσινα
 * tests από πάνω του.
 *
 * ⚠️ **Καμία λειτουργία δεν χάθηκε.** Οι τρεις εντολές που έφυγαν (αποκοπή / αντιγραφή /
 * επικόλληση **κειμένου**) ζουν στα `Ctrl+X`/`Ctrl+C`/`Ctrl+V`, που δουλεύουν **φυσικά** μέσα
 * στο `<textarea>` — δηλαδή μέσω του browser, με IME και ελληνικούς τόνους, χωρίς άδεια
 * προχείρου και χωρίς μία γραμμή δικού μας κώδικα. Αυτός είναι και ο λόγος που το Excel δεν τις
 * δείχνει: η χειρονομία τους δεν είναι το δεξί κλικ.
 *
 * ## 🔴 ΤΙ ΑΛΛΑΖΕΙ ΟΤΑΝ ΦΕΥΓΕΙ ΤΟ ΜΕΝΟΥ — ο κύκλος ζωής γίνεται ΔΙΚΟΣ ΜΑΣ
 * Στις δύο άλλες υποδοχές η γραμμή κάθεται πάνω σε μενού Radix, οπότε το κλείσιμό της είναι
 * δωρεάν (`DismissableLayer`: `Escape` + κλικ έξω ⇒ ο ένας δρόμος εξόδου σβήνει τον στόχο).
 * Χωρίς μενού **δεν υπάρχει τίποτα που να την κλείνει** — γι' αυτό ο κύκλος ζωής εδώ είναι
 * ρητός: {@link useTransientSurfaceDismiss}, με τον κανόνα του Excel («any key», «scroll
 * wheel», κλικ έξω). Δες την κεφαλίδα εκείνου για το γιατί **δεν** μπαίνει στον escape-bus.
 *
 * ## 🔑 ΤΙ ΔΕΙΧΝΕΙ — 1:1 ΜΕ ΤΟ EXCEL (ADR-753 Φ4)
 * ```
 *   [Γραμματοσειρά ▾] [Μέγεθος ▾]  A↑ A↓  │  Β  Ι  Α▾(χρώμα κειμένου)
 * ```
 * Λείπουν συγχώνευση, περιγράμματα, αριθμητική μορφή, στοίχιση και ξεχείλισμα — **όχι** από
 * παράλειψη: είναι πράξεις πάνω σε **κελιά ή περιοχές**, και ο χρήστης εδώ δείχνει **γράμματα**.
 *
 * 🔴 **Φ4 — έφυγαν άλλα τέσσερα**: χρώμα γεμίσματος, πινέλο μορφοποίησης, υπογράμμιση,
 * επαναφορά. Ο ιδιοκτήτης μέτρησε το Excel σε λειτουργία Επεξεργασίας (στιγμιότυπο 10/08) και
 * δεν εμφανίζει κανένα από τα τέσσερα. Τα τρία **δεν έχουν καν νόημα** σε γράμματα (βάφουν ή
 * καθαρίζουν κελί)· η υπογράμμιση έχει, και φεύγει με ρητή εντολή. Δες
 * `table-text-menu/table-text-toolbar-types.ts`.
 *
 * ⚠️ **Ο στόχος των κουμπιών ΔΕΝ είναι πια το κελί.** Εδώ έγραφε: *«ο στόχος παραμένει το κελί
 * (§67.3): ο πίνακας δεν έχει μορφοποίηση ανά χαρακτήρα»* — **ψευδές**, το `TableCell.runs`
 * υπάρχει από το ADR-753 Φ1. Με μαρκαρισμένους χαρακτήρες βάφονται **μόνο αυτοί**· με σκέτο
 * δρομέα, ολόκληρο το κελί. Την απόφαση την παίρνει ο ιδιοκτήτης, όχι αυτή η επιφάνεια.
 *
 * @module subapps/dxf-viewer/ui/components/TableTextMiniToolbar
 * @see ui/table-cell-editor/use-table-text-toolbar.ts — ποιος τη ανοίγει και με ποιον στόχο
 * @see ui/components/table-format-toolbar/use-transient-surface-dismiss.ts — ο κύκλος ζωής
 */

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { AnchoredFormatToolbar } from './table-format-toolbar/AnchoredFormatToolbar';
// 🔴 ADR-739 §64 — η εφήμερη επιφάνεια υποχωρεί στη μόνιμη: όσο ζει ο διάλογος «Μορφοποίηση
// κελιών», η γραμμή **δεν** ζει. Ο ίδιος ένας μηχανισμός με τις δύο άλλες υποδοχές.
import { useYieldToPersistentSurface } from './table-format-toolbar/use-yield-to-persistent-surface';
import { useTransientSurfaceDismiss } from './table-format-toolbar/use-transient-surface-dismiss';
import type {
  TableTextToolbarHandle,
  TableTextToolbarProps,
  TableTextToolbarTarget,
} from './table-text-menu/table-text-toolbar-types';

export type {
  TableTextFormatActions,
  TableTextToolbarHandle,
  TableTextToolbarProps,
  TableTextToolbarTarget,
} from './table-text-menu/table-text-toolbar-types';

const TableTextMiniToolbarInner = forwardRef<TableTextToolbarHandle, TableTextToolbarProps>(
  ({ formatActions, onClosed }, ref) => {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const [target, setTarget] = useState<TableTextToolbarTarget | null>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

    /**
     * Ο **ΕΝΑΣ** δρόμος εξόδου.
     *
     * Ιδεμποτής μέσω του `prev`: οι τρεις ακροατές του light-dismiss μπορούν να πυροδοτήσουν στην
     * ίδια χειρονομία (ένα κλικ έξω παράγει `pointerdown` **και** μετακίνηση εστίασης), και το
     * `onClosed` δεν επιτρέπεται να τρέξει δύο φορές — θα ζητούσε εστίαση σε πεδίο που ο χρήστης
     * μόλις άφησε.
     */
    const dismiss = useCallback(() => {
      setTarget((prev) => {
        if (prev === null) return null;
        onClosed();
        return null;
      });
      setAnchor(null);
    }, [onClosed]);

    useImperativeHandle(
      ref,
      () => ({
        open: (x, y, next) => {
          setAnchor({ x, y });
          setTarget(next);
        },
        // Το `close()` του συμβολαίου **δεν** περνά από το {@link dismiss}: είναι εντολή του
        // ιδιοκτήτη (π.χ. η συνεδρία πέθανε), όχι αποχώρηση του χρήστη — και τότε δεν υπάρχει
        // πεδίο να επιστρέψει η εστίαση.
        close: () => { setTarget(null); setAnchor(null); },
      }),
      [],
    );

    useYieldToPersistentSurface(dismiss);
    useTransientSurfaceDismiss({ active: target !== null, surfaceRef, dismiss });

    return (
      <AnchoredFormatToolbar
        anchor={anchor}
        label={target?.label ?? null}
        surfaceRef={surfaceRef}
        sections={target === null ? {} : {
          format: {
            format: target.format,
            onToggle: formatActions.onToggle,
            onStepSize: formatActions.onStepSize,
            onSetTextColor: formatActions.onSetTextColor,
            // 🔴 ADR-753 Φ4 — **τα τέσσερα που δεν έχει το Excel εδώ**, δηλωμένα ρητά:
            //   · `onSetFillColor` / `onReset` — **απόντες χειριστές** ⇒ δεν αποδίδονται
            //   · υπογράμμιση / πινέλο — **ρητές σημαίες**, γιατί δεν έχουν δικό τους χειριστή
            // Δες `TableFormatSectionProps` για το γιατί ο κανόνας είναι ένας παρότι οι δύο
            // μορφές δήλωσης είναι δύο, και `TableTextFormatActions` για το γιατί έφυγαν.
            showUnderline: false,
            showFormatPainter: false,
          },
          fonts: {
            state: target.fonts,
            fonts: target.fontNames,
            onSetFontFamily: (value) => formatActions.onSetField('fontFamily', value),
            onSetTextHeightMm: (value) => formatActions.onSetField('textHeightMm', value),
          },
        }}
      />
    );
  },
);

TableTextMiniToolbarInner.displayName = 'TableTextMiniToolbar';

export const TableTextMiniToolbar = TableTextMiniToolbarInner;
