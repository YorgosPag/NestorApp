'use client';

/**
 * 🔴 ADR-739 §52 — **τα τέσσερα σύνθετα χειριστήρια της καρτέλας «Μορφοποίηση»**, ως λεπτοί
 * wrappers γύρω από τα components που ήδη ζωγραφίζει το floating mini toolbar.
 *
 * ```
 *   χρώμα κειμένου / γεμίσματος  →  TableAxisColorMenu   (παλέτα + «Αυτόματο» + true-color)
 *   συγχώνευση                   →  TableMergeMenu       (split button + 4 εντολές)
 *   περιγράμματα                 →  TableBorderMenu      (13 + 4 + μολύβι + διάλογος)
 * ```
 *
 * ## 🔴 Γιατί wrappers και ΟΧΙ ribbon comboboxes
 * Κάθε ένα από τα τρία είναι **ολόκληρο χειριστήριο** με δικό του πάνελ, δικά του κλειδιά
 * i18n και δικά του tests — συνολικά ~1.200 γραμμές που δουλεύουν. Μια «έκδοση για την
 * κορδέλα» θα ήταν το δεύτερο αντίγραφο της ίδιας παλέτας και του ίδιου μενού, με δύο σημεία
 * να μάθουν κάποτε διαφορετικό κανόνα για το «τι σημαίνει Αυτόματο».
 *
 * Άρα εδώ δεν υπάρχει **καμία** γνώση μορφοποίησης: μόνο «ρώτα τη θύρα, δώσε τα ίδια props».
 *
 * ## 🔴 Το roving είναι ΑΔΡΑΝΕΣ — και είναι το σωστό
 * Τα components γεννήθηκαν μέσα σε `role="toolbar"` με roving tabindex (μία στάση `Tab` για
 * όλη τη γραμμή, WAI-ARIA APG). Η κορδέλα **δεν** είναι toolbar: κάθε κουμπί της είναι
 * κανονική στάση `Tab`, όπως σε Office και Revit. Επιβάλλοντας roving εδώ θα σπάγαμε τη
 * συνέπεια ολόκληρης της κορδέλας για τρία κουμπιά· επιβάλλοντας το αντίθετο στο toolbar θα
 * σπάγαμε το APG. Το `tabIndex: 0` με κενούς χειριστές λέει ακριβώς αυτό: «είμαι κανονική
 * στάση, δεν ανήκω σε roving ομάδα».
 *
 * ## Χωρίς θύρα ⇒ αδρανή, ποτέ σπασμένα
 * Η καρτέλα μπορεί να είναι ορατή ένα καρέ μετά το κλείσιμο του δρομέα. Κάθε widget απαντά
 * τότε με «τίποτα να κάνω» (σβηστά κουμπιά) αντί να πετάξει ή να μαντέψει στόχο.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/RibbonTableFormatWidgets
 * @see ui/table-cell-editor/table-format-port.ts — η θύρα
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getTableFormatPort,
  getTableFormatRevision,
  subscribeTableFormatPort,
} from '../../../table-cell-editor/table-format-port';
// 🔴 ADR-768 Βήμα 5 — το **ίδιο** κουμπί με το mini toolbar, ποτέ αντίγραφό του.
import {
  getTableFormatPainterState,
  subscribeTableFormatPainter,
} from '../../../../state/table-format-painter-store';
import { TableAxisColorMenu } from '../../../components/table-format-toolbar/TableAxisColorMenu';
import { TableBorderMenu } from '../../../components/table-format-toolbar/TableBorderMenu';
import { TableFormatPainterButton } from '../../../components/table-format-toolbar/TableFormatPainterButton';
import { TableMergeMenu } from '../../../components/table-format-toolbar/TableMergeMenu';
import type { RovingItemProps } from '../../../components/table-format-toolbar/use-roving-toolbar';
import type { TableMergeState } from '../../../../bim/table/table-range-merge-ops';
import type { TableAxisColorState } from '../../../components/table-format-toolbar/table-color-menu-selection';

/**
 * Μια θέση roving που **δεν** συμμετέχει σε roving ομάδα — δες την κεφαλίδα.
 *
 * Παγωμένο module-level αντικείμενο και όχι νέο ανά render: τα components το περνούν σε
 * `ref`/`onKeyDown` props, και μια νέα ταυτότητα ανά render θα ακύρωνε κάθε μελλοντικό
 * `React.memo` πάνω τους χωρίς κανένα όφελος.
 */
const INERT_ROVING: RovingItemProps = {
  ref: () => {},
  tabIndex: 0,
  onKeyDown: () => {},
  onFocus: () => {},
};

/** Ό,τι δείχνει ένα χειριστήριο χρώματος χωρίς στόχο: τίποτα, και τίποτα εφευρημένο. */
const EMPTY_COLOR_STATE: TableAxisColorState = {
  current: undefined,
  mixed: false,
  explicit: false,
  inheritedColor: undefined,
  inheritedMixed: false,
  drawingColors: [],
};

const EMPTY_MERGE_STATE: TableMergeState = { merged: false, canMerge: false };

/**
 * Η **μία** συνδρομή όλων των widgets: ο αριθμός έκδοσης της θύρας.
 *
 * Πρωτόγονος, άρα το `Object.is` του `useSyncExternalStore` κόβει κάθε περιττή απόδοση· και
 * αλλάζει **μόνο** σε αλλαγή στόχου ή μοντέλου, ποτέ ανά χαρακτήρα (δες τον εκδότη).
 */
function useTableFormatRevision(): number {
  return useSyncExternalStore(subscribeTableFormatPort, getTableFormatRevision, () => 0);
}

/**
 * ADR-739 Φ.Ε/Φ4 — το **χρώμα κειμένου** του τρέχοντος στόχου.
 *
 * Ένα component για τους δύο ρόλους και όχι δύο: η μόνη διαφορά είναι το πεδίο και ο ρόλος
 * χρώματος, και δύο σχεδόν-ταυτόσημα σώματα θα ήταν ο κλώνος που το ίδιο το
 * `table-format-snapshot.ts` απέφυγε ένα επίπεδο πιο κάτω.
 */
export function RibbonTableTextColorWidget(): React.ReactElement {
  useTableFormatRevision();
  const port = getTableFormatPort();
  return (
    <TableAxisColorMenu
      role="ink"
      rovingApply={INERT_ROVING}
      rovingMenu={INERT_ROVING}
      state={port?.colorState('textColorHex') ?? EMPTY_COLOR_STATE}
      // `undefined` = «Αυτόματο» (αφαίρεση ⇒ κληρονομιά). Το `null` δεν είναι εκφράσιμο για το
      // κείμενο, και σωστά: κείμενο χωρίς χρώμα δεν αποδίδεται.
      onSet={(value) => getTableFormatPort()?.setField('textColorHex', value)}
    />
  );
}

/** ADR-739 Φ.Ε/Φ4β — το **γέμισμα**: ίδιο σχήμα, με την τρίτη κατάσταση («ρητά κανένα»). */
export function RibbonTableFillColorWidget(): React.ReactElement {
  useTableFormatRevision();
  const port = getTableFormatPort();
  return (
    <TableAxisColorMenu
      role="fill"
      rovingApply={INERT_ROVING}
      rovingMenu={INERT_ROVING}
      state={port?.colorState('fillColorHex') ?? EMPTY_COLOR_STATE}
      onSet={(value) => getTableFormatPort()?.setField('fillColorHex', value)}
    />
  );
}

/**
 * ADR-755 — η **συγχώνευση**, με τον στόχο του δρομέα.
 *
 * ⚠️ Τα όρια ξαναρωτιούνται **μέσα** στον χειριστή και ποτέ δεν παγώνουν στο render: ένα
 * `Ctrl+Z` ανάμεσα στην απόδοση και το κλικ σημαίνει «καμία πράξη», ποτέ εγγραφή σε κελιά
 * που δεν υπάρχουν πια (ADR-040 κανόνας #2).
 */
export function RibbonTableMergeWidget(): React.ReactElement {
  useTableFormatRevision();
  const port = getTableFormatPort();
  const bounds = port?.bounds() ?? null;
  return (
    <TableMergeMenu
      rovingApply={INERT_ROVING}
      rovingMenu={INERT_ROVING}
      state={port && bounds ? port.merge.resolveState(bounds) : EMPTY_MERGE_STATE}
      onApply={(commandId) => {
        const live = getTableFormatPort();
        const target = live?.bounds();
        if (live && target) void live.merge.applyCommand(target, commandId);
      }}
    />
  );
}

/** ADR-750 Φ3/Φ5/Φ6 — τα **περιγράμματα**: 13 εντολές + 4 διαγώνιες + μολύβι + διάλογος. */
export function RibbonTableBordersWidget(): React.ReactElement {
  useTableFormatRevision();
  const port = getTableFormatPort();
  const bounds = port?.bounds() ?? null;
  const run = (action: (target: NonNullable<typeof bounds>) => void): void => {
    const live = getTableFormatPort();
    const target = live?.bounds();
    if (target) action(target);
  };
  return (
    <TableBorderMenu
      roving={INERT_ROVING}
      canReset={port !== null && bounds !== null && port.borders.canReset(bounds)}
      canClearDiagonals={port !== null && bounds !== null && port.borders.canClearDiagonals(bounds)}
      onApply={(commandId) => run((target) => getTableFormatPort()?.borders.applyCommand(target, commandId))}
      onReset={() => run((target) => getTableFormatPort()?.borders.resetBorders(target))}
      onApplyDiagonal={(commandId) => run((target) => getTableFormatPort()?.borders.applyDiagonal(target, commandId))}
      resolvePencil={() => getTableFormatPort()?.borders.resolvePencil() ?? null}
      moreBorders={{
        // ADR-750 Φ6 — ο διάλογος ξαναρωτά τα **ίδια** όρια τη στιγμή του ανοίγματος: ένα undo
        // ενόσω η κορδέλα ήταν ορατή σημαίνει «δεν ανοίγει», ποτέ διάλογος πάνω σε φάντασμα.
        resolveTarget: () => {
          const live = getTableFormatPort();
          const target = live?.bounds();
          return live && target ? live.borders.resolveDialogTarget(target) : null;
        },
        onCommit: (model) => getTableFormatPort()?.borders.commitModel(model),
      }}
    />
  );
}

/**
 * 🔴 ADR-768 Βήμα 5 — **ΤΟ ΠΙΝΕΛΟ ΜΟΡΦΟΠΟΙΗΣΗΣ, ΣΤΗ ΜΟΝΙΜΗ ΕΠΙΦΑΝΕΙΑ.**
 *
 * ## Γιατί το κουμπί ΔΕΝ αρκούσε στο mini toolbar (μετρήθηκε 2026-08-07)
 * Το `TableFormatToolbar` μοντάρεται **μόνο** μέσα στα `TableHeaderContextMenu` /
 * `TableRangeContextMenu` — δηλαδή στο **μενού δεξιού κλικ**. Το `useKeepOpenOnSurface` το κρατά
 * ανοιχτό όσο πατάς **πάνω** του, αλλά το κλικ στο κελί-στόχο είναι «έξω» ⇒ **το μενού κλείνει**.
 *
 * ⇒ Το «πατημένο κουμπί» θα ήταν ορατό **μέχρι το πρώτο βάψιμο**, και στο `locked` ο χρήστης δεν
 * θα είχε **πουθενά** να επιβεβαιώσει ότι το εργαλείο έμεινε ενεργό. Η κορδέλα δεν κλείνει ποτέ:
 * εκεί ζει η κατάσταση, ακριβώς όπως στο Excel, όπου το Home tab μένει ορατό όση ώρα βάφεις.
 *
 * ## 🔴 Η ΖΩΝΤΑΝΗ ΠΕΡΙΟΧΗ ΖΕΙ **ΕΔΩ**, ΚΑΙ ΟΧΙ ΣΤΟ ΚΟΥΜΠΙ
 * Μια `aria-live` περιοχή που **μοντάρεται μαζί** με το περιεχόμενό της δεν ανακοινώνεται
 * αξιόπιστα: οι αναγνώστες οθόνης αγνοούν κόμβους που εμφανίστηκαν στο ίδιο καρέ με το κείμενό
 * τους. Εδώ η περιοχή υπάρχει **άδεια** όσο ζει η καρτέλα (δηλαδή όσο ζει η συνεδρία πίνακα) και
 * αποκτά κείμενο **μόνο** τη στιγμή που οπλίζεται το πινέλο — δηλαδή αργότερα, πάντα.
 *
 * Είναι το κανάλι που κουβαλά τη διαφορά **«μία χρήση» ↔ «κλειδωμένο»**, την οποία το
 * `aria-pressed` δεν επιτρέπεται να πει (είναι δίτιμο· το `mixed` σημαίνει «μερική επιλογή»).
 * Το Excel δεν την ανακοινώνει καθόλου.
 */
export function RibbonTableFormatPainterWidget(): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const state = useSyncExternalStore(
    subscribeTableFormatPainter,
    getTableFormatPainterState,
    () => 'idle' as const,
  );

  return (
    <>
      <TableFormatPainterButton roving={INERT_ROVING} />
      <output role="status" aria-live="polite" className="sr-only">
        {/*
          Κυριολεκτικά κλειδιά και όχι δυναμικό `t(key)`: ο generator του i18n shell slice
          (ADR-744) **αρνείται** να παράγει σε ανεπίλυτη δυναμική κλήση, και η CHECK 3.8 δεν
          μπορεί να επαληθεύσει κλειδί που δεν βλέπει. Τρεις καταστάσεις, δύο ανακοινώσεις:
          το «ανενεργό» είναι σιωπή — μια ανακοίνωση «σβήστηκε» σε κάθε βάψιμο θα ήταν θόρυβος.
        */}
        {state === 'once' ? t('table.formatToolbar.formatPainterArmedOnce') : null}
        {state === 'locked' ? t('table.formatToolbar.formatPainterArmedLocked') : null}
      </output>
    </>
  );
}
