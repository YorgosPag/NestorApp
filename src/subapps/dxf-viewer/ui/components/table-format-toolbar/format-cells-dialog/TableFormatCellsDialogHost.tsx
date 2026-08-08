'use client';

/**
 * 🔴 ADR-739 §61 — **Ο ΕΝΑΣ ΞΕΝΙΣΤΗΣ** του διαλόγου «Μορφοποίηση κελιών».
 *
 * ## Τι λύνει, με μία πρόταση
 * Μέχρι το §60 **κάθε εκκινητής ζωγράφιζε τον δικό του** διάλογο και το store κρατούσε μόνο
 * ποιος τον κατέχει. Αυτό είναι εφικτό μόνο για υποδοχές που **είναι components** — δηλαδή για
 * κουμπιά. Το `Ctrl+1` δεν είναι component· ούτε το item ενός μενού που ξεμοντάρει τη στιγμή
 * που το πατάς. Με έναν ξενιστή, κάθε υποδοχή λέει σκέτο `openTableFormatCellsDialog(…)`.
 *
 * ## Γιατί εδώ, και όχι νέος μηχανισμός
 * Ο θεατής έχει **ήδη** ένα σημείο για μόνιμα μονταρισμένους, αυτο-συνδρομητικούς hosts: το
 * `app/DxfViewerDialogs.tsx`, που το τεκμηριώνει ρητά ως «growth sink … new modals/hosts land
 * here, NOT in DxfViewerContent». Εκεί ζουν ήδη έξι αδέλφια του πίνακα (`TableInsertFunction`,
 * `TableFunctionArguments`, `TableRangeOverwriteConfirm`, …). Ο διάλογος είναι ο **έβδομος
 * ένοικος**, όχι νέα μηχανική. *(Ελέγχθηκε πριν γραφτεί: δεν υπάρχει άλλος host αιωρούμενων
 * παλετών — οι τρεις παλέτες του ADR-723/724/736/745 μοντάρονται κι εκείνες μία-μία εκεί.)*
 *
 * ## 🔴 ΤΟ «ΟΚ» ΠΕΡΝΑ ΑΠΟ ΤΗ ΘΥΡΑ — και έτσι κλείνει η ΔΕΥΤΕΡΗ πόρτα που άφησε το §60
 * Το `TableFormatPort.commitModel` γεννήθηκε στο §60 ακριβώς για να είναι **μία** πόρτα προς την
 * ουρά εντολών, αλλά δύο από τις τρεις υποδοχές συνέχιζαν να περνούν δικό τους `onCommit`
 * (`moreBorders.onCommit` ⇒ `applyFormat`). Δεν ήταν σφάλμα — ήταν **η ίδια ουρά**, μετρημένα:
 * και τα δύο μονοπάτια είναι `useLiveTableMutation` πάνω σε `useLiveTable`, δηλαδή στον πίνακα
 * του **δρομέα**. Ήταν όμως δύο πόρτες, και η μέρα που η μία μάθαινε φύλακα (π.χ. «μη γράφεις
 * σε κλειδωμένο κελί») θα άφηνε την άλλη πίσω, σιωπηλά. Με έναν ξενιστή υπάρχει **ένας**
 * καλών — άρα το `onCommit` **έφυγε** από το συμβόλαιο των υποδοχών (−1 μέλος).
 *
 * ⚠️ Ο **στόχος** δεν μπόρεσε να φύγει, και δεν πρέπει: ο κανόνας Α22 δίνει στόχο που μπορεί να
 * είναι **έξω** από την επιλογή. Δες την κεφαλίδα του store.
 *
 * ## Gate-at-mount
 * Ο εξωτερικός host ακούει **μόνο** το ελαφρύ store· ολόκληρο το δέντρο του διαλόγου (επτά
 * πτυσσόμενα, ο επιλογέας γωνίας, το πλέγμα περιγραμμάτων) μοντάρεται μόνο όσο υπάρχει αίτημα.
 * Ίδιο μοτίβο με τους υπόλοιπους gate-at-mount hosts του `DxfViewerDialogs`.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsDialogHost
 * @see state/table-format-cells-dialog-store.ts — η κατάσταση και οι πέντε υποδοχές
 */

import React from 'react';
import {
  closeTableFormatCellsDialog,
  setTableFormatCellsTab,
  useTableFormatCellsRequest,
  type TableFormatCellsRequest,
} from '../../../../state/table-format-cells-dialog-store';
import { getTableFormatPort } from '../../../table-cell-editor/table-format-port';
import { TableFormatCellsDialog, type TableFormatCellsTarget } from './TableFormatCellsDialog';
import type { TableFormatCommitPlan } from '../../../../bim/table/table-format-commit-plan';
import type { PersistedTableModel } from '../../../../types/table';

/** Gate-at-mount: ο βαρύς διάλογος ζει μόνο όσο υπάρχει αίτημα. */
export function TableFormatCellsDialogHost(): React.ReactElement | null {
  const request = useTableFormatCellsRequest();
  if (request === null) return null;
  return <TableFormatCellsDialogMount request={request} />;
}

/**
 * 🔴 **Το `key` δεν είναι διακοσμητικό — είναι ο κύκλος ζωής του προσχεδίου.**
 *
 * Το προσχέδιο είναι `useState(target.model)`, δηλαδή σπέρνεται **στο mount**. Με έναν ξενιστή
 * που επιβιώνει, ένα δεύτερο άνοιγμα πάνω σε **άλλα** κελιά θα ξαναχρησιμοποιούσε το ίδιο
 * instance και θα κρατούσε το **παλιό** προσχέδιο: το «ΟΚ» θα έγραφε μοντέλο που ο χρήστης δεν
 * βλέπει. Μέχρι το §60 αυτό δεν μπορούσε να συμβεί «τυχαία» — κάθε εκκινητής μόνταρε τον δικό
 * του και το τεκμηρίωνε ρητά («ο διάλογος αποδίδεται έξω από κάθε συνθήκη … ώστε κάθε άνοιγμα να
 * ξεκινά από φρέσκο προσχέδιο, χωρίς effect επαναφοράς που μπορεί να ξεχαστεί»). Ο ένας ξενιστής
 * οφείλει να **διατηρήσει** αυτή την εγγύηση, και ο σειριακός αριθμός του αιτήματος τη διατηρεί
 * ακριβώς: **νέο άνοιγμα ⇒ νέο `id` ⇒ νέο instance**.
 *
 * ⚠️ Ρητή σύγκριση: το `id` αλλάζει **μόνο** στο άνοιγμα. Η αλλαγή καρτέλας μέσα στον διάλογο
 * κρατά το ίδιο `id` — αλλιώς κάθε πάτημα καρτέλας θα πετούσε ό,τι είχε ρυθμίσει ο χρήστης στην
 * προηγούμενη, που είναι κατά γράμμα το αντίθετο από τη λειτουργία ενός διαλόγου με καρτέλες.
 */
function TableFormatCellsDialogMount({
  request,
}: {
  readonly request: TableFormatCellsRequest;
}): React.ReactElement {
  return (
    <TableFormatCellsDialog
      key={request.id}
      target={request.target}
      tab={request.tab}
      onTabSelect={setTableFormatCellsTab}
      onCommit={commitDraft}
      onClose={closeTableFormatCellsDialog}
    />
  );
}

/**
 * Η **μία** πόρτα προς την ουρά εντολών (§6.6): ένα μοντέλο, ένα βήμα `Ctrl+Z`.
 *
 * 🔴 ADR-739 §63 — **περνά τον στόχο και επιστρέφει το πλάνο.** Ήταν
 * `getTableFormatPort()?.commitModel(model)` με τιμή επιστροφής `void`: η θύρα ξαναμάντευε πού
 * γράφει (τον πίνακα του δρομέα) και ο διάλογος έκλεινε ό,τι κι αν γινόταν. Δες
 * `bim/table/table-format-commit-plan.ts`.
 *
 * ⚠️ **Χωρίς θύρα ⇒ `target-missing`, ποτέ σιωπή και ποτέ εξαίρεση.** Ο διάλογος μπορεί να
 * επιβιώσει ένα καρέ μετά το ξεμοντάρισμα του καμβά· εκεί ο πίνακας είναι όντως άφταστος, που
 * είναι **ακριβώς** αυτό που σημαίνει η κατάσταση. Ένα `undefined`-και-κλείσε θα ήταν η ίδια
 * σιωπηλή απώλεια με άλλο όνομα.
 */
function commitDraft(
  target: TableFormatCellsTarget,
  model: PersistedTableModel,
): TableFormatCommitPlan {
  const port = getTableFormatPort();
  if (!port) return { status: 'refused', reason: 'target-missing' };
  return port.commitModel(target, model);
}
