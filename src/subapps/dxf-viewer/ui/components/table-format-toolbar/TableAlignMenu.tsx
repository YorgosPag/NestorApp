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
 * ## 🔴 Η ΜΙΑ ΤΙΜΗ, ΟΙ ΔΥΟ ΕΡΩΤΗΣΕΙΣ
 * Το `TableCellAlign` είναι **ένα** γράμμα κάθετης + **ένα** οριζόντιας θέσης (`'ML'`, `'TR'`,
 * DXF group code 170). Άρα «στοίχισε αριστερά» δεν είναι εγγραφή ενός πεδίου: είναι
 * **αντικατάσταση του μισού** και διατήρηση του άλλου μισού. Γραμμένο ως έξι σταθερές
 * (`'TL'`,`'TC'`,…) το μενού θα ισοπέδωνε σιωπηλά την κάθετη θέση σε κάθε πάτημα — και ο
 * χρήστης θα έχανε το «κέντρο» του κελιού πατώντας «δεξιά».
 *
 * ⚠️ **Μία αποδεκτή ισοπέδωση, ρητά δηλωμένη**: όταν ο στόχος είναι **ανάμεικτος** δεν υπάρχει
 * «άλλο μισό» να κρατηθεί — η εγγραφή είναι μία τιμή για όλα τα κελιά. Ξεκινά τότε από την
 * προεπιλογή της κλάσης δεδομένων (`'ML'`, `table-style-presets.ts`). Είναι η ίδια φύση με την
 * ισοπέδωση μεγεθών του `stepAxisTextHeight` (Α2), όχι ελάττωμα εδώ.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableAlignMenu
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

/** Από πού ξεκινά η σύνθεση όταν δεν υπάρχει «τρέχουσα» τιμή — δες την ⚠️ της κεφαλίδας. */
const MIXED_BASE_ALIGN: TableCellAlign = 'ML';

/**
 * Οι έξι επιλογές σε **μία** λίστα, με τον άξονα ως ετικέτα.
 *
 * ⚠️ Δύο λίστες (`HORIZONTAL` / `VERTICAL`) και δύο `map` ήταν η πρώτη γραφή — και το
 * `jscpd:diff` (CHECK 3.28) τα μέτρησε ως **δίδυμα 7 γραμμών / 61 tokens** μέσα στο ίδιο
 * αρχείο. Δεν ήταν λίγες γραμμές το πρόβλημα: ήταν ότι κάθε αλλαγή στο πώς αποδίδεται μια
 * επιλογή (εικονίδιο, `autoFocus`, roving) έπρεπε να γίνει **δύο** φορές, και η δεύτερη θα
 * ξεχνιόταν. Η διακριτή ένωση κρατά τους δύο άξονες **τύπους** χωριστούς εκεί που πρέπει (τα
 * γράμματα δεν ανακατεύονται) και την **απόδοση** μία.
 */
type AlignOption =
  | {
    readonly axis: 'horizontal';
    readonly code: 'L' | 'C' | 'R';
    readonly labelKey: string;
    readonly Icon: typeof AlignLeft;
  }
  | {
    readonly axis: 'vertical';
    readonly code: 'T' | 'M' | 'B';
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

  const base = current ?? MIXED_BASE_ALIGN;
  // Το εικονίδιο του κουμπιού λέει την **οριζόντια** θέση: είναι αυτή που βλέπει ο χρήστης στο
  // κείμενο του κελιού, ενώ η κάθετη φαίνεται μόνο σε ψηλές γραμμές.
  const TriggerIcon = ALIGN_OPTIONS.find(
    (option) => option.axis === 'horizontal' && option.code === horizontalOf(base),
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
                selected={isAlignSelected(option, current)}
                autoFocus={index === 0}
                roving={listRoving.itemProps(index)}
                onSelect={() => control.runAndClose(() => onSetAlign(alignWith(option, base)))}
              />
            </React.Fragment>
          ))}
        </ToolbarListPanel>
      ) : null}
    </span>
  );
}

/**
 * Οι εννιά θέσεις ως **πλέγμα**, γραμμένες μία φορά.
 *
 * Η προφανής εναλλακτική — `` `${vertical}${horizontal}` `` — δίνει σωστό αποτέλεσμα αλλά
 * στηρίζεται στο ότι ο μεταγλωττιστής θα συμπεράνει τύπο template literal από τα συμφραζόμενα.
 * Το πλέγμα δεν στηρίζεται σε τίποτα: μια θέση που λείπει είναι **σφάλμα μεταγλώττισης**, και
 * το σχήμα του διαβάζεται όπως ακριβώς το ζωγραφίζει το group code 170.
 */
const ALIGN_GRID: Readonly<Record<'T' | 'M' | 'B', Readonly<Record<'L' | 'C' | 'R', TableCellAlign>>>> = {
  T: { L: 'TL', C: 'TC', R: 'TR' },
  M: { L: 'ML', C: 'MC', R: 'MR' },
  B: { L: 'BL', C: 'BC', R: 'BR' },
};

/**
 * Η επιλογή εφαρμοσμένη πάνω στην τρέχουσα τιμή: αλλάζει **μόνο** ο άξονάς της.
 *
 * Ο έλεγχος του άξονα δεν είναι αμυντικός — είναι ο τρόπος που ο μεταγλωττιστής στενεύει την
 * ένωση ώστε το `code` να είναι νόμιμο κλειδί του {@link ALIGN_GRID} σε κάθε κλάδο.
 */
function alignWith(option: AlignOption, base: TableCellAlign): TableCellAlign {
  return option.axis === 'horizontal'
    ? ALIGN_GRID[verticalOf(base)][option.code]
    : ALIGN_GRID[option.code][horizontalOf(base)];
}

/** Ανάμεικτος στόχος ⇒ **καμία** επιλογή τσεκαρισμένη: η ερώτηση δεν έχει μία απάντηση. */
function isAlignSelected(option: AlignOption, current: TableCellAlign | null): boolean {
  if (current === null) return false;
  return option.axis === 'horizontal'
    ? horizontalOf(current) === option.code
    : verticalOf(current) === option.code;
}

/** Τα δύο μισά, χωρίς `charAt` σε θέση όπου ο τύπος πρέπει να επιβιώσει. */
function verticalOf(align: TableCellAlign): 'T' | 'M' | 'B' {
  return align === 'TL' || align === 'TC' || align === 'TR'
    ? 'T'
    : align === 'ML' || align === 'MC' || align === 'MR'
      ? 'M'
      : 'B';
}

function horizontalOf(align: TableCellAlign): 'L' | 'C' | 'R' {
  return align === 'TL' || align === 'ML' || align === 'BL'
    ? 'L'
    : align === 'TC' || align === 'MC' || align === 'BC'
      ? 'C'
      : 'R';
}
