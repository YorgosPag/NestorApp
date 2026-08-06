'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 (απόφαση Α7) — **το mini toolbar μορφοποίησης**, και ADR-755 — **σε δύο
 * συμφραζόμενα**.
 *
 * Δεξί κλικ ⇒ **δύο** επιφάνειες: αυτή εδώ, ξεκομμένη, και από κάτω το μενού. Ακριβώς όπως το
 * Excel, και όπως το ζήτησε ρητά ο ιδιοκτήτης: «ξεκομμένο … πάνω από το μενού».
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
 * επιβίωσε (undo) δεν δείχνει εννιά μονίμως γκρίζα κουμπιά, τα παραλείπει.
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
import { useRovingToolbar } from './use-roving-toolbar';
import { useAriaHiddenGuard, useToolbarPlacement } from './use-toolbar-surface';
import { TableBorderMenu, type TableBorderMenuProps } from './TableBorderMenu';
import { TableMergeMenu, type TableMergeMenuProps } from './TableMergeMenu';
import {
  TABLE_FORMAT_SLOTS,
  TableFormatSection,
  type TableFormatSectionProps,
} from './TableFormatSection';
import styles from './TableFormatToolbar.module.css';

// Επανεξαγωγή: οι υποδοχές εισάγουν **έναν** τύπο από **ένα** σημείο, όπως και πριν τη διάσπαση
// του ADR-755 — καμία υπάρχουσα διαδρομή εισαγωγής δεν αλλάζει.
export type {
  TableFormatSnapshot,
  TableToggleFormatKey,
} from './TableFormatSection';
export type { TableToggleFormatState } from './ToolbarButton';

/** Πάνω σε τι άνοιξε η γραμμή — καθορίζει **μόνο** το προσβάσιμο όνομά της. */
export type TableFormatToolbarScope = 'row' | 'column' | 'range';

/** Το τμήμα μορφοποίησης **όπως το δίνει ο ξενιστής**: όλα εκτός από τις θέσεις roving. */
export type TableFormatHostProps = Omit<TableFormatSectionProps, 'rovingOf'>;

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
   */
  readonly format?: TableFormatHostProps;
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

/** Το split button συγχώνευσης είναι **δύο** εστιάσιμα μισά, όχι ένα. */
const MERGE_SLOTS = 2;

export function TableFormatToolbar(props: TableFormatToolbarProps): React.ReactElement | null {
  const { anchorX, anchorY, scope, label, surfaceRef, format, merge, borders } = props;
  const { t } = useTranslation('dxf-viewer');

  /**
   * 🔴 Οι θέσεις roving **παράγονται από την παρουσία κάθε διαμερίσματος**, ποτέ γραμμένες ως
   * σταθερές.
   *
   * Με σταθερό μέγεθος, ο δείκτης θα έδειχνε σε κουμπί που δεν υπάρχει και η γραμμή θα έμενε
   * χωρίς στάση `Tab` (δες `use-roving-toolbar`). Και το **πλήθος** κάθε τμήματος έρχεται από
   * το ίδιο το τμήμα ({@link TABLE_FORMAT_SLOTS}): γραμμένο εδώ θα ήταν σιωπηλή εξάρτηση
   * που σπάει στην επόμενη προσθήκη **εκεί**.
   */
  const mergeBase = format ? TABLE_FORMAT_SLOTS : 0;
  const bordersIndex = mergeBase + (merge ? MERGE_SLOTS : 0);
  const roving = useRovingToolbar(bordersIndex + (borders ? 1 : 0));

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
      aria-orientation="horizontal"
      aria-label={t(TOOLBAR_LABEL_KEY[scope], { label })}
      className={cn(
        styles.toolbar,
        'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
      )}
      {...TABLE_CELL_SESSION_MARKER}
    >
      {format ? (
        <TableFormatSection {...format} rovingOf={roving.itemProps} />
      ) : null}

      {/*
        ADR-755 — η **συγχώνευση** ανοίγει το διαμέρισμα των πράξεων περιοχής, πριν από τα
        περιγράμματα: είναι η σειρά της κορδέλας του Excel (Στοίχιση → Συγχώνευση → …) και η
        σειρά με την οποία σκέφτεται ο χρήστης — πρώτα «τι είναι κελί», μετά «πώς πλαισιώνεται».

        Ο διαχωριστής μπαίνει **μόνο** όταν υπάρχει κάτι από πάνω: στην υποδοχή της περιοχής η
        συγχώνευση είναι το πρώτο χειριστήριο, και μια γραμμή που ξεκινά με διαχωριστή θα
        δήλωνε ένα κενό τμήμα που δεν υπάρχει.
      */}
      {merge ? (
        <>
          {format ? <span className={styles.separator} aria-hidden="true" /> : null}
          <TableMergeMenu
            {...merge}
            rovingApply={roving.itemProps(mergeBase)}
            rovingMenu={roving.itemProps(mergeBase + 1)}
          />
        </>
      ) : null}

      {/*
        ADR-750 Φ3 — τα περιγράμματα σε **δικό τους** διαμέρισμα. Ο διαχωριστής δεν είναι
        διακόσμηση: σηματοδοτεί ότι από εδώ και πέρα η πράξη αφορά την **περιοχή**, όχι τον
        άξονα — η ίδια διάκριση που κάνει και η Α19 στις δύο «Επαναφορές».
      */}
      {borders ? (
        <>
          {format || merge ? <span className={styles.separator} aria-hidden="true" /> : null}
          <TableBorderMenu roving={roving.itemProps(bordersIndex)} {...borders} />
        </>
      ) : null}
    </div>
    </TooltipProvider>,
    document.body,
  );
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
