'use client';

/**
 * 🔴 ADR-739 §55 — **η στοίχιση** στο mini toolbar: σειρά 2, θέση 3, ένα πτυσσόμενο.
 *
 * ## Γιατί ΕΝΑ πτυσσόμενο και όχι έξι κουμπιά
 * Το Excel δίνει έξι ξεχωριστά κουμπιά — αλλά στην **κορδέλα**, όπου υπάρχει πλάτος. Στο mini
 * toolbar η ίδια εντολή είναι ένα κουμπί με βελάκι, γιατί η επιφάνεια πρέπει να χωρά πάνω από
 * το μενού χωρίς να το σκεπάζει. Έξι θέσεις εδώ θα έσπρωχναν τα περιγράμματα και τη συγχώνευση
 * εκτός οθόνης στα δεξιά — δηλαδή θα χαλούσαν το 1:1 που είναι όλος ο λόγος αυτής της δουλειάς.
 *
 * ## 🔴 Η ΜΙΑ ΤΙΜΗ, ΟΙ ΔΥΟ ΕΡΩΤΗΣΕΙΣ — και ΠΟΥ ζει η απάντηση
 * Το `TableCellAlign` είναι **ένα** γράμμα κάθετης + **ένα** οριζόντιας θέσης (`'ML'`, `'TR'`,
 * DXF group code 170). Άρα «στοίχισε αριστερά» δεν είναι εγγραφή ενός πεδίου: είναι
 * **αντικατάσταση του μισού** και διατήρηση του άλλου μισού.
 *
 * ⚠️ **Ο κανόνας ΔΕΝ ζει πια εδώ** (§56). Ήταν ιδιωτικός σε αυτό το αρχείο όσο η στοίχιση είχε
 * **μία** επιφάνεια· η κορδέλα είναι η δεύτερη, και τα έξι κουμπιά της ρωτούν **το ίδιο**.
 * Μετακόμισε αυτούσιος στο {@link ../../../bim/table/table-align-ops} — μαζί με το γιατί.
 * Εδώ μένει **μόνο** η εμφάνιση και η μετάφραση του πατήματος σε επιλογή.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableAlignMenu
 * @see bim/table/table-align-ops.ts — τι κάνει το πάτημα (SSoT)
 * @see types/table.ts — οι 9 θέσεις του `ACAD_TABLE`
 */

import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  MIXED_BASE_TABLE_ALIGN,
  isTableAlignActive,
  nextTableAlign,
  tableAlignHorizontal,
  type TableAlignChoice,
} from '../../../bim/table/table-align-ops';
import type { TableCellAlign } from '../../../types/table';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarListItem, ToolbarListPanel } from './ToolbarListPanel';
import { useToolbarPanel } from './use-toolbar-panel';
import { useRovingToolbar, type RovingItemProps } from './use-roving-toolbar';
import panel from './table-toolbar-panel.module.css';
import styles from './TableFormatToolbar.module.css';

export interface TableAlignMenuProps {
  /** Η στοίχιση που ισχύει· `null` ⇒ **ανάμεικτος** στόχος. */
  readonly current: TableCellAlign | null;
  /** Γράφει `align` — ακριβώς το `setField(target, 'align', value)`. */
  readonly onSetAlign: (value: TableCellAlign) => void;
  readonly roving: RovingItemProps;
}

/** Ένα κουμπί με βελάκι· το πάνελ έχει δικό του κατακόρυφο roving. */
export const TABLE_ALIGN_SLOTS = 1;

/**
 * Οι έξι επιλογές σε **μία** λίστα, με τον άξονα ως ετικέτα.
 *
 * ⚠️ Δύο λίστες (`HORIZONTAL` / `VERTICAL`) και δύο `map` ήταν η πρώτη γραφή — και το
 * `jscpd:diff` (CHECK 3.28) τα μέτρησε ως **δίδυμα 7 γραμμών / 61 tokens** μέσα στο ίδιο
 * αρχείο. Δεν ήταν λίγες γραμμές το πρόβλημα: ήταν ότι κάθε αλλαγή στο πώς αποδίδεται μια
 * επιλογή (εικονίδιο, `autoFocus`, roving) έπρεπε να γίνει **δύο** φορές, και η δεύτερη θα
 * ξεχνιόταν. Η διακριτή ένωση κρατά τους δύο άξονες **τύπους** χωριστούς εκεί που πρέπει (τα
 * γράμματα δεν ανακατεύονται) και την **απόδοση** μία.
 *
 * 🔑 §56 — η ένωση **είναι** το {@link TableAlignChoice} του SSoT, εμπλουτισμένο με ό,τι
 * χρειάζεται η οθόνη. Ένα παράλληλο `axis`/`code` εδώ θα ήταν δεύτερος ορισμός του «ποιες
 * επιλογές υπάρχουν», και η κορδέλα θα μπορούσε κάποτε να προσφέρει άλλες έξι.
 */
type AlignOption = TableAlignChoice & {
  readonly labelKey: string;
  readonly Icon: typeof AlignLeft;
};

/** Πρώτα η οριζόντια (η σειρά του Excel: αριστερά → δεξιά), μετά η κάθετη. */
const ALIGN_OPTIONS: readonly AlignOption[] = [
  { axis: 'horizontal', code: 'L', labelKey: 'table.formatToolbar.alignLeft', Icon: AlignLeft },
  { axis: 'horizontal', code: 'C', labelKey: 'table.formatToolbar.alignCenter', Icon: AlignCenter },
  { axis: 'horizontal', code: 'R', labelKey: 'table.formatToolbar.alignRight', Icon: AlignRight },
  { axis: 'vertical', code: 'T', labelKey: 'table.formatToolbar.alignTop', Icon: AlignVerticalJustifyStart },
  { axis: 'vertical', code: 'M', labelKey: 'table.formatToolbar.alignMiddle', Icon: AlignVerticalJustifyCenter },
  { axis: 'vertical', code: 'B', labelKey: 'table.formatToolbar.alignBottom', Icon: AlignVerticalJustifyEnd },
];

/** Πού αλλάζει ερώτηση η λίστα — **παραγόμενο**, ώστε ο διαχωριστής να μη γραφτεί ως δείκτης. */
const FIRST_VERTICAL_INDEX = ALIGN_OPTIONS.findIndex((option) => option.axis === 'vertical');

export function TableAlignMenu(props: TableAlignMenuProps): React.ReactElement {
  const { current, onSetAlign, roving } = props;
  const { t } = useTranslation('dxf-viewer');
  const control = useToolbarPanel();
  const listRoving = useRovingToolbar(ALIGN_OPTIONS.length, 'vertical');

  // Το εικονίδιο του κουμπιού λέει την **οριζόντια** θέση: είναι αυτή που βλέπει ο χρήστης στο
  // κείμενο του κελιού, ενώ η κάθετη φαίνεται μόνο σε ψηλές γραμμές.
  const shownHorizontal = tableAlignHorizontal(current ?? MIXED_BASE_TABLE_ALIGN);
  const TriggerIcon = ALIGN_OPTIONS.find(
    (option) => option.axis === 'horizontal' && option.code === shownHorizontal,
  )?.Icon ?? AlignLeft;

  return (
    <span className={panel.anchor}>
      <ToolbarButton
        roving={roving}
        title={t('table.formatToolbar.align')}
        hint={current === null ? t('table.formatToolbar.mixedHint') : undefined}
        className={styles.combo}
        popup={{
          isOpen: control.isOpen,
          panelId: control.panelId,
          kind: 'menu',
          triggerRef: control.triggerRef,
        }}
        onActivate={control.toggle}
      >
        <TriggerIcon size={15} aria-hidden="true" />
        <ChevronDown size={12} aria-hidden="true" />
      </ToolbarButton>

      {control.isOpen ? (
        <ToolbarListPanel
          panelId={control.panelId}
          label={t('table.formatToolbar.alignMenuLabel')}
          role="menu"
          onKeyDown={control.onPanelKeyDown}
        >
          {ALIGN_OPTIONS.map((option, index) => (
            <React.Fragment key={option.code}>
              {/* Δύο **ορθογώνιες** ερωτήσεις, όχι έξι εναλλακτικές: ο διαχωριστής το λέει
                  στον αναγνώστη οθόνης (`role="separator"`) και στο μάτι με την ίδια κίνηση. */}
              {index === FIRST_VERTICAL_INDEX
                ? <span className={panel.separator} role="separator" />
                : null}
              <ToolbarListItem
                role="menuitemradio"
                label={t(option.labelKey)}
                icon={<option.Icon size={15} aria-hidden="true" />}
                selected={isTableAlignActive(current, option)}
                // 🔴 §26.8 — **υπό όρο**: εστιάζει τον πρώτο μόνο όταν το πληκτρολόγιο δεν το
                // κρατούσε ήδη το κελί τη στιγμή που άνοιξε το πάνελ.
                autoFocus={index === 0 && control.mayTakeKeyboard}
                roving={listRoving.itemProps(index)}
                onSelect={() => control.runAndClose(() => onSetAlign(nextTableAlign(current, option)))}
              />
            </React.Fragment>
          ))}
        </ToolbarListPanel>
      ) : null}
    </span>
  );
}

