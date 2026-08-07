'use client';

/**
 * 🔴 ADR-755 / **ADR-739 §52 · §55** — **το διαμέρισμα μορφοποίησης**: Β/Ι/Υ, τα δύο χρώματα,
 * το μέγεθος, η επαναφορά — και τα δύο χειριστήρια που δεν έχουν ακόμη πράξη.
 *
 * ## 🔴 ΗΤΑΝ ΕΝΑ COMPONENT — ΕΙΝΑΙ ΕΞΙ ΘΡΑΥΣΜΑΤΑ (§55)
 * Μέχρι το §55 όλα τα παραπάνω αποδίδονταν σε **μία** συνεχόμενη σειρά, γιατί η γραμμή ήταν
 * μία. Η ρητή εντολή του ιδιοκτήτη «**1:1 με το Excel**» την έκανε **δύο σειρές**, και οι
 * θέσεις του Excel δεν κρατούν αυτό το τμήμα ενωμένο: το μέγεθος κάθεται στη **σειρά 1**
 * (θέσεις 3-4), τα Β/Ι κάθονται στη **σειρά 2** (θέσεις 1-2), τα χρώματα στις 4-5.
 *
 * Άρα η επιλογή ήταν: ή ένα component με prop «ποιο κομμάτι σου», ή θραύσματα. Επιλέχθηκαν τα
 * θραύσματα επειδή το **prop** θα ήταν κατάσταση που μπορεί να είναι λάθος (δύο σειρές να
 * ζητήσουν το ίδιο κομμάτι, ή καμία), ενώ ένα component που δεν κλήθηκε απλώς δεν αποδίδεται.
 * Ο **τύπος των props μένει ΕΝΑΣ** ({@link TableFormatSectionProps}) και ταξιδεύει αυτούσιος σε
 * όλα: ο ξενιστής εξακολουθεί να δίνει **ένα** αντικείμενο, όπως πριν — καμία υποδοχή δεν
 * αλλάζει υπογραφή γι' αυτή τη διάσπαση.
 *
 * ## 🔴 ΗΤΑΝ «ΜΟΡΦΟΠΟΙΗΣΗ ΑΞΟΝΑ» — ΔΕΝ ΕΙΝΑΙ ΠΙΑ (§52)
 * Εδώ έγραφε: «*δεξί κλικ σε κελιά → στόχος = ΠΕΡΙΟΧΗ → **κανένα** από τα παρακάτω δεν ισχύει
 * (ακόμη)*», και το τμήμα έλειπε ολόκληρο από την υποδοχή της περιοχής. Η πρόταση ήταν σωστή
 * για την **αιτία** που έγραφε δίπλα της: τα χειριστήρια έγραφαν `TableRow`/
 * `TableColumn.styleOverride`, και σε επιλογή κελιών **δεν υπάρχει άξονας** να γράψουν.
 *
 * Το §52 έγραψε τον γραφέα που έλειπε (`TableCell.styleOverride`) και **την επιλογή στόχου**
 * (`table-format-scope.ts`). Άρα η αιτία εξαφανίστηκε: τα ίδια χειριστήρια δείχνουν πλέον την
 * ίδια ερώτηση για **όποιον** στόχο, και η υποδοχή της περιοχής τα παίρνει αυτούσια.
 *
 * Παραμένει **προαιρετικό** στο δοχείο: η γραμμή μπορεί ακόμη να ανοίξει χωρίς στόχο (undo
 * που έσβησε τη γραμμή), και δώδεκα μονίμως γκρίζα κουμπιά θα ήταν χειρότερα από την απουσία
 * τους — «μην υπόσχεσαι ό,τι δεν κάνεις».
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableFormatSection
 * @see ui/components/table-format-toolbar/TableFormatToolbar.tsx — το δοχείο και οι δύο σειρές
 */

import React from 'react';
import {
  AArrowDown,
  AArrowUp,
  Bold,
  Italic,
  RotateCcw,
  Underline,
  WrapText,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TableAxisColorMenu } from './TableAxisColorMenu';
import { ToolbarButton, type TableToggleFormatState } from './ToolbarButton';
import type { TableAxisColorState } from './table-color-menu-selection';
import type { RovingItemProps } from './use-roving-toolbar';
import type { TextHeightStepDirection } from '../../../bim/table/table-text-height-scale';

/** Τα δίτιμα πεδία που εκθέτει το v1 του toolbar. */
export type TableToggleFormatKey = 'bold' | 'italic' | 'underline';

export interface TableFormatSnapshot {
  readonly bold: TableToggleFormatState;
  readonly italic: TableToggleFormatState;
  readonly underline: TableToggleFormatState;
  /**
   * ADR-739 Φ.Ε/Φ4 — το **χρώμα κειμένου** του στόχου (άξονα ή περιοχής, §52).
   *
   * Δεν είναι δίτιμο, άρα δεν χωρά στο {@link TableToggleFormatState}: αντί για «πατημένο /
   * ελεύθερο» απαντά «**ποιο** χρώμα». Ο τύπος ζει στο `table-color-menu-selection` μαζί με
   * την ανάγνωσή του — η κατάσταση και ο κανόνας «ποια γραμμή είναι ενεργή» είναι μία απόφαση,
   * και χωρισμένα σε δύο αρχεία θα αποκλίνουν.
   */
  readonly textColor: TableAxisColorState;
  /** ADR-739 Φ.Ε/Φ4β — το **γέμισμα**: ίδιο σχήμα, τρεις καταστάσεις αντί για δύο. */
  readonly fillColor: TableAxisColorState;
  /** Ο στόχος δηλώνει **οτιδήποτε** ρητά — αλλιώς η «Επαναφορά» δεν έχει τι να κάνει. */
  readonly canReset: boolean;
}

export interface TableFormatSectionProps {
  readonly format: TableFormatSnapshot;
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
  /** Η θέση roving του **i-οστού** χειριστηρίου **αυτού του θραύσματος**· ο γονέας ξέρει το offset. */
  readonly rovingOf: (index: number) => RovingItemProps;
}

/** Τα δύο δίτιμα της **σειράς 2** (θέσεις 1-2 του Excel). */
const ROW_TOGGLES: readonly TableToggleFormatKey[] = ['bold', 'italic'];

/** Β · Ι */
export const TABLE_FORMAT_TOGGLE_SLOTS = ROW_TOGGLES.length;
/** Κάθε split button χρώματος είναι **δύο** εστιάσιμα μισά, όχι ένα — και τα χρώματα είναι δύο. */
export const TABLE_FORMAT_COLOR_SLOTS = 4;
/** A↑ · A↓ */
export const TABLE_FORMAT_SIZE_SLOTS = 2;
/** Υ — το **τρίτο τμήμα**, μέρος 1 (δες {@link TableFormatUnderlineButton}). */
export const TABLE_FORMAT_UNDERLINE_SLOTS = 1;
/** Επαναφορά — το **τρίτο τμήμα**, μέρος 2. */
export const TABLE_FORMAT_RESET_SLOTS = 1;
/** Αναδίπλωση κειμένου (χωρίς πράξη). */
export const TABLE_FORMAT_WRAP_SLOTS = 1;
/** Πινέλο μορφοποίησης (χωρίς πράξη). */
export const TABLE_FORMAT_PAINTER_SLOTS = 1;

/**
 * Η κοινή ανάγνωση «τι λέει αυτό το κουμπί για τον εαυτό του» — μία φορά για όλα τα θραύσματα.
 */
function useToggleHint(): (state: TableToggleFormatState) => string | undefined {
  const { t } = useTranslation('dxf-viewer');
  return (state) => {
    if (state.mixed) return t('table.formatToolbar.mixedHint');
    return state.explicit ? t('table.formatToolbar.explicitHint') : undefined;
  };
}

/** Ένα δίτιμο κουμπί — Β/Ι/Υ μοιράζονται σχήμα, όχι θέση (§55). */
function ToggleButton(props: {
  readonly section: TableFormatSectionProps;
  readonly index: number;
  readonly toggleKey: TableToggleFormatKey;
  readonly Icon: typeof Bold;
  readonly labelKey: string;
}): React.ReactElement {
  const { section, index, toggleKey, Icon, labelKey } = props;
  const { t } = useTranslation('dxf-viewer');
  const hint = useToggleHint();

  return (
    <ToolbarButton
      roving={section.rovingOf(index)}
      title={t(labelKey)}
      hint={hint(section.format[toggleKey])}
      state={section.format[toggleKey]}
      onActivate={() => section.onToggle(toggleKey)}
    >
      <Icon size={15} />
    </ToolbarButton>
  );
}

/** **Σειρά 2, θέσεις 1-2** — Έντονα · Πλάγια. */
export function TableFormatToggles(props: TableFormatSectionProps): React.ReactElement {
  return (
    <>
      <ToggleButton
        section={props}
        index={0}
        toggleKey="bold"
        Icon={Bold}
        labelKey="table.formatToolbar.bold"
      />
      <ToggleButton
        section={props}
        index={1}
        toggleKey="italic"
        Icon={Italic}
        labelKey="table.formatToolbar.italic"
      />
    </>
  );
}

/**
 * **Σειρά 2, θέσεις 4-5** — Χρώμα γεμίσματος, μετά Χρώμα γραμματοσειράς.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΑΝΤΙΣΤΡΑΦΗΚΕ ΜΕ ΡΗΤΗ ΕΝΤΟΛΗ (§55) — η ιστορία μένει
 * Εδώ έγραφε: «*η σειρά είναι αντίστροφη επίτηδες: το χρώμα κειμένου γράφτηκε πρώτο και η μνήμη
 * χεριού του χρήστη έχει ήδη δεθεί με τη θέση του (§34), οπότε το νέο χειριστήριο μπαίνει
 * **μετά** — μια μετακίνηση υπάρχοντος κουμπιού κοστίζει περισσότερο από μια απόκλιση διάταξης
 * που κανείς δεν μετράει*».
 *
 * Η υπόθεση της τελευταίας πρότασης **καταρρίφθηκε**: ο ιδιοκτήτης τη μέτρησε, πάνω σε
 * στιγμιότυπο του Excel, και ζήτησε ρητά 1:1. Άρα το γέμισμα μπαίνει **πρώτο**, όπως στο Excel.
 * Το επιχείρημα της μνήμης χεριού δεν ήταν λάθος — ήταν **λιγότερο βαρύ** από την ταύτιση με το
 * εργαλείο που ο χρήστης ξέρει ήδη, και μόνο ο ιδιοκτήτης μπορούσε να ζυγίσει τα δύο.
 */
export function TableFormatColors(props: TableFormatSectionProps): React.ReactElement {
  const { format, onSetTextColor, onSetFillColor, rovingOf } = props;

  return (
    <>
      <TableAxisColorMenu
        role="fill"
        rovingApply={rovingOf(0)}
        rovingMenu={rovingOf(1)}
        state={format.fillColor}
        onSet={onSetFillColor}
      />
      <TableAxisColorMenu
        role="ink"
        rovingApply={rovingOf(2)}
        rovingMenu={rovingOf(3)}
        state={format.textColor}
        onSet={onSetTextColor}
      />
    </>
  );
}

/** **Σειρά 1, θέσεις 3-4** — Αύξηση · Μείωση μεγέθους. */
export function TableFormatSizeButtons(props: TableFormatSectionProps): React.ReactElement {
  const { onStepSize, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <>
      <ToolbarButton
        roving={rovingOf(0)}
        title={t('table.formatToolbar.increaseSize')}
        onActivate={() => onStepSize(1)}
      >
        <AArrowUp size={16} />
      </ToolbarButton>
      <ToolbarButton
        roving={rovingOf(1)}
        title={t('table.formatToolbar.decreaseSize')}
        onActivate={() => onStepSize(-1)}
      >
        <AArrowDown size={16} />
      </ToolbarButton>
    </>
  );
}

/**
 * **Σειρά 1, θέση 8** — Αναδίπλωση κειμένου. **Ανενεργή, και αυτό είναι το σωστό.**
 *
 * Το μοντέλο έχει `TableCellOverflow` με τιμή `'clip'` και μόνο: «αναδίπλωση» δεν είναι κουμπί
 * που λείπει, είναι **διάταξη πολλαπλών γραμμών** που δεν υπάρχει (ύψος γραμμής που μεγαλώνει,
 * μέτρηση ανά λέξη, σπάσιμο στο πλάτος του κελιού). Ένα κουμπί που «δουλεύει» χωρίς αυτά θα
 * έγραφε πεδίο που κανείς ζωγράφος δεν διαβάζει — δηλαδή θα υποσχόταν ό,τι δεν κάνει.
 *
 * Μένει **ορατό και εστιάσιμο** επειδή ο ιδιοκτήτης ζήτησε όψη 1:1 τώρα και λειτουργία
 * σταδιακά: η θέση 8 του Excel πρέπει να είναι η θέση 8 και εδώ, αλλιώς την επόμενη φορά που
 * θα αποκτήσει πράξη θα μετακινηθούν όλα τα διπλανά.
 */
export function TableFormatWrapButton(props: TableFormatSectionProps): React.ReactElement {
  const { rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <ToolbarButton
      roving={rovingOf(0)}
      title={t('table.formatToolbar.wrapText')}
      hint={t('table.formatToolbar.notImplementedHint')}
      disabled
      onActivate={() => undefined}
    >
      <WrapText size={15} />
    </ToolbarButton>
  );
}

/**
 * **Σειρά 2, θέση 9** — Πινέλο μορφοποίησης.
 *
 * 🔴 **ΜΕΤΑΚΟΜΙΣΕ (ADR-768 Βήμα 5) στο `TableFormatPainterButton.tsx`.** Εδώ έγραφε «*ανενεργό,
 * ίδιος κανόνας με την αναδίπλωση: δεν υπάρχει πρόχειρο μορφοποίησης πουθενά στο υποσύστημα*».
 * Η αιτία εξαφανίστηκε — οι Φ1–Φ3 έγραψαν τη μηχανή (`captureTableFormatBrush` /
 * `paintTableFormat`) και η Φ4 τη μνήμη.
 *
 * Δεν έμεινε εδώ, και ο λόγος είναι ο **τύπος των props**: κάθε θραύσμα αυτού του αρχείου
 * δείχνει *μορφοποίηση του στόχου* και μοιράζεται το ίδιο {@link TableFormatSectionProps}· το
 * πινέλο δείχνει *κατάσταση εργαλείου* και έχει **δεύτερο ξενιστή** (την κορδέλα), που δεν έχει
 * κανέναν από τους έξι χειριστές να δώσει.
 */

/**
 * 🔴 **ΤΟ ΤΡΙΤΟ ΤΜΗΜΑ, ΜΕΡΟΣ 1** — Υπογράμμιση.
 *
 * ## Η ΜΙΑ συνειδητή απόκλιση από το Excel (§55)
 * Το mini toolbar του Excel **δεν έχει** ούτε υπογράμμιση, ούτε συγχώνευση, ούτε επαναφορά. Ο
 * ΝΕΣΤΩΡ τα έχει και τα τρία, επειδή ο ιδιοκτήτης τα ζήτησε ρητά (ADR-755 / §52) και
 * **δουλεύουν**. Η επιλογή ήταν: ή να σβηστούν για χάρη του 1:1, ή να μετακινηθούν εκεί που
 * δεν χαλούν καμία θέση του Excel.
 *
 * Μετακινήθηκαν: κάθονται στο **τέλος της σειράς 2**, μετά από διαχωριστή, με τη σειρά
 * *υπογράμμιση → συγχώνευση → επαναφορά*. Έτσι οι εννιά θέσεις του Excel μένουν **ακριβώς**
 * στη σειρά τους, και η γραμμή αποκτά ένα τρίτο τμήμα που διαβάζεται ως «ό,τι έχει ο ΝΕΣΤΩΡ
 * παραπάνω». Σβήσιμο λειτουργίας που ζητήθηκε ρητά κοστίζει περισσότερο από τρία κουμπιά στο
 * τέλος μιας σειράς.
 *
 * ⚠️ Δύο θραύσματα και όχι ένα, επειδή **ανάμεσά τους** μπαίνει η συγχώνευση — που είναι
 * ξεχωριστό, προαιρετικό διαμέρισμα του δοχείου και μπορεί να λείπει.
 */
export function TableFormatUnderlineButton(props: TableFormatSectionProps): React.ReactElement {
  return (
    <ToggleButton
      section={props}
      index={0}
      toggleKey="underline"
      Icon={Underline}
      labelKey="table.formatToolbar.underline"
    />
  );
}

/**
 * 🔴 **ΤΟ ΤΡΙΤΟ ΤΜΗΜΑ, ΜΕΡΟΣ 2** — Επαναφορά μορφοποίησης· δες {@link TableFormatUnderlineButton}.
 *
 * Τελευταία θέση όλης της γραμμής, και όχι από συμμετρία: είναι η **αναιρετική** πράξη του
 * τμήματος (καθαρίζει ό,τι έγραψαν όλα τα προηγούμενα), και μια αναιρετική πράξη δίπλα στα
 * κουμπιά που αναιρεί είναι ένα λάθος κλικ μακριά από το να σβήσει τη δουλειά του χρήστη.
 */
export function TableFormatResetButton(props: TableFormatSectionProps): React.ReactElement {
  const { format, onReset, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  return (
    <ToolbarButton
      roving={rovingOf(0)}
      title={t('table.formatToolbar.resetFormatting')}
      disabled={!format.canReset}
      onActivate={onReset}
    >
      <RotateCcw size={15} />
    </ToolbarButton>
  );
}
