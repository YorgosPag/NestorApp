'use client';

/**
 * 🔴 ADR-828 §7.2 — **τα items του μενού δεξιού συρσίματος της λαβής**: η υποδοχή του
 * {@link TABLE_FILL_MENU_GROUPS}, με εικονίδια και τον **έναν** κανόνα ενεργοποίησης.
 *
 * ## 🔴 Ο ΚΑΝΟΝΑΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ
 * Μια εντολή είναι πατήσιμη **μόνο** αν (α) η ταυτότητά της αντιστοιχεί σε
 * {@link TableFillMode} **και** (β) το `enabled[id] !== false`. Άρα οι τρεις χωρίς πράξη
 * («τάση», «τάση αύξησης», «Σειρά…») είναι **δομικά** γκρίζες: καμία δεν το δηλώνει μόνη της,
 * οπότε δεν υπάρχει `disabled` να ξεχαστεί. Η μέρα που θα υπάρξει «Γραμμική τάση» χρειάζεται
 * **μία** γραμμή στον χάρτη — και το item ανοίγει μόνο του.
 *
 * ## 🔑 Ο χάρτης ταυτότητα → κατάσταση είναι Η ΜΟΝΗ μετάφραση
 * Οι ταυτότητες του μενού είναι **προθέσεις ανθρώπου**, το {@link TableFillMode} είναι
 * λεξιλόγιο **μηχανής**. Επτά από τις οκτώ συμπίπτουν ονομαστικά· η όγδοη
 * (`withoutFormat` → `'noFormat'`) όχι, και αυτή ακριβώς αποδεικνύει ότι η σύμπτωση δεν είναι
 * συμβόλαιο. Γραμμένη μία φορά, εδώ.
 *
 * @module subapps/dxf-viewer/ui/components/table-fill-menu/TableFillMenuItems
 * @see ui/components/table-fill-menu/table-fill-menu-commands.ts — η διάταξη (καθαρή γνώση)
 * @see ui/components/TableFillOptionsMenu.tsx — ποιος τα ανοίγει και ποιος κλείνει το μενού
 */

import React from 'react';
import {
  CalendarDays,
  CalendarRange,
  Copy,
  Paintbrush,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { DxfMenuCommandItem } from '../dxf-context-menu/DxfMenuCommandItem';
import { DxfMenuSeparator } from '../dxf-context-menu/DxfContextMenu';
import {
  TABLE_FILL_MENU_GROUPS,
  type TableFillMenuCommandId,
  type TableFillMenuEnabled,
} from './table-fill-menu-commands';
import type { TableFillMode } from '../../../bim/table/table-fill-plan';

/**
 * Ταυτότητα μενού → κατάσταση μηχανής. **Μερικός επίτηδες**: η απουσία είναι ο μηχανισμός που
 * κρατά γκρίζες τις τρεις εντολές χωρίς πράξη. Δες την κεφαλίδα.
 */
const MODE_BY_COMMAND: Readonly<Partial<Record<TableFillMenuCommandId, TableFillMode>>> = {
  copyCells: 'copy',
  fillSeries: 'series',
  formatOnly: 'formatOnly',
  withoutFormat: 'noFormat',
  fillDays: 'days',
  fillWeekdays: 'weekdays',
  fillMonths: 'months',
  fillYears: 'years',
};

/**
 * Τα εικονίδια ζουν **εδώ** και όχι στο μητρώο: είναι React, και το μητρώο οφείλει να μένει
 * εισαγώγιμο χωρίς JSX runtime. `null` όπου το Excel δείχνει item **χωρίς** εικονίδιο — η
 * υποδοχή κρατά ούτως ή άλλως το αυλάκι των 16px, ώστε οι ετικέτες να στοιχίζονται.
 */
const COMMAND_ICONS: Readonly<Record<TableFillMenuCommandId, LucideIcon | null>> = {
  copyCells: Copy,
  fillSeries: null,
  formatOnly: Paintbrush,
  withoutFormat: null,
  fillDays: CalendarDays,
  fillWeekdays: null,
  fillMonths: CalendarRange,
  fillYears: null,
  linearTrend: TrendingUp,
  growthTrend: null,
  series: null,
};

export interface TableFillMenuItemsProps {
  /** Η **μία** πράξη: εκτέλεσε το γέμισμα με αυτή την πρόθεση. */
  readonly onPick: (mode: TableFillMode) => void;
  /** Ποιες εντολές έχουν νόημα ΤΩΡΑ (σειρά; ημερολόγιο;). */
  readonly enabled: TableFillMenuEnabled;
}

/**
 * Τα items **δεν κλείνουν μόνα τους**: το κλείσιμο το ζητά το ίδιο το Radix (`onSelect` ⇒
 * `onOpenChange(false)`), δηλαδή περνά από τον **έναν** δρόμο εξόδου του γονέα.
 *
 * Το διαχωριστικό μπαίνει **πριν** από κάθε ομάδα πλην της πρώτης — εδώ δεν υπάρχει τίτλος από
 * πάνω (το Excel δεν έχει, και σωστά: η περιοχή είναι ήδη ζωγραφισμένη στην οθόνη), άρα η
 * πρώτη ομάδα ακουμπά στην κορυφή του μενού.
 */
export function TableFillMenuItems({
  onPick, enabled,
}: TableFillMenuItemsProps): React.ReactElement {
  return (
    <>
      {TABLE_FILL_MENU_GROUPS.map((group, index) => (
        // Κλειδί το πρώτο item της ομάδας: οι ταυτότητες είναι μοναδικές σε όλο το μενού και ο
        // τύπος μη-κενής πλειάδας εγγυάται ότι υπάρχει — ποτέ `index` ως κλειδί.
        <React.Fragment key={group[0].id}>
          {index > 0 ? <DxfMenuSeparator /> : null}
          {group.map((entry) => {
            // 🔴 Ο ΕΝΑΣ κανόνας: κατάσταση **και** μη-`false`. Καμία τρίτη διαδρομή —
            // και η απουσία χειριστή είναι **η ίδια** που κάνει το item γκρίζο
            // ({@link DxfMenuCommandItem}), οπότε δεν υπάρχει δεύτερο `disabled` να ξεχαστεί.
            const mode = MODE_BY_COMMAND[entry.id];
            const pick =
              mode !== undefined && enabled[entry.id] !== false ? () => onPick(mode) : undefined;
            return (
              <DxfMenuCommandItem
                key={entry.id}
                icon={COMMAND_ICONS[entry.id]}
                labelKey={entry.labelKey}
                onSelect={pick}
              />
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
}
