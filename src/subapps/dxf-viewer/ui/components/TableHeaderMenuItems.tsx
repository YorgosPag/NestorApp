'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **τα δομικά items** του μενού ζωνών δείκτη: εισαγωγή πριν / μετά και
 * διαγραφή, με ρητή κατεύθυνση.
 *
 * ## Ρητή κατεύθυνση, όχι σκέτο «Εισαγωγή»
 * Το Excel δείχνει ένα item και εισάγει **πάντα πριν** — κανόνας που ο χρήστης μαθαίνει με
 * δοκιμή και undo. Το AutoCAD (μενού κελιού πίνακα) και τα Google Sheets δείχνουν και τις δύο
 * κατευθύνσεις. Εδώ ακολουθούμε τα δεύτερα: ο πίνακας είναι **σχέδιο**, και μια εισαγωγή στη
 * λάθος μεριά μετακινεί γεωμετρία που ο μηχανικός μόλις τακτοποίησε.
 *
 * ## Ένα σώμα, δύο άξονες
 * Τα items είναι **τρία** και ο άξονας του χτυπήματος αποφασίζει μόνο τι **λένε** και τι
 * εικονίδιο έχουν. Δύο ξεχωριστά μπλοκ JSX θα ήταν sibling clone (N.18) και, χειρότερα, δύο
 * σημεία που μπορούν κάποτε να αποκτήσουν διαφορετική συμπεριφορά για την ίδια ακριβώς πράξη.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσαν μέσα στο `TableHeaderContextMenu.tsx`, που είχε φτάσει τις **498/500** γραμμές
 * (N.7.1). **Εξαγωγή, ποτέ trim.** Το κριτήριο της τομής δεν ήταν το μέγεθος αλλά η
 * **ανεξαρτησία**: αυτά τα τρία items είναι καθαρή απόδοση από `state` + τρεις χειριστές, δεν
 * αγγίζουν ούτε την εστίαση, ούτε τον escape-bus, ούτε τον φύλακα «κλικ έξω» — δηλαδή τίποτα
 * από τη μηχανική που κάνει το γονικό αρχείο δύσκολο.
 *
 * @module subapps/dxf-viewer/ui/components/TableHeaderMenuItems
 * @see ui/components/TableHeaderContextMenu.tsx — ποιος τα ανοίγει και ποιος κλείνει το μενού
 * @see ui/components/dxf-context-menu/DxfContextMenu.tsx — το SSoT της οπτικής γλώσσας
 */

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DxfMenuIcon,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './dxf-context-menu/DxfContextMenu';

/** Ό,τι απαντιέται **τη στιγμή που ανοίγει** το μενού, όχι στο τελευταίο render. */
export interface TableHeaderMenuState {
  /** `A` / `3` για έναν άξονα· `A:C` / `2:5` για πολλούς — η ίδια ονομασία με τη ζώνη. */
  readonly label: string;
  /**
   * Ο **ένας** άξονας που πατήθηκε (`C`), όσα κι αν είναι μαρκαρισμένα.
   *
   * ⚠️ Τον θέλει **μόνο** η γραμμή μορφοποίησης, που δρα ακόμη σε έναν άξονα: το προσβάσιμο
   * όνομά της οφείλει να λέει σε ποιον. Δες `table-axis-action-target.ts` — φεύγει όταν η
   * μορφοποίηση ακολουθήσει κι αυτή την επιλογή.
   */
  readonly axisLabel: string;
  /**
   * ADR-739 §27.17 — **πόσους** άξονες αφορά η πράξη: έναν, ή ολόκληρη την επιλογή όταν το
   * δεξί κλικ έπεσε μέσα της. Είναι το ίδιο πλήθος που εκτελείται και που **γράφεται** — μία
   * τιμή, δύο χρήσεις, καμία πιθανότητα η ετικέτα να πει «3» και η πράξη να κάνει «1».
   */
  readonly count: number;
  readonly canInsert: boolean;
  readonly canDelete: boolean;
}

export interface TableHeaderMenuItemsProps {
  readonly isColumn: boolean;
  readonly state: TableHeaderMenuState;
  readonly onInsertBefore: () => void;
  readonly onInsertAfter: () => void;
  readonly onDelete: () => void;
  /** 🔴 ADR-739 §61 — «Μορφοποίηση κελιών…»· δες τη θέση του παρακάτω. */
  readonly onFormatCells: () => void;
}

/**
 * Τα items **δεν κλείνουν μόνα τους**: το κλείσιμο το ζητά το ίδιο το Radix (`onSelect` ⇒
 * `onOpenChange(false)`), δηλαδή περνά από τον **έναν** δρόμο του γονέα. Δεύτερος δρόμος θα
 * σήμαινε ότι μια έξοδος (κλικ σε item) επιστρέφει την εστίαση στο κελί και μια άλλη
 * (Esc / κλικ έξω) όχι.
 */
export function TableHeaderMenuItems({
  isColumn, state, onInsertBefore, onInsertAfter, onDelete, onFormatCells,
}: TableHeaderMenuItemsProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const { label, count, canInsert, canDelete } = state;

  /**
   * 🔴 ADR-739 §27.17 — **η ετικέτα λέει το πλήθος**, γιατί η πράξη το εκτελεί.
   *
   * Ο πληθυντικός δεν είναι φιλολογία: το item είναι η **τελευταία** στιγμή πριν χαθούν
   * δεδομένα, και «Διαγραφή στήλης» πάνω σε τρεις μαρκαρισμένες στήλες θα ήταν ψέμα σε
   * επικίνδυνο σημείο. Ο τίτλος από πάνω γράφει ήδη *ποιες* (`A:C`).
   *
   * Δύο κλειδιά και όχι ICU `plural`: το πλήθος εδώ είναι **πάντα ≥ 2** στον έναν κλάδο και
   * **πάντα 1** στον άλλο, οπότε ένας κανόνας πληθυντικού θα ήταν μηχανισμός που δεν
   * χρησιμοποιείται ποτέ — και ένα ακόμη σημείο να αποκλίνουν οι δύο γλώσσες.
   */
  /**
   * ⚠️ Κάθε κλειδί γράφεται **κυριολεκτικά** μέσα στην `t(...)`, ποτέ ως τριαδική έκφραση
   * κλειδιού: ολόκληρη η στατική διακυβέρνηση i18n του έργου (CHECK 3.8 ανύπαρκτα κλειδιά,
   * 3.34 φρεσκάδα shell slice) διαβάζει **γραμμένα** κλειδιά. Ένα `t(many ? 'α' : 'β')` είναι
   * αόρατο σε αυτά — δηλαδή δύο κλειδιά που κανένας φύλακας δεν επαληθεύει ποτέ ότι υπάρχουν.
   */
  const many = count > 1;

  const title = isColumn
    ? (many
        ? t('table.headerMenu.columnsTitle', { label })
        : t('table.headerMenu.columnTitle', { label }))
    : (many
        ? t('table.headerMenu.rowsTitle', { label })
        : t('table.headerMenu.rowTitle', { label }));

  const insertBeforeLabel = isColumn
    ? (many
        ? t('table.headerMenu.insertColumnsLeft', { count })
        : t('table.headerMenu.insertColumnLeft'))
    : (many
        ? t('table.headerMenu.insertRowsAbove', { count })
        : t('table.headerMenu.insertRowAbove'));

  const insertAfterLabel = isColumn
    ? (many
        ? t('table.headerMenu.insertColumnsRight', { count })
        : t('table.headerMenu.insertColumnRight'))
    : (many
        ? t('table.headerMenu.insertRowsBelow', { count })
        : t('table.headerMenu.insertRowBelow'));

  const deleteLabel = isColumn
    ? (many
        ? t('table.headerMenu.deleteColumns', { count })
        : t('table.headerMenu.deleteColumn'))
    : (many
        ? t('table.headerMenu.deleteRows', { count })
        : t('table.headerMenu.deleteRow'));

  return (
    <>
      <DxfMenuItem disabled>
        <DxfMenuLabel>{title}</DxfMenuLabel>
      </DxfMenuItem>
      <DxfMenuSeparator />

      <DxfMenuItem disabled={!canInsert} onClick={onInsertBefore}>
        <DxfMenuIcon>{isColumn ? <ArrowLeft size={16} /> : <ArrowUp size={16} />}</DxfMenuIcon>
        <DxfMenuLabel>{insertBeforeLabel}</DxfMenuLabel>
      </DxfMenuItem>

      <DxfMenuItem disabled={!canInsert} onClick={onInsertAfter}>
        <DxfMenuIcon>{isColumn ? <ArrowRight size={16} /> : <ArrowDown size={16} />}</DxfMenuIcon>
        <DxfMenuLabel>{insertAfterLabel}</DxfMenuLabel>
      </DxfMenuItem>

      <DxfMenuSeparator />

      <DxfMenuItem destructive disabled={!canDelete} onClick={onDelete}>
        <DxfMenuIcon><Trash2 size={16} /></DxfMenuIcon>
        <DxfMenuLabel>{deleteLabel}</DxfMenuLabel>
      </DxfMenuItem>

      <DxfMenuSeparator />

      {/*
        🔴 ADR-739 §61 — **ΜΕΤΑ τη διαγραφή, και αυτό είναι μέτρηση, όχι αισθητική.**

        Η ισχυρή τοπική σύμβαση («η καταστροφική εντολή τελευταία») λέει το αντίθετο· η σειρά του
        Excel στη λωρίδα γραμμής/στήλης είναι ρητή και ο ιδιοκτήτης παρήγγειλε **1:1 με το
        Excel**: `… Εισαγωγή · Διαγραφή · Απαλοιφή περιεχομένων · **Μορφοποίηση κελιών…** · Ύψος
        γραμμής… · Απόκρυψη`. Άρα το item κάθεται εδώ, σε **δική του** ομάδα — που είναι και ο
        λόγος που η διαγραφή δεν παύει να είναι οπτικά απομονωμένη.

        ⚠️ Ποτέ γκρίζο: ο στόχος υπάρχει (αλλιώς το μενού δεν θα είχε ανοίξει), και η μορφοποίηση
        δεν έχει την προϋπόθεση «όλα ή τίποτα» που φρουρεί τη διαγραφή (§42).
      */}
      <DxfMenuItem onClick={onFormatCells}>
        <DxfMenuIcon><SlidersHorizontal size={16} /></DxfMenuIcon>
        <DxfMenuLabel>{t('table.headerMenu.formatCells')}</DxfMenuLabel>
      </DxfMenuItem>
    </>
  );
}
