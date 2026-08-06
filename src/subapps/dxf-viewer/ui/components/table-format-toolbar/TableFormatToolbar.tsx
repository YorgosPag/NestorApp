'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 (απόφαση Α7) — **το mini toolbar μορφοποίησης**, και ADR-755 — **σε δύο
 * συμφραζόμενα**.
 *
 * Δεξί κλικ ⇒ **δύο** επιφάνειες: αυτή εδώ, ξεκομμένη, και από κάτω το μενού. Ακριβώς όπως το
 * Excel, και όπως το ζήτησε ρητά ο ιδιοκτήτης: «ξεκομμένο … πάνω από το μενού».
 *
 * ## 🔴 ΔΥΟ ΣΕΙΡΕΣ, 1:1 ΜΕ ΤΟ EXCEL (§55)
 * Μέχρι το §55 η γραμμή ήταν **μία** και τα κουμπιά μπαίνανε «με τη σειρά που γράφτηκαν». Ο
 * ιδιοκτήτης μέτρησε τη διάταξη πάνω σε στιγμιότυπο του Excel και ζήτησε ταύτιση θέση-θέση:
 * ```
 *   σειρά 1:  [Γραμματοσειρά ▾][Μέγεθος ▾]  A↑ A↓  │ λογιστική  %  000 │ αναδίπλωση
 *   σειρά 2:  B  I  ≡▾ │ γέμισμα▾  A▾  περιγράμματα▾ │ .0←  .00→  πινέλο ‖ ΝΕΣΤΩΡ: Υ  ⧉▾  ↺
 * ```
 * Ό,τι δεν έχει ακόμη πράξη μπαίνει **ανενεργό** (αναδίπλωση, πινέλο): απόφαση του ιδιοκτήτη
 * «όψη 1:1 τώρα, λειτουργία σταδιακά». Η θέση κρατιέται ώστε η μέρα που θα αποκτήσει πράξη να
 * μη μετακινήσει τα διπλανά της.
 *
 * ⚠️ **Η μία συνειδητή απόκλιση** είναι το τρίτο τμήμα στο τέλος της σειράς 2 (υπογράμμιση,
 * συγχώνευση, επαναφορά): τρία χειριστήρια που το Excel δεν έχει και που ο ιδιοκτήτης είχε
 * ζητήσει ρητά παλιότερα. Δες {@link TableFormatUnderlineButton} για το γιατί μπήκαν στο τέλος
 * αντί να σβηστούν.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ROVING ΠΑΡΑΜΕΝΕΙ **ΕΝΑ** ΚΑΙ **ΓΡΑΜΜΙΚΟ**
 * Δύο σειρές δεν σημαίνουν πλέγμα. Το APG ζητά **μία** στάση `Tab` για όλη τη γραμμή· ένα
 * δισδιάστατο roving θα απαιτούσε από τον χρήστη να ξέρει σε ποια σειρά βρίσκεται για να
 * φτάσει σε ένα κουμπί, ενώ οι δύο σειρές εδώ είναι **αναδίπλωση** μιας εντολοσειράς, όχι
 * πίνακας. Άρα: `aria-orientation="horizontal"`, τα `←/→` διατρέχουν και τις δύο σειρές με τη
 * σειρά του DOM, και το `→` στο τελευταίο κουμπί κυκλώνει στο πρώτο.
 *
 * ## 🔴 ΤΙ ΔΕΙΧΝΕΙ, ΑΝΑΛΟΓΑ ΜΕ ΤΟ ΠΟΥ ΑΝΟΙΞΕ (ADR-755 · **αναθεωρημένο §52**)
 * ```
 *   ζώνη δείκτη (γράμμα/αριθμός)  →  scope='column'|'row'  →  μορφοποίηση ΑΞΟΝΑ + περιοχή
 *   κελιά (επιλογή)               →  scope='range'         →  μορφοποίηση ΚΕΛΙΩΝ + περιοχή
 * ```
 * ⚠️ Η δεύτερη γραμμή έγραφε «**μόνο** πράξεις ΠΕΡΙΟΧΗΣ» μέχρι το §52, επειδή τότε δεν υπήρχε
 * γραφέας για το `TableCell.styleOverride` — δεν έλειπε κουμπί, **έλειπε η πράξη**. Τώρα και
 * οι δύο υποδοχές δίνουν το ίδιο τμήμα, με άλλον στόχο μέσα του (`table-format-scope.ts`).
 *
 * Κάθε διαμέρισμα παραμένει **προαιρετικό prop**: απόν ⇒ δεν αποδίδεται καθόλου. Είναι ο
 * κανόνας «μην υπόσχεσαι ό,τι δεν κάνεις» — μια γραμμή που άνοιξε πάνω σε στόχο που δεν
 * επιβίωσε (undo) δεν δείχνει είκοσι μονίμως γκρίζα κουμπιά, τα παραλείπει.
 *
 * ## 🔴 Γιατί σκέτα `<button>` και ΟΧΙ `DxfMenuItem`
 * ⚠️ **Η αιτιολόγηση άλλαξε στις 2026-08-03 — το συμπέρασμα όχι.** Έγραφε: «το `onSelect` του
 * `DxfMenuItem` καλεί `onOpenChange(false)`, άρα το πρώτο «Β» θα έκλεινε το μενού, και η
 * μορφοποίηση είναι κατεξοχήν επαναλαμβανόμενη πράξη». Ο ιδιοκτήτης ανέτρεψε ακριβώς αυτό:
 * το μενού **οφείλει** πλέον να κλείνει στο πρώτο πάτημα, όπως στο Excel.
 *
 * Τα σκέτα `<button>` παραμένουν σωστά για **άλλον** λόγο, που δεν άλλαξε: το `DxfMenuItem`
 * είναι Radix `menuitem` και δουλεύει **μόνο μέσα** στο δέντρο του `Menu.Content`. Αυτή εδώ η
 * επιφάνεια ζει σε δικό της portal (το απαιτεί η Α7), δηλαδή δεν είναι — και δεν επιτρέπεται
 * να είναι — μέρος του μενού. Το κλείσιμο το κάνει ρητά ο γονέας, **μετά** την εκτέλεση.
 *
 * ## 🔴 Γιατί ζει σε portal και όχι μέσα στο `DxfMenuContent`
 * Το Radix τοποθετεί το περιεχόμενο του μενού μόνο του· ένα παιδί του δεν μπορεί να καθίσει
 * **πάνω** από αυτό με κενό ανάμεσα. Η τιμή που πληρώνεται είναι ότι το toolbar μετράει ως
 * «έξω» για το `DismissableLayer` — γι' αυτό ο γονέας κρατά το {@link TableFormatToolbarProps.
 * surfaceRef} και φυλάει το `onInteractOutside` (δες `use-keep-open-on-surface.ts`). Χωρίς
 * αυτόν τον φύλακα, **κάθε** πάτημα κουμπιού θα έκλεινε το μενού από κάτω.
 *
 * ## 🔴 Κάθε κουμπί φέρει το σημάδι της συνεδρίας
 * Ο φύλακας `useTableCellSessionBlur` ρωτά `isTableCellSessionElement` πάνω στο **ίδιο** το
 * στοιχείο που παίρνει την εστίαση (όχι `closest`). Άρα το σημάδι δεν αρκεί στο δοχείο: κάθε
 * `<button>` το φοράει, αλλιώς η πρώτη εστίαση σε κουμπί σκοτώνει τον δρομέα του κελιού ένα
 * καρέ αργότερα — και οι ζώνες εξαφανίζονται τη στιγμή που τις χρησιμοποιείς.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableFormatToolbar
 * @see ui/components/TableHeaderContextMenu.tsx — η υποδοχή του **άξονα**
 * @see ui/components/TableRangeContextMenu.tsx — η υποδοχή της **περιοχής** (ADR-755)
 * @see bim/table/table-format-scope.ts — ο ΕΝΑΣ δρόμος «τι διάλεξε ο χρήστης → πού γράφεται»
 * @see ui/components/table-format-toolbar/table-format-toolbar-slots.ts — η αρίθμηση θέσεων
 */

import React, { type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-739 Φ.Ε βήμα 5 — το ΕΝΑ tooltip του έργου (CHECK 3.23, μηδενική ανοχή σε νέο αρχείο).
// Εδώ έγραφε `title=` σε κάθε `<button>`· δες τη σημείωση στο {@link ToolbarButton} για το τι
// αλλάζει πραγματικά, γιατί ο native τίτλος **δεν** ήταν απλώς «άσχημος».
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import {
  useRovingToolbar,
  type RovingItemProps,
  type RovingToolbar,
} from './use-roving-toolbar';
import { useAriaHiddenGuard, useToolbarPlacement } from './use-toolbar-surface';
import { TableAlignMenu, type TableAlignMenuProps } from './TableAlignMenu';
import { TableBorderMenu, type TableBorderMenuProps } from './TableBorderMenu';
import { TableFontControls, type TableFontControlsProps } from './TableFontControls';
import { TableMergeMenu, type TableMergeMenuProps } from './TableMergeMenu';
import {
  TableDecimalButtons,
  TableNumberKindButtons,
  type TableNumberFormatSectionProps,
} from './TableNumberFormatSection';
import {
  TableFormatColors,
  TableFormatPainterButton,
  TableFormatResetButton,
  TableFormatSizeButtons,
  TableFormatToggles,
  TableFormatUnderlineButton,
  TableFormatWrapButton,
  type TableFormatSectionProps,
} from './TableFormatSection';
import { planTableToolbarSlots, type TableToolbarSlots } from './table-format-toolbar-slots';
import styles from './TableFormatToolbar.module.css';

// Επανεξαγωγή: οι υποδοχές εισάγουν **έναν** τύπο από **ένα** σημείο, όπως και πριν τη διάσπαση
// του ADR-755 — καμία υπάρχουσα διαδρομή εισαγωγής δεν αλλάζει.
export type {
  TableFormatSnapshot,
  TableToggleFormatKey,
} from './TableFormatSection';
export type { TableToggleFormatState } from './ToolbarButton';
export type { TableFontControlsState, TableFontValueState } from './TableFontControls';
export type { TableNumberFormatState } from './TableNumberFormatSection';

/** Πάνω σε τι άνοιξε η γραμμή — καθορίζει **μόνο** το προσβάσιμο όνομά της. */
export type TableFormatToolbarScope = 'row' | 'column' | 'range';

/** Το τμήμα μορφοποίησης **όπως το δίνει ο ξενιστής**: όλα εκτός από τις θέσεις roving. */
export type TableFormatHostProps = Omit<TableFormatSectionProps, 'rovingOf'>;

/** Τα δύο combobox (γραμματοσειρά + μέγεθος) όπως τα δίνει ο ξενιστής (§55). */
export type TableFontHostProps = Omit<TableFontControlsProps, 'rovingOf'>;

/** Τα πέντε κουμπιά αριθμού όπως τα δίνει ο ξενιστής (§55). */
export type TableNumberFormatHostProps = Omit<TableNumberFormatSectionProps, 'rovingOf'>;

/** Η στοίχιση όπως τη δίνει ο ξενιστής (§55). */
export type TableAlignHostProps = Omit<TableAlignMenuProps, 'roving'>;

/** Το split button συγχώνευσης όπως το δίνει ο ξενιστής (ADR-755). */
export type TableMergeMenuHostProps = Omit<TableMergeMenuProps, 'rovingApply' | 'rovingMenu'>;

export interface TableFormatToolbarProps {
  /** Το σημείο του δεξιού κλικ, σε συντεταγμένες παραθύρου. Το toolbar κάθεται **από πάνω**. */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly scope: TableFormatToolbarScope;
  /** `A` / `3` / `B2:D4` — η ίδια ονομασία με τη ζώνη ή με τον τίτλο του μενού. */
  readonly label: string;
  /** Το δοχείο, ώστε ο γονέας να αναγνωρίζει «κλικ πάνω μου» στο `onInteractOutside`. */
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  /**
   * ADR-755 / §52 — η **μορφοποίηση**· **απόν ⇒ η γραμμή δεν το δείχνει καθόλου**.
   *
   * Ένα prop και όχι οκτώ: ο τύπος **είναι** το συμβόλαιο, όπως ήδη ισχύει για το
   * {@link borders}. Ονομαζόταν `axisFormat` μέχρι το §52, όταν ο στόχος μπορούσε να είναι
   * μόνο άξονας· η μετονομασία είναι το σημείο όπου το όνομα ξαναείπε την αλήθεια.
   *
   * ⚠️ §55: τα χειριστήριά του **δεν** είναι πια συνεχόμενα στην οθόνη (μέγεθος στη σειρά 1,
   * Β/Ι στη σειρά 2, …) — αλλά παραμένουν **ένα** prop, γιατί είναι ένας στόχος και μία
   * κατάσταση. Η διάταξη δεν είναι λόγος να σπάσει το συμβόλαιο.
   */
  readonly format?: TableFormatHostProps;
  /** §55 — **γραμματοσειρά + μέγεθος** (σειρά 1, θέσεις 1-2)· απόν ⇒ δεν αποδίδονται. */
  readonly fonts?: TableFontHostProps;
  /** §55 — **αριθμητική μορφή** (σειρά 1 θέσεις 5-7 · σειρά 2 θέσεις 7-8). */
  readonly numberFormat?: TableNumberFormatHostProps;
  /** §55 — η **στοίχιση** (σειρά 2, θέση 3). */
  readonly align?: TableAlignHostProps;
  /** ADR-755 — η **συγχώνευση**· πράξη περιοχής, ισχύει και στις δύο υποδοχές. */
  readonly merge?: TableMergeMenuHostProps;
  /**
   * ADR-750 Φ3 — το dropdown περιγραμμάτων· **απόν ⇒ η γραμμή δεν το δείχνει καθόλου**.
   *
   * Προαιρετικό και όχι υποχρεωτικό, ώστε ο μόνος τότε καλών να μην αλλάξει υπογραφή: η
   * μορφοποίηση κειμένου (Β/Ι/Υ) γράφει **στυλ**, τα περιγράμματα γράφουν **ακμές**. Είναι
   * δύο ορθογώνια επίπεδα που τυχαίνει να μοιράζονται γραμμή εργαλείων — όχι ένα.
   */
  readonly borders?: Omit<TableBorderMenuProps, 'roving'>;
}

export function TableFormatToolbar(props: TableFormatToolbarProps): React.ReactElement | null {
  const { anchorX, anchorY, scope, label, surfaceRef } = props;
  const { format, fonts, numberFormat, align, merge, borders } = props;
  const { t } = useTranslation('dxf-viewer');

  /**
   * 🔴 Οι θέσεις roving **παράγονται από την παρουσία κάθε διαμερίσματος**, ποτέ γραμμένες ως
   * σταθερές — και η σειρά τους ζει σε **ένα** σημείο (δες `table-format-toolbar-slots.ts`).
   *
   * Με σταθερό μέγεθος, ο δείκτης θα έδειχνε σε κουμπί που δεν υπάρχει και η γραμμή θα έμενε
   * χωρίς στάση `Tab` (δες `use-roving-toolbar`).
   */
  const slots = planTableToolbarSlots({
    fonts: fonts !== undefined,
    format: format !== undefined,
    numberFormat: numberFormat !== undefined,
    align: align !== undefined,
    borders: borders !== undefined,
    merge: merge !== undefined,
  });
  const roving = useRovingToolbar(slots.total);

  useToolbarPlacement(surfaceRef, anchorX, anchorY);
  useAriaHiddenGuard(surfaceRef);

  if (typeof document === 'undefined') return null;

  return createPortal(
    // 🔴 Δικός του `TooltipProvider`, όχι εξάρτηση από τον περιβάλλοντα.
    //
    // Το React **διατηρεί** το context μέσα από portal, οπότε τεχνικά ένας provider ψηλότερα
    // θα δούλευε. Δεν υπάρχει όμως τέτοιος: το μόνο άλλο σημείο του DXF viewer με tooltip
    // (`canvas-v2/overlays/RulerCornerBox.tsx`) στήνει κι εκείνο τον δικό του — δηλαδή το
    // μοτίβο του subapp είναι «τοπικός provider», όχι καθολικός. Χωρίς αυτόν, το Radix πετά
    // σφάλμα την πρώτη φορά που θα σταθεί ο δείκτης σε κουμπί.
    //
    // Η καθυστέρηση είναι σκόπιμα **μικρή**: η γραμμή είναι ήδη ανοιχτή επειδή ο χρήστης
    // έκανε δεξί κλικ, δηλαδή ψάχνει ενεργά — δεν είναι διακριτική βοήθεια σε ένα εικονίδιο
    // που προσπερνάς κατά λάθος.
    <TooltipProvider delayDuration={300}>
    <div
      ref={surfaceRef}
      role="toolbar"
      // Οριζόντιος **παρότι** δύο σειρές: το roving είναι μία γραμμική εντολοσειρά που
      // αναδιπλώνεται οπτικά — δες την κεφαλίδα.
      aria-orientation="horizontal"
      aria-label={t(TOOLBAR_LABEL_KEY[scope], { label })}
      className={cn(
        styles.toolbar,
        'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
      )}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <ToolbarRowOne toolbar={props} slots={slots} roving={roving} />
      <ToolbarRowTwo toolbar={props} slots={slots} roving={roving} />
    </div>
    </TooltipProvider>,
    document.body,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Οι δύο σειρές — χωριστά components, ίδια δεδομένα
// ──────────────────────────────────────────────────────────────────────────────

interface ToolbarRowProps {
  /** Ολόκληρα τα props της γραμμής: κάθε σειρά διαλέγει **τα δικά της** διαμερίσματα. */
  readonly toolbar: TableFormatToolbarProps;
  readonly slots: TableToolbarSlots;
  readonly roving: RovingToolbar;
}

/** Οι θέσεις **ενός** θραύσματος, μετατοπισμένες στη βάση του. */
function offsetOf(roving: RovingToolbar, base: number): (index: number) => RovingItemProps {
  return (index) => roving.itemProps(base + index);
}

/**
 * **ΣΕΙΡΑ 1** — `[Γραμματοσειρά ▾][Μέγεθος ▾]  A↑ A↓ │ λογιστική % 000 │ αναδίπλωση`.
 *
 * Κενή σειρά δεν αποδίδεται καθόλου: ένα άδειο `.row` θα άφηνε κενό ύψος πάνω από τη σειρά 2
 * και η γραμμή θα φαινόταν χαλασμένη σε κάθε υποδοχή που δεν δίνει τυπογραφία.
 */
function ToolbarRowOne({ toolbar, slots, roving }: ToolbarRowProps): React.ReactElement | null {
  const { fonts, format, numberFormat } = toolbar;
  if (!fonts && !format && !numberFormat) return null;

  return (
    <span className={styles.row}>
      {fonts ? (
        <TableFontControls {...fonts} rovingOf={offsetOf(roving, slots.fontControls)} />
      ) : null}

      <Separator when={fonts !== undefined && format !== undefined} />
      {format ? (
        <TableFormatSizeButtons {...format} rovingOf={offsetOf(roving, slots.sizeSteps)} />
      ) : null}

      {/* Η αριθμητική μορφή είναι **άλλη ερώτηση** από την τυπογραφία: ο διαχωριστής το λέει,
          όπως ακριβώς και στην κορδέλα του Excel. */}
      <Separator
        when={numberFormat !== undefined && (fonts !== undefined || format !== undefined)}
      />
      {numberFormat ? (
        <TableNumberKindButtons {...numberFormat} rovingOf={offsetOf(roving, slots.numberKinds)} />
      ) : null}

      <Separator when={format !== undefined} />
      {format ? (
        <TableFormatWrapButton {...format} rovingOf={offsetOf(roving, slots.wrapText)} />
      ) : null}
    </span>
  );
}

/**
 * **ΣΕΙΡΑ 2** — `B I ≡▾ │ γέμισμα▾ A▾ περιγράμματα▾ │ .0← .00→ πινέλο ‖ Υ ⧉▾ ↺`.
 *
 * Το τελευταίο τμήμα (μετά το `‖`) είναι **η μία συνειδητή απόκλιση** από το Excel — δες
 * {@link TableFormatUnderlineButton}.
 */
function ToolbarRowTwo({ toolbar, slots, roving }: ToolbarRowProps): React.ReactElement | null {
  const { format, align, borders, numberFormat, merge } = toolbar;
  const hasStart = Boolean(format || align || borders || numberFormat);
  if (!hasStart && !merge) return null;

  return (
    <span className={styles.row}>
      {format ? <TableFormatToggles {...format} rovingOf={offsetOf(roving, slots.toggles)} /> : null}
      {align ? <TableAlignMenu {...align} roving={roving.itemProps(slots.align)} /> : null}

      {/*
        ADR-739 Φ.Ε/Φ4 + Φ4β — τα δύο χρώματα και τα περιγράμματα σε **ένα** διαμέρισμα: είναι
        η ίδια ερώτηση («πώς βάφεται και πώς πλαισιώνεται το κελί») και αυτή ακριβώς είναι η
        ομαδοποίησή τους στη σειρά 2 του Excel.
      */}
      <Separator when={format !== undefined || align !== undefined} />
      {format ? <TableFormatColors {...format} rovingOf={offsetOf(roving, slots.colors)} /> : null}
      {borders ? <TableBorderMenu roving={roving.itemProps(slots.borders)} {...borders} /> : null}

      <Separator when={numberFormat !== undefined && hasStart} />
      {numberFormat ? (
        <TableDecimalButtons {...numberFormat} rovingOf={offsetOf(roving, slots.decimals)} />
      ) : null}
      {format ? (
        <TableFormatPainterButton {...format} rovingOf={offsetOf(roving, slots.formatPainter)} />
      ) : null}

      {/*
        ‖ **Το τρίτο τμήμα**: υπογράμμιση, συγχώνευση, επαναφορά — ό,τι έχει ο ΝΕΣΤΩΡ παραπάνω
        από το Excel. Ο διαχωριστής δεν είναι διακόσμηση: κρατά τις εννιά θέσεις του Excel
        καθαρές στα αριστερά του.
      */}
      <Separator when={Boolean(format || merge) && hasStart} />
      {format ? (
        <TableFormatUnderlineButton {...format} rovingOf={offsetOf(roving, slots.underline)} />
      ) : null}
      {merge ? (
        <TableMergeMenu
          {...merge}
          rovingApply={roving.itemProps(slots.merge)}
          rovingMenu={roving.itemProps(slots.merge + 1)}
        />
      ) : null}
      {format ? (
        <TableFormatResetButton {...format} rovingOf={offsetOf(roving, slots.reset)} />
      ) : null}
    </span>
  );
}

/**
 * Διαχωριστής που εμφανίζεται **μόνο** όταν υπάρχει κάτι και από τις δύο πλευρές του.
 *
 * Component και όχι τριαδικό στη ροή: με έξι προαιρετικά διαμερίσματα και επτά διαχωριστές, τα
 * ένθετα `? :` μέσα στο JSX είναι το σημείο όπου η επόμενη προσθήκη αφήνει γραμμή να ξεκινά με
 * διαχωριστή — δηλαδή να δηλώνει ένα κενό τμήμα που δεν υπάρχει.
 */
function Separator({ when }: { readonly when: boolean }): React.ReactElement | null {
  return when ? <span className={styles.separator} aria-hidden="true" /> : null;
}

/**
 * Το προσβάσιμο όνομα ανά συμφραζόμενο.
 *
 * Χάρτης και όχι τριαδικό μέσα στο JSX: με τρίτη τιμή (`'range'`, ADR-755) ένα ένθετο
 * τριαδικό θα ήταν το σημείο όπου η επόμενη προσθήκη ξεχνά μια περίπτωση και ο αναγνώστης
 * οθόνης ακούει το λάθος όνομα — σφάλμα που καμία οπτική επιθεώρηση δεν πιάνει.
 */
const TOOLBAR_LABEL_KEY: Readonly<Record<TableFormatToolbarScope, string>> = {
  column: 'table.formatToolbar.columnLabel',
  row: 'table.formatToolbar.rowLabel',
  range: 'table.formatToolbar.rangeLabel',
};
