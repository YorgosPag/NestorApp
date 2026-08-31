'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **το δεξί κλικ πάνω σε καρτέλα φύλλου εργασίας.**
 *
 * ## 🔑 Πέντε εντολές, όχι οι εννιά του Excel (η έρευνα, 2026-08-30)
 * Το Excel δείχνει *Insert · Delete · Rename · Move or Copy · View Code · Protect Sheet ·
 * Tab Color · Hide · Select All Sheets*. Τα Google Sheets δείχνουν *Delete · Duplicate ·
 * Copy to · Rename · Change color · Protect · Hide · View comments · Move left/right*.
 *
 * Οι δικές μας πέντε είναι **όσες έχουν αντικείμενο σήμερα**, και η λίστα δεν κόπηκε στην
 * τύχη — κάθε απουσία έχει λόγο:
 *
 * | εντολή του Excel | γιατί ΔΕΝ είναι εδώ |
 * |---|---|
 * | Move or Copy | η **αντιγραφή** φύλλου είναι άλλη πράξη (δεν υπάρχει)· η **μετακίνηση** είναι τα δύο βελάκια |
 * | Tab Color | το χρώμα της καρτέλας είναι **δεδομένο** που δεν υπάρχει στο σχήμα (§5.2) |
 * | Hide / Unhide | «κρυφό φύλλο» χωρίς δρόμο επιστροφής είναι απώλεια· χρειάζεται δικό του UI |
 * | Protect Sheet | το κλείδωμα ζει στο ADR-769 (`TableCell.locked`), σε **άλλο** επίπεδο |
 * | View Code · Select All Sheets | δεν υπάρχει μακροεντολή, δεν υπάρχει πολλαπλή επιλογή φύλλων |
 *
 * Αντιγράφοντας τη λίστα θα κάναμε ακριβώς το λάθος Υ-5 που κατέγραψε το ADR-748: **αντιγραφή
 * ταξινόμησης χωρίς σημασιολογία**.
 *
 * ## 🔴 Γιατί «Μετακίνηση αριστερά/δεξιά» και ΟΧΙ σύρσιμο
 * Το Excel αναδιατάσσει **μόνο** με σύρσιμο, γιατί η λωρίδα του έχει **αποθηκευμένη θέση
 * κύλισης**: το φύλλο που σέρνεις μένει εκεί που το πας. Η δική μας λωρίδα έχει **παράγωγο**
 * παράθυρο, κεντραρισμένο στο **ενεργό** φύλλο (ADR-833 §5.3) — και το φύλλο που σέρνεις
 * είναι, σχεδόν πάντα, το ενεργό. Δηλαδή το παράθυρο θα **ξανακεντραριζόταν κάτω από το
 * χέρι** σε κάθε βήμα της σύρσης: ο στόχος θα κουνιόταν μαζί με τον δείκτη.
 *
 * 🔑 Οι δύο εντολές δεν είναι υποκατάστατο του σύρσιμου — είναι **αυστηρότερες**: κάθε
 * μετάθεση είναι εφικτή, καμία δεν έχει ενδιάμεση κατάσταση να ακυρωθεί, κάθε βήμα είναι
 * ξεχωριστό `Ctrl+Z`, και όλες φτάνουν και με πληκτρολόγιο. Είναι η επιλογή των Google
 * Sheets, τα οποία **έχουν** σύρσιμο και **παρ' όλα αυτά** τις κρατούν.
 *
 * @module subapps/dxf-viewer/ui/components/TableWorksheetContextMenu
 * @see ui/table-cell-editor/use-table-worksheet-menu.ts — ποιος το ανοίγει και με ποιον στόχο
 * @see bim/table/table-worksheet-ops.ts — τι κάνει η κάθε εντολή (καθαροί σχεδιαστές)
 */

import { forwardRef } from 'react';
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DxfMenuIcon,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './dxf-context-menu/DxfContextMenu';
import { DxfAnchoredMenu } from './dxf-context-menu/DxfAnchoredMenu';
import type { TableWorksheetId } from '../../types/table-worksheet';

/**
 * Η καρτέλα, **παγωμένη στο άνοιγμα** — μαζί με τις σημαίες «μπορώ;».
 *
 * Οι σημαίες ταξιδεύουν με τον στόχο και δεν ξαναϋπολογίζονται στο render, για τον ίδιο λόγο
 * που το κάνει και το μενού ζωνών: πρέπει να απαντούν για τη στιγμή που **άνοιξε** το μενού.
 * Ένα `Ctrl+Z` ενδιάμεσα θα άφηνε item ενεργό ενώ η πράξη δεν επιτρέπεται πια.
 */
export interface TableWorksheetMenuTarget {
  readonly worksheetId: TableWorksheetId;
  /** Το όνομα **όπως το βλέπει ο άνθρωπος** — ρητό ή προεπιλεγμένο. Ποτέ η ταυτότητα. */
  readonly name: string;
  /**
   * 🔴 ADR-833 Φ5Β — «χωρά **άλλο** φύλλο ο πίνακας;» (μερίδιο εγγράφου, `table-capacity`).
   *
   * Ταξιδεύει με τον στόχο όπως και οι υπόλοιπες σημαίες, παρότι το «Νέο φύλλο» **δεν** έχει
   * στόχο: η σημαία αφορά τον **πίνακα**, και ο στόχος είναι το μόνο πράγμα που παγώνει τη
   * στιγμή του ανοίγματος. Δεύτερο κανάλι γι' αυτήν τη μία σημαία θα ήταν δεύτερη στιγμή
   * μέτρησης — δηλαδή ακριβώς η ασυμφωνία που η κεφαλίδα από πάνω αποτρέπει.
   */
  readonly canAdd: boolean;
  readonly canDelete: boolean;
  readonly canMoveLeft: boolean;
  readonly canMoveRight: boolean;
}

export interface TableWorksheetMenuProps {
  readonly onAdd: () => void;
  readonly onRename: (target: TableWorksheetMenuTarget) => void;
  readonly onMoveLeft: (target: TableWorksheetMenuTarget) => void;
  readonly onMoveRight: (target: TableWorksheetMenuTarget) => void;
  readonly onDelete: (target: TableWorksheetMenuTarget) => void;
}

export interface TableWorksheetContextMenuHandle {
  open: (x: number, y: number, target: TableWorksheetMenuTarget) => void;
  close: () => void;
}

const TableWorksheetContextMenuInner = forwardRef<
  TableWorksheetContextMenuHandle,
  TableWorksheetMenuProps
>(({ onAdd, onRename, onMoveLeft, onMoveRight, onDelete }, ref) => {
  const { t } = useTranslation('dxf-viewer');

  /**
   * Ο κύκλος ζωής **και το κέλυφος** (κρυφός trigger, περιεχόμενο υπό όρο, τίτλος του
   * παγωμένου στόχου) ζουν σε ένα σημείο: {@link DxfAnchoredMenu}. Η εξαγωγή του **δεύτερου**
   * έγινε ακριβώς εδώ — το `jscpd:diff` μέτρησε 14 γραμμές / 61 tokens κοινές με το μενού
   * συνδέσμου **πριν** γραφτεί μία γραμμή περιεχομένου (N.18).
   *
   * ⚠️ Χωρίς `onClosed`, όπως το μενού συνδέσμου: η λωρίδα καρτελών ζει και σε **απλή
   * επιλογή**, δηλαδή δεν υπάρχει συνεδρία επεξεργασίας να ξαναζωντανέψει.
   */
  return (
    <DxfAnchoredMenu<TableWorksheetMenuTarget>
      handleRef={ref}
      // Ο τίτλος λέει ΠΟΙΟ φύλλο — η τελευταία στιγμή πριν από μια διαγραφή που δεν ρωτά ξανά.
      // Το όνομα είναι το **ορατό**, ίδιο με την καρτέλα.
      title={(target) => t('table.worksheetMenu.title', { name: target.name })}
    >
      {(target) => (
        <>
          <DxfMenuItem disabled={!target.canAdd} onClick={onAdd}>
            <DxfMenuIcon><Plus size={16} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t('table.worksheetMenu.add')}</DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuItem onClick={() => onRename(target)}>
            <DxfMenuIcon><Pencil size={16} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t('table.worksheetMenu.rename')}</DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuSeparator />

          <DxfMenuItem disabled={!target.canMoveLeft} onClick={() => onMoveLeft(target)}>
            <DxfMenuIcon><ArrowLeft size={16} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t('table.worksheetMenu.moveLeft')}</DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuItem disabled={!target.canMoveRight} onClick={() => onMoveRight(target)}>
            <DxfMenuIcon><ArrowRight size={16} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t('table.worksheetMenu.moveRight')}</DxfMenuLabel>
          </DxfMenuItem>

          <DxfMenuSeparator />

          {/* 🔴 Γκρίζο στο **μοναδικό** φύλλο — και ο φραγμός δεν ζει εδώ: ο σχεδιαστής
              επιστρέφει `null` ούτως ή άλλως (belt-and-suspenders, N.7.2 #4). Η σημαία
              έρχεται από τον **ίδιο** σχεδιαστή, οπότε μενού και πράξη δεν μπορούν να
              διαφωνήσουν. */}
          <DxfMenuItem destructive disabled={!target.canDelete} onClick={() => onDelete(target)}>
            <DxfMenuIcon><Trash2 size={16} aria-hidden="true" /></DxfMenuIcon>
            <DxfMenuLabel>{t('table.worksheetMenu.delete')}</DxfMenuLabel>
          </DxfMenuItem>
        </>
      )}
    </DxfAnchoredMenu>
  );
});

TableWorksheetContextMenuInner.displayName = 'TableWorksheetContextMenu';

export const TableWorksheetContextMenu = TableWorksheetContextMenuInner;
