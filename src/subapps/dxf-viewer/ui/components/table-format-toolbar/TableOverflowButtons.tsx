'use client';

/**
 * 🔴 ADR-739 §58 Γ2 — **ΤΑ ΔΥΟ ΚΟΥΜΠΙΑ «ΤΙ ΓΙΝΕΤΑΙ ΟΤΑΝ ΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΧΩΡΑΕΙ»** στο mini
 * toolbar: αναδίπλωση · σμίκρυνση.
 *
 * ## 🔴 Δικό του αρχείο και ΟΧΙ θραύσμα του `TableFormatSection`
 * Κάθε θραύσμα εκείνου δείχνει **πεδίο του `TableCellStyle`** και μοιράζεται το ίδιο
 * `TableFormatSectionProps` (`format` + πέντε χειριστές). Το ξεχείλισμα δεν είναι πεδίο του
 * `TableCellStyle` — ζει μόνο στο `TableCellStyleOverride` και έχει **δικό του** γραφέα, με τον
 * ίδιο ακριβώς λόγο που η θύρα χρειάστηκε δύο ρητά μέλη. Στριμωγμένο εκεί, θα κουβαλούσε πέντε
 * χειριστές που δεν καλεί ποτέ.
 *
 * Είναι επίσης η κίνηση που έκανε ήδη το πινέλο (ADR-768 Βήμα 5, `TableFormatPainterButton`):
 * *ό,τι δεν διαβάζει το `format`, φεύγει από το `TableFormatSection`.*
 *
 * ## 🔴 ΤΟ ΚΟΥΜΠΙ «ΑΝΑΔΙΠΛΩΣΗ» ΗΤΑΝ ΕΔΩ ΑΠΟ ΤΟ §55 — ΑΝΕΝΕΡΓΟ, ΚΑΙ ΣΩΣΤΑ
 * Το `TableFormatWrapButton` κρατούσε τη **θέση 8** του Excel με `disabled` και υπόδειξη «δεν
 * είναι διαθέσιμο ακόμη», επειδή το `TableCellOverflow` είχε **μία** τιμή. Η αιτία εξαφανίστηκε:
 * το §58 έγραψε τη μηχανή (γραμμοκοπή UAX#29/#14, ισορρόπηση, ύψος από περιεχόμενο, τέσσερα
 * backends). Το κουμπί δεν μετακινήθηκε — **ενεργοποιήθηκε**, ακριβώς όπως προέβλεπε το σχόλιό
 * του, και δίπλα του μπήκε η σμίκρυνση.
 *
 * ## 🏆 Γιατί ΔΥΟ κουμπιά, ενώ το mini toolbar του Excel έχει ΕΝΑ
 * Το *Shrink to Fit* του Excel ζει μόνο στον διάλογο «Μορφοποίηση κελιών». Χωρίς **ορατό**
 * κουμπί, ένα κελί σε `'shrink'` δεν θα είχε καμία ένδειξη και καμία διέξοδο από αυτή τη γραμμή:
 * η αναδίπλωση θα φαινόταν απλώς «σβηστή», σαν να μην είχε πατηθεί ποτέ τίποτα. Η θέση είναι
 * **μετά** την αναδίπλωση ώστε καμία θέση του Excel να μη μετακινηθεί — ίδια αρχή με το «τρίτο
 * τμήμα» της σειράς 2 (§55).
 *
 * ## ⚠️ ΚΑΜΙΑ ΚΟΥΚΚΙΔΑ «ρητό» — και είναι απόφαση, όχι παράλειψη
 * Τα δίτιμα της μορφοποίησης ζωγραφίζουν κουκκίδα όταν ο στόχος **δηλώνει ρητά** το πεδίο, ώστε
 * ο χρήστης να ξεχωρίζει «το ζήτησα εγώ» από «το λέει το στυλ του σχεδίου». Στο ξεχείλισμα η
 * ερώτηση **δεν έχει νόημα**: η αλυσίδα είναι `κελί ▸ στήλη ▸ σταθερή προεπιλογή` και **δεν
 * περνά καθόλου από το `TableStyle`**. Δεν υπάρχει «το λέει το σχέδιο» να αντιδιασταλεί — και
 * μια κουκκίδα που είναι πάντα ίδια δεν πληροφορεί, απλώς λερώνει το κουμπί.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableOverflowButtons
 * @see bim/table/table-overflow-ops.ts — τι σημαίνει το πάτημα (SSoT, κοινό με την κορδέλα)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §58
 */

import React from 'react';
import { Shrink, WrapText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  isTableOverflowActive,
  nextTableOverflow,
  type TableOverflowChoice,
} from '../../../bim/table/table-overflow-ops';
import { ToolbarButton } from './ToolbarButton';
import type { RovingItemProps } from './use-roving-toolbar';
import type { TableCellOverflow } from '../../../types/table';

export interface TableOverflowButtonsProps {
  /** Τι ισχύει στον στόχο· `null` ⇒ **ανάμεικτος** (ή στόχος που δεν επιβίωσε). */
  readonly current: TableCellOverflow | null;
  /**
   * Γράφει την **τελική** τιμή — ακριβώς όπως το `onSetAlign` του {@link TableAlignMenu}.
   *
   * Ο κανόνας «ίδια ⇒ ξεπάτωμα» εφαρμόζεται **εδώ**, καλώντας το SSoT: ο ξενιστής δεν
   * ξαναποφασίζει τι σημαίνει το πάτημα, μόνο πού γράφεται.
   */
  readonly onSetOverflow: (value: TableCellOverflow) => void;
  /** Η θέση roving του **i-οστού** κουμπιού αυτού του θραύσματος· ο γονέας ξέρει το offset. */
  readonly rovingOf: (index: number) => RovingItemProps;
}

/** Αναδίπλωση · Σμίκρυνση. */
export const TABLE_OVERFLOW_SLOTS = 2;

/**
 * Οι δύο επιλογές ως δεδομένα — παράγονται, ποτέ γραμμένες δύο φορές.
 *
 * ⚠️ Το `'clip'` **λείπει επίτηδες** και ο τύπος το επιβάλλει ({@link TableOverflowChoice} =
 * `Exclude<…, 'clip'>`): η περικοπή είναι η προεπιλογή στην οποία επιστρέφεις **ξεπατώνοντας**,
 * όχι κατάσταση που επιλέγεις — ακριβώς όπως στο Excel, όπου δεν υπάρχει κουμπί «μην
 * αναδιπλώνεις».
 */
const OVERFLOW_OPTIONS: readonly {
  readonly choice: TableOverflowChoice;
  readonly labelKey: string;
  readonly Icon: typeof WrapText;
}[] = [
  { choice: 'wrap', labelKey: 'table.formatToolbar.wrapText', Icon: WrapText },
  { choice: 'shrink', labelKey: 'table.formatToolbar.shrinkToFit', Icon: Shrink },
];

/**
 * **Σειρά 1, θέση 8+** — Αναδίπλωση κειμένου · Σμίκρυνση ώστε να χωρά.
 *
 * 🔑 Η **αμοιβαία αποκλειστικότητα** δεν γράφεται πουθενά εδώ: το {@link nextTableOverflow}
 * επιστρέφει **μία** τιμή της ένωσης, οπότε «σμίκρυνση πάνω σε αναδιπλωμένο» σβήνει την
 * αναδίπλωση **δομικά**. Ένα χειροκίνητο «ξετσέκαρε το άλλο» θα ήταν κανόνας που η δεύτερη
 * επιφάνεια (η κορδέλα) μπορεί να ξεχάσει — και η διαφωνία τους θα ήταν αόρατη.
 */
export function TableOverflowButtons(props: TableOverflowButtonsProps): React.ReactElement {
  const { current, onSetOverflow, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <>
      {OVERFLOW_OPTIONS.map((option, index) => (
        <ToolbarButton
          key={option.choice}
          roving={rovingOf(index)}
          title={t(option.labelKey)}
          hint={current === null ? t('table.formatToolbar.mixedHint') : undefined}
          // `explicit: false` **πάντα** — δες την κεφαλίδα για το γιατί η ερώτηση «ποιος το
          // είπε;» δεν υπάρχει σε αυτή την αλυσίδα κληρονομιάς.
          state={{
            active: isTableOverflowActive(current, option.choice),
            mixed: current === null,
            explicit: false,
          }}
          onActivate={() => onSetOverflow(nextTableOverflow(current, option.choice))}
        >
          <option.Icon size={15} />
        </ToolbarButton>
      ))}
    </>
  );
}
