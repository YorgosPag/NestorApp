'use client';

/**
 * 🔴 ADR-755 — **το διαμέρισμα «μορφοποίηση ΑΞΟΝΑ»** του mini toolbar: Β/Ι/Υ, τα δύο χρώματα,
 * το μέγεθος, η επαναφορά.
 *
 * ## Γιατί έγινε δικό του component — και προαιρετικό
 * Το mini toolbar εμφανίζεται πλέον σε **δύο** συμφραζόμενα:
 *
 * ```
 *   δεξί κλικ σε ζώνη δείκτη  →  στόχος = ΑΞΟΝΑΣ    →  όλα τα παρακάτω ισχύουν
 *   δεξί κλικ σε κελιά        →  στόχος = ΠΕΡΙΟΧΗ   →  κανένα δεν ισχύει (ακόμη)
 * ```
 *
 * Τα εννιά χειριστήρια εδώ γράφουν `TableColumn.styleOverride` / `TableRow.styleOverride` —
 * δηλαδή **στυλ άξονα**. Πάνω σε επιλογή κελιών δεν υπάρχει άξονας να γράψουν, και μια
 * «μορφοποίηση περιοχής» δεν είναι η ίδια πράξη με άλλο όρισμα: είναι άλλη πράξη (κάθε κελί
 * ξεχωριστά, ή runs χαρακτήρων του ADR-753). Η υποδοχή περιοχής θα την αποκτήσει όταν γραφτεί,
 * όχι σαν παρενέργεια αυτής της φάσης.
 *
 * Άρα το τμήμα είναι **απόν**, όχι απενεργοποιημένο: εννιά γκρίζα κουμπιά που δεν πρόκειται να
 * ενεργοποιηθούν ποτέ σε αυτό το συμφραζόμενο θα ήταν υπόσχεση που δεν τηρείται.
 *
 * ## Γιατί ΕΝΑ prop και όχι οκτώ
 * Η ίδια απόφαση που πήρε ήδη το ADR-750 για τα περιγράμματα («**μία** ερώτηση και όχι πέντε
 * props»): ο τύπος **είναι** το συμβόλαιο. Οκτώ προαιρετικά props θα σήμαιναν οκτώ ελέγχους
 * `?.` στο δοχείο και μια κατάσταση «μισό τμήμα» που κανείς δεν θέλει να είναι εκφράσιμη.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableAxisFormatSection
 * @see ui/components/table-format-toolbar/TableFormatToolbar.tsx — το δοχείο
 */

import React from 'react';
import { AArrowDown, AArrowUp, Bold, Italic, RotateCcw, Underline } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TableAxisColorMenu } from './TableAxisColorMenu';
import { ToolbarButton, type TableToggleFormatState } from './ToolbarButton';
import type { TableAxisColorState } from './table-color-menu-selection';
import type { RovingItemProps } from './use-roving-toolbar';
import type { TextHeightStepDirection } from '../../../bim/table/table-text-height-scale';
import styles from './TableFormatToolbar.module.css';

/** Τα δίτιμα πεδία που εκθέτει το v1 του toolbar. */
export type TableToggleFormatKey = 'bold' | 'italic' | 'underline';

export interface TableAxisFormatSnapshot {
  readonly bold: TableToggleFormatState;
  readonly italic: TableToggleFormatState;
  readonly underline: TableToggleFormatState;
  /**
   * ADR-739 Φ.Ε/Φ4 — το **χρώμα κειμένου** κατά μήκος του άξονα.
   *
   * Δεν είναι δίτιμο, άρα δεν χωρά στο {@link TableToggleFormatState}: αντί για «πατημένο /
   * ελεύθερο» απαντά «**ποιο** χρώμα». Ο τύπος ζει στο `table-color-menu-selection` μαζί με
   * την ανάγνωσή του — η κατάσταση και ο κανόνας «ποια γραμμή είναι ενεργή» είναι μία απόφαση,
   * και χωρισμένα σε δύο αρχεία θα αποκλίνουν.
   */
  readonly textColor: TableAxisColorState;
  /** ADR-739 Φ.Ε/Φ4β — το **γέμισμα**: ίδιο σχήμα, τρεις καταστάσεις αντί για δύο. */
  readonly fillColor: TableAxisColorState;
  /** Ο άξονας δηλώνει **οτιδήποτε** ρητά — αλλιώς η «Επαναφορά στο στυλ» δεν έχει τι να κάνει. */
  readonly canReset: boolean;
}

export interface TableAxisFormatSectionProps {
  readonly format: TableAxisFormatSnapshot;
  readonly onToggle: (key: TableToggleFormatKey) => void;
  readonly onStepSize: (direction: TextHeightStepDirection) => void;
  readonly onReset: () => void;
  /**
   * ADR-739 Φ.Ε/Φ4 — το χρώμα **κειμένου** του άξονα, σε **μία** εντολή:
   * `hex` ρητό χρώμα · `undefined` «Αυτόματο» (αφαίρεση του πεδίου ⇒ κληρονομιά).
   *
   * Το `null` δεν είναι εκφράσιμο εδώ και σωστά — το `textColorHex` του μοντέλου δεν το δέχεται:
   * κείμενο χωρίς χρώμα δεν είναι κατάσταση που μπορεί να αποδώσει κανείς.
   */
  readonly onSetTextColor: (value: string | undefined) => void;
  /**
   * ADR-739 Φ.Ε/Φ4β — το **γέμισμα**, με την τρίτη κατάσταση:
   * `hex` ρητό · `null` **ρητά κανένα** (διαφανές, ακόμη κι αν το στυλ βάφει) · `undefined`
   * «Αυτόματο».
   *
   * Ένα prop και όχι τρία: είναι η δοκτρίνα που το ίδιο το `types/table.ts` γράφει για το
   * μοντέλο («**ένα** πεδίο, τρεις απαντήσεις — ποτέ δεύτερο παράλληλο boolean»), εφαρμοσμένη
   * ένα επίπεδο ψηλότερα. Τρεις εντολές θα ήταν τρεις δρόμοι προς την ίδια εγγραφή.
   */
  readonly onSetFillColor: (value: string | null | undefined) => void;
  /** Η θέση roving του **i-οστού** χειριστηρίου του τμήματος· ο γονέας ξέρει το offset. */
  readonly rovingOf: (index: number) => RovingItemProps;
}

const TOGGLES: readonly {
  readonly key: TableToggleFormatKey;
  readonly Icon: typeof Bold;
  readonly labelKey: string;
}[] = [
  { key: 'bold', Icon: Bold, labelKey: 'table.formatToolbar.bold' },
  { key: 'italic', Icon: Italic, labelKey: 'table.formatToolbar.italic' },
  { key: 'underline', Icon: Underline, labelKey: 'table.formatToolbar.underline' },
];

/** Κάθε split button χρώματος είναι **δύο** εστιάσιμα μισά, όχι ένα. */
const COLOR_SLOTS = 2;

/**
 * 🔴 Πόσες θέσεις roving καταλαμβάνει το τμήμα — **παραγόμενη**, ποτέ γραμμένη με το χέρι.
 *
 * Ο γονέας τη χρειάζεται για να ξέρει από πού αρχίζουν τα **δικά του** χειριστήρια. Γραμμένη
 * ως `10` σε εκείνον, θα ήταν σιωπηλή εξάρτηση που σπάει στην επόμενη προσθήκη εδώ — και δύο
 * ταυτόχρονες προσθήκες σε κοινό working tree θα έδιναν δύο διαφορετικούς αριθμούς για την
 * ίδια θέση.
 */
export const TABLE_AXIS_FORMAT_SLOTS = TOGGLES.length + COLOR_SLOTS * 2 + 3;

export function TableAxisFormatSection(props: TableAxisFormatSectionProps): React.ReactElement {
  const { format, onToggle, onStepSize, onReset, onSetTextColor, onSetFillColor, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  const textColorBase = TOGGLES.length;
  const fillColorBase = textColorBase + COLOR_SLOTS;
  const sizeBase = fillColorBase + COLOR_SLOTS;
  const resetIndex = sizeBase + 2;

  const hint = (state: TableToggleFormatState): string | undefined => {
    if (state.mixed) return t('table.formatToolbar.mixedHint');
    return state.explicit ? t('table.formatToolbar.explicitHint') : undefined;
  };

  return (
    <>
      {TOGGLES.map(({ key, Icon, labelKey }, index) => (
        <ToolbarButton
          key={key}
          roving={rovingOf(index)}
          title={t(labelKey)}
          hint={hint(format[key])}
          state={format[key]}
          onActivate={() => onToggle(key)}
        >
          <Icon size={15} />
        </ToolbarButton>
      ))}

      {/*
        ADR-739 Φ.Ε/Φ4 + Φ4β — τα δύο χρώματα κάθονται **αμέσως μετά τα Β/Ι/Υ**, χωρίς
        διαχωριστή: είναι η ίδια οικογένεια εντολών (μορφοποίηση του **άξονα**) και αυτή ακριβώς
        είναι η θέση τους στη σειρά 1 του Excel — και εκεί το γέμισμα κάθεται **δίπλα** στο
        χρώμα γραμματοσειράς, με το γέμισμα πρώτο. Εδώ η σειρά είναι αντίστροφη επίτηδες: το
        χρώμα κειμένου γράφτηκε πρώτο και η μνήμη χεριού του χρήστη έχει ήδη δεθεί με τη θέση
        του (§34), οπότε το νέο χειριστήριο μπαίνει **μετά** — μια μετακίνηση υπάρχοντος
        κουμπιού κοστίζει περισσότερο από μια απόκλιση διάταξης που κανείς δεν μετράει.

        Ο διαχωριστής μπαίνει **μετά** και από τα δύο, εκεί που αλλάζει η φύση της πράξης
        (μέγεθος), όχι ανάμεσα σε συγγενικές εντολές.
      */}
      <TableAxisColorMenu
        role="ink"
        rovingApply={rovingOf(textColorBase)}
        rovingMenu={rovingOf(textColorBase + 1)}
        state={format.textColor}
        onSet={onSetTextColor}
      />
      <TableAxisColorMenu
        role="fill"
        rovingApply={rovingOf(fillColorBase)}
        rovingMenu={rovingOf(fillColorBase + 1)}
        state={format.fillColor}
        onSet={onSetFillColor}
      />

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={rovingOf(sizeBase)}
        title={t('table.formatToolbar.increaseSize')}
        onActivate={() => onStepSize(1)}
      >
        <AArrowUp size={16} />
      </ToolbarButton>
      <ToolbarButton
        roving={rovingOf(sizeBase + 1)}
        title={t('table.formatToolbar.decreaseSize')}
        onActivate={() => onStepSize(-1)}
      >
        <AArrowDown size={16} />
      </ToolbarButton>

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={rovingOf(resetIndex)}
        title={t('table.formatToolbar.resetFormatting')}
        disabled={!format.canReset}
        onActivate={onReset}
      >
        <RotateCcw size={15} />
      </ToolbarButton>
    </>
  );
}
