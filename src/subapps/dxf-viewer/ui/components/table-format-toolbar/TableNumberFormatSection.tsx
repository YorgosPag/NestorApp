'use client';

/**
 * 🔴 ADR-760 / ADR-739 §55 — **τα πέντε κουμπιά αριθμού** του mini toolbar, όπως ακριβώς τα
 * τοποθετεί το Excel: τρία στη **σειρά 1** (λογιστική · % · χιλιάδες) και δύο στη **σειρά 2**
 * (δεκαδικά ±).
 *
 * ## Γιατί ΔΥΟ components σε ΕΝΑ αρχείο, και όχι ένα ή δύο αρχεία
 * Είναι **μία** απόφαση («τι σημαίνει ο αριθμός αυτού του κελιού») σπασμένη σε δύο σημεία της
 * διάταξης. Ένα component δεν γίνεται: τα κουμπιά ζουν σε διαφορετικές σειρές του DOM, και η
 * αρίθμηση roving ακολουθεί **τη σειρά του DOM**. Δύο αρχεία επίσης όχι: θα χώριζαν την
 * κατάσταση από τις εντολές της, δηλαδή θα γεννούσαν δεύτερο `TableNumberFormatState` — και
 * τότε «τι είναι πατημένο» θα μπορούσε κάποτε να απαντηθεί αλλιώς πάνω και αλλιώς κάτω.
 *
 * ## Πού ΔΕΝ ζει η απόφαση
 * Καμία γραμμή εδώ δεν ξέρει τι σημαίνει «%»: το ρωτά το `table-number-format-ops.ts` (καθαρό,
 * ελέγξιμο χωρίς React). Εδώ ζει **μόνο** η εμφάνιση και η μετάφραση του πατήματος σε τιμή.
 *
 * ## Τα γλυφά `000` / `.0←` / `.00→`
 * Δεν είναι κείμενο και **δεν μεταφράζονται**: είναι σύμβολα, όπως το `%` δίπλα τους — τα ίδια
 * ψηφία σε κάθε γλώσσα, στην ίδια θέση, στο ίδιο εικονίδιο του Excel εδώ και τριάντα χρόνια.
 * Το προσβάσιμο **όνομα** κάθε κουμπιού έρχεται κανονικά από το `t()` (`aria-label`), οπότε ο
 * αναγνώστης οθόνης δεν ακούει ποτέ γλυφό.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableNumberFormatSection
 * @see bim/table/table-number-format-ops.ts — τι κάνει το πάτημα (SSoT)
 */

import React from 'react';
import { Euro, Percent } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  isTableNumberFormatActive,
  nextTableNumberFormat,
  stepTableNumberFormatDecimals,
  type TableDecimalStepDirection,
  type TableNumberFormatCommandId,
} from '../../../bim/table/table-number-format-ops';
import type { TableCellFormat } from '../../../types/table-cell-format';
import { ToolbarButton } from './ToolbarButton';
import type { RovingItemProps } from './use-roving-toolbar';
import styles from './TableFormatToolbar.module.css';

/** Τι μορφή ισχύει **τώρα** στον στόχο — η μία ανάγνωση που τροφοδοτεί και τα πέντε κουμπιά. */
export interface TableNumberFormatState {
  /**
   * Η επιλυμένη μορφή (`resolveCellNumberFormat`)· `null` ⇒ **ανάμεικτος** στόχος.
   *
   * Επιλυμένη και όχι ωμή παράκαμψη: το κουμπί «%» οφείλει να δείχνει πατημένο και όταν το
   * ποσοστό έρχεται από τη σημασιολογική βάση της στήλης — ο χρήστης βλέπει ποσοστά, και ένα
   * ελεύθερο κουμπί θα του έλεγε ψέματα.
   */
  readonly current: TableCellFormat | null;
  /** Ο στόχος δηλώνει τη μορφή **ρητά** (κουκκίδα, ίδια σημασιολογία με τα Β/Ι/Υ). */
  readonly explicit: boolean;
}

export interface TableNumberFormatSectionProps {
  readonly state: TableNumberFormatState;
  /**
   * Γράφει `numberFormat`: τιμή ⇒ ρητή μορφή · `undefined` ⇒ **σβήσε** το πεδίο (κληρονομιά).
   *
   * Η υπογραφή είναι ακριβώς αυτή του `setField(target, 'numberFormat', value)`, ώστε ο ξενιστής
   * να μην έχει τίποτα να μεταφράσει — και να μη γεννηθεί δεύτερος δρόμος προς την ίδια εγγραφή.
   */
  readonly onSetNumberFormat: (value: TableCellFormat | undefined) => void;
  readonly rovingOf: (index: number) => RovingItemProps;
}

/** Λογιστική · ποσοστό · χιλιάδες. */
export const TABLE_NUMBER_KIND_SLOTS = 3;
/** Μείωση · αύξηση δεκαδικών. */
export const TABLE_DECIMAL_SLOTS = 2;

/**
 * Τα τρία «τι **είδους** αριθμός» — σειρά 1, θέσεις 5-7.
 *
 * Η σειρά **είναι** η σειρά του Excel και δεν είναι διακοσμητική: ο χρήστης που ξέρει Excel
 * φτάνει με μνήμη χεριού, όχι διαβάζοντας εικονίδια.
 */
const KIND_COMMANDS: readonly {
  readonly id: TableNumberFormatCommandId;
  readonly labelKey: string;
  readonly glyph?: string;
  readonly Icon?: typeof Euro;
}[] = [
  { id: 'accounting', labelKey: 'table.formatToolbar.accountingFormat', Icon: Euro },
  { id: 'percent', labelKey: 'table.formatToolbar.percentFormat', Icon: Percent },
  { id: 'grouping', labelKey: 'table.formatToolbar.thousandsFormat', glyph: '000' },
];

export function TableNumberKindButtons(
  props: TableNumberFormatSectionProps,
): React.ReactElement {
  const { state, onSetNumberFormat, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <>
      {KIND_COMMANDS.map(({ id, labelKey, glyph, Icon }, index) => {
        const active = isTableNumberFormatActive(state.current, id);
        return (
          <ToolbarButton
            key={id}
            roving={rovingOf(index)}
            title={t(labelKey)}
            hint={state.current === null ? t('table.formatToolbar.mixedHint') : undefined}
            // Η κουκκίδα ανάβει **μόνο** στο κουμπί που ισχύει: «ρητό» είναι ιδιότητα της
            // μορφής, όχι των τριών κουμπιών που τη ρωτούν.
            state={{ active, mixed: state.current === null, explicit: active && state.explicit }}
            onActivate={() => onSetNumberFormat(nextTableNumberFormat(state.current, id))}
          >
            {Icon ? <Icon size={15} aria-hidden="true" /> : null}
            {glyph ? <span className={styles.glyph} aria-hidden="true">{glyph}</span> : null}
          </ToolbarButton>
        );
      })}
    </>
  );
}

/** Τα δύο βήματα ακρίβειας — σειρά 2, θέσεις 7-8. Στεπερ, όχι διακόπτες: κανένα `aria-pressed`. */
const DECIMAL_STEPS: readonly {
  readonly direction: TableDecimalStepDirection;
  readonly labelKey: string;
  readonly glyph: string;
}[] = [
  { direction: -1, labelKey: 'table.formatToolbar.decreaseDecimal', glyph: '.0←' },
  { direction: 1, labelKey: 'table.formatToolbar.increaseDecimal', glyph: '.00→' },
];

export function TableDecimalButtons(props: TableNumberFormatSectionProps): React.ReactElement {
  const { state, onSetNumberFormat, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <>
      {DECIMAL_STEPS.map(({ direction, labelKey, glyph }, index) => {
        // `null` ⇒ είμαστε στο άκρο της ακρίβειας: το κουμπί γκριζάρει αντί να «δουλεύει»
        // χωρίς να αλλάζει τίποτα — η ίδια απάντηση που δίνει και το μοντέλο (καμία εγγραφή,
        // κανένα βήμα undo).
        const next = stepTableNumberFormatDecimals(state.current, direction);
        return (
          <ToolbarButton
            key={labelKey}
            roving={rovingOf(index)}
            title={t(labelKey)}
            disabled={next === null}
            onActivate={() => {
              if (next !== null) onSetNumberFormat(next);
            }}
          >
            <span className={styles.glyph} aria-hidden="true">{glyph}</span>
          </ToolbarButton>
        );
      })}
    </>
  );
}
