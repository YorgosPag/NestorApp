'use client';

/**
 * 🔴 ADR-739 §60 — **ΤΟ ΒΕΛΑΚΙ ΤΗΣ ΓΩΝΙΑΣ**: ο εκκινητής του διαλόγου «Μορφοποίηση κελιών» από
 * την κορδέλα.
 *
 * ## Η θέση και ο αριθμός τους είναι του Excel
 * Στο Excel **κάθε** ομάδα της «Κεντρική» που έχει διάλογο φέρει το δικό της βελάκι στην κάτω
 * δεξιά γωνία, και το καθένα ανοίγει το **ίδιο** παράθυρο στη **δική του** καρτέλα:
 * ```
 *   Γραμματοσειρά ↘  →  Μορφοποίηση κελιών ▸ Γραμματοσειρά   (δεν υπάρχει ακόμη — δηλωμένο)
 *   Στοίχιση      ↘  →  Μορφοποίηση κελιών ▸ Στοίχιση
 *   Αριθμός       ↘  →  Μορφοποίηση κελιών ▸ Αριθμός
 * ```
 * Δύο εκκινητές, **ένας** διάλογος: το `initialTab` είναι όλη η διαφορά τους. Δύο components θα
 * ήταν sibling clone (N.18) και δύο ευκαιρίες να μάθει ο ένας άλλον τρόπο να δεσμεύει.
 *
 * ## 🔴 Ο ΣΤΟΧΟΣ ΔΙΑΒΑΖΕΤΑΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΠΑΤΗΜΑΤΟΣ, ΠΟΤΕ ΣΤΟ RENDER
 * Ο κανόνας #2 του ADR-040, αυτούσιος: η καρτέλα μπορεί να είναι ορατή ενώ ένα `Ctrl+Z` άλλαξε
 * το μοντέλο. Ένα παγωμένο στιγμιότυπο θα άνοιγε διάλογο πάνω σε πίνακα που δεν υπάρχει πια, και
 * το «ΟΚ» θα έγραφε το **παλιό** μοντέλο πάνω στο νέο — δηλαδή σιωπηλή αναίρεση της αναίρεσης.
 *
 * ## 🔴 §61 — Η ΥΠΟΔΟΧΗ ΔΕΝ ΖΩΓΡΑΦΙΖΕΙ ΠΙΑ ΤΟΝ ΔΙΑΛΟΓΟ
 * Εδώ έγραφε: *«ο διάλογος αποδίδεται έξω από κάθε συνθήκη … ώστε κάθε άνοιγμα να ξεκινά από
 * φρέσκο προσχέδιο, χωρίς effect επαναφοράς που μπορεί να ξεχαστεί»*. Η **εγγύηση** μένει
 * ακέραιη· άλλαξε ποιος τη δίνει: το ξεμοντάρισμα του εκκινητή αντικαταστάθηκε από το `key` του
 * **ενός** ξενιστή, δεμένο στον σειριακό αριθμό του αιτήματος. Χωρίς αυτό δεν υπήρχε δρόμος για
 * το `Ctrl+1`, που **δεν έχει** component να ζωγραφίσει.
 *
 * Ό,τι μένει εδώ είναι όντως δικό του: το **κουμπί**, ο στόχος τη στιγμή του πατήματος, και η
 * ένδειξη «δείχνει τη δική μου καρτέλα».
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/RibbonTableFormatCellsWidget
 * @see ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsDialogHost.tsx
 */

import React, { useSyncExternalStore } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  getTableFormatPort,
  getTableFormatRevision,
  subscribeTableFormatPort,
} from '../../../table-cell-editor/table-format-port';
// 🔴 ADR-739 §61 — **ένας** διάλογος, **ένας** ξενιστής. Η υποδοχή δεν ζωγραφίζει πια τίποτα:
// λέει `open(…)` και ρωτά το store ποια καρτέλα δείχνει, για να φωτίσει το δικό της βελάκι.
// Μέχρι το §60 ζωγράφιζε τον δικό της διάλογο — δες την κεφαλίδα του store για το γιατί άλλαξε.
import {
  openTableFormatCellsDialog,
  useTableFormatCellsRequest,
} from '../../../../state/table-format-cells-dialog-store';
import {
  TABLE_FORMAT_CELLS_KEY,
  type TableFormatCellsTabId,
} from '../../../components/table-format-toolbar/format-cells-dialog/table-format-cells-labels';
import toolbar from '../../../components/table-format-toolbar/TableFormatToolbar.module.css';

interface FormatCellsLauncherProps {
  readonly tab: TableFormatCellsTabId;
  /** Το προσβάσιμο όνομα — **ποια** καρτέλα ανοίγει, όχι σκέτο «Μορφοποίηση κελιών». */
  readonly labelKey: string;
}

function FormatCellsLauncher({ tab, labelKey }: FormatCellsLauncherProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  useSyncExternalStore(subscribeTableFormatPort, getTableFormatRevision, () => 0);
  // 🔑 «Είναι **δικός μου** ο ανοιχτός διάλογος;» = «δείχνει τη **δική μου** καρτέλα;». Υπάρχει
  // ακριβώς ένα βελάκι ανά καρτέλα, άρα η καρτέλα **είναι** η ταυτότητα του εκκινητή — και
  // παραμένει σωστή όταν ο χρήστης αλλάξει καρτέλα μέσα στον διάλογο: το βελάκι που φωτίζει
  // γίνεται εκείνο της νέας καρτέλας, όπως ακριβώς και στο Excel.
  const openTab = useTableFormatCellsRequest()?.tab ?? null;

  // Χωρίς στόχο ⇒ σβηστό, ποτέ μαντεψιά: η καρτέλα ζει ένα καρέ μετά το κλείσιμο του δρομέα.
  const armed = getTableFormatPort()?.formatTarget() != null;

  return (
    <button
      type="button"
      className={cn(toolbar.button, openTab === tab && toolbar.buttonActive)}
      aria-label={t(labelKey)}
      aria-disabled={armed ? undefined : true}
      aria-haspopup="dialog"
      onClick={() => {
        // 🔴 Ο στόχος διαβάζεται **τη στιγμή του πατήματος** (ADR-040 κανόνας #2), και `null`
        // ⇒ δεν ανοίγει: η καρτέλα μπορεί να είναι ορατή ενώ ένα `Ctrl+Z` άλλαξε το μοντέλο.
        openTableFormatCellsDialog({ target: getTableFormatPort()?.formatTarget() ?? null, tab });
      }}
    >
      <Settings2 size={15} aria-hidden="true" />
    </button>
  );
}

/** Το βελάκι της ομάδας **«Αριθμός»** — ανοίγει στην καρτέλα «Αριθμός». */
export function RibbonTableFormatCellsNumberWidget(): React.ReactElement {
  return (
    <FormatCellsLauncher tab="number" labelKey={`${TABLE_FORMAT_CELLS_KEY}.launcher.number`} />
  );
}

/** Το βελάκι της ομάδας **«Στοίχιση»** — ανοίγει στην καρτέλα «Στοίχιση». */
export function RibbonTableFormatCellsAlignWidget(): React.ReactElement {
  return (
    <FormatCellsLauncher tab="alignment" labelKey={`${TABLE_FORMAT_CELLS_KEY}.launcher.alignment`} />
  );
}
