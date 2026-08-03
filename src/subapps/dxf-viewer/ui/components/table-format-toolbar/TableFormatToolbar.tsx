'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 (απόφαση Α7) — **το mini toolbar μορφοποίησης των ζωνών δείκτη**.
 *
 * Δεξί κλικ σε γράμμα στήλης ή αριθμό γραμμής ⇒ **δύο** επιφάνειες: αυτή εδώ, ξεκομμένη, και
 * από κάτω το μενού εισαγωγής/διαγραφής. Ακριβώς όπως το Excel, και όπως το ζήτησε ρητά ο
 * ιδιοκτήτης: «ξεκομμένο … πάνω από το μενού προσθήκης».
 *
 * ## 🔴 Γιατί σκέτα `<button>` και ΟΧΙ `DxfMenuItem`
 * ⚠️ **Η αιτιολόγηση άλλαξε στις 2026-08-03 — το συμπέρασμα όχι.** Έγραφε: «το `onSelect` του
 * `DxfMenuItem` καλεί `onOpenChange(false)`, άρα το πρώτο «Β» θα έκλεινε το μενού, και η
 * μορφοποίηση είναι κατεξοχήν επαναλαμβανόμενη πράξη». Ο ιδιοκτήτης ανέτρεψε ακριβώς αυτό:
 * το μενού **οφείλει** πλέον να κλείνει στο πρώτο πάτημα, όπως στο Excel.
 *
 * Τα σκέτα `<button>` παραμένουν σωστά για **άλλον** λόγο, που δεν άλλαξε: το `DxfMenuItem`
 * είναι Radix `menuitem` και δουλεύει **μόνο μέσα** στο δέντρο του `Menu.Content`. Αυτή εδώ η
 * επιφάνεια ζει σε δικό της portal (το απαιτεί η Α7), δηλαδή δεν είναι — και δεν επιτρέπεται
 * να είναι — μέρος του μενού. Το κλείσιμο το κάνει ρητά ο γονέας (`runFormat`), **μετά** την
 * εκτέλεση της πράξης.
 *
 * ## 🔴 Γιατί ζει σε portal και όχι μέσα στο `DxfMenuContent`
 * Το Radix τοποθετεί το περιεχόμενο του μενού μόνο του· ένα παιδί του δεν μπορεί να καθίσει
 * **πάνω** από αυτό με κενό ανάμεσα. Η τιμή που πληρώνεται είναι ότι το toolbar μετράει ως
 * «έξω» για το `DismissableLayer` — γι' αυτό ο γονέας κρατά το {@link TableFormatToolbarProps.
 * surfaceRef} και φυλάει το `onInteractOutside`. Χωρίς αυτόν τον φύλακα, **κάθε** πάτημα
 * κουμπιού θα έκλεινε το μενού από κάτω.
 *
 * ## 🔴 Κάθε κουμπί φέρει το σημάδι της συνεδρίας
 * Ο φύλακας `useTableCellSessionBlur` ρωτά `isTableCellSessionElement` πάνω στο **ίδιο** το
 * στοιχείο που παίρνει την εστίαση (όχι `closest`). Άρα το σημάδι δεν αρκεί στο δοχείο: κάθε
 * `<button>` το φοράει, αλλιώς η πρώτη εστίαση σε κουμπί σκοτώνει τον δρομέα του κελιού ένα
 * καρέ αργότερα — και οι ζώνες εξαφανίζονται τη στιγμή που τις χρησιμοποιείς.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableFormatToolbar
 * @see ui/components/TableHeaderContextMenu.tsx — ποιος το ανοίγει και ποιος φυλάει το «έξω»
 * @see bim/table/table-axis-style-ops.ts — οι καθαρές πράξεις πίσω από κάθε κουμπί
 */

import React, { useLayoutEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AArrowDown, AArrowUp, Bold, Italic, RotateCcw, Underline } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-739 Φ.Ε βήμα 5 — το ΕΝΑ tooltip του έργου (CHECK 3.23, μηδενική ανοχή σε νέο αρχείο).
// Εδώ έγραφε `title=` σε κάθε `<button>`· δες τη σημείωση στο {@link ToolbarButton} για το τι
// αλλάζει πραγματικά, γιατί ο native τίτλος **δεν** ήταν απλώς «άσχημος».
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { useRovingToolbar, type RovingItemProps } from './use-roving-toolbar';
import { TableBorderMenu, type TableBorderMenuProps } from './TableBorderMenu';
import { TableAxisColorMenu } from './TableAxisColorMenu';
import type { TableAxisColorState } from './table-color-menu-selection';
import styles from './TableFormatToolbar.module.css';
import type { TextHeightStepDirection } from '../../../bim/table/table-text-height-scale';

/** Τα δίτιμα πεδία που εκθέτει το v1 του toolbar. */
export type TableToggleFormatKey = 'bold' | 'italic' | 'underline';

/**
 * Η κατάσταση **ενός** δίτιμου χειριστηρίου — δύο ορθογώνιες ερωτήσεις, όχι μία.
 *
 * Το `active` λέει *τι ισχύει* στη σειρά· το `explicit` λέει *ποιος το είπε* (ο άξονας ρητά,
 * ή το στυλ του σχεδίου). Το Excel απαντά μόνο την πρώτη και γι' αυτό δεν μπορεί ποτέ να σου
 * πει αν τα έντονα που βλέπεις τα ζήτησες εσύ.
 */
export interface TableToggleFormatState {
  readonly active: boolean;
  readonly mixed: boolean;
  readonly explicit: boolean;
}

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

export interface TableFormatToolbarProps {
  /** Το σημείο του δεξιού κλικ, σε συντεταγμένες παραθύρου. Το toolbar κάθεται **από πάνω**. */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly axis: 'row' | 'column';
  /** `A` / `3` — η ίδια ονομασία με τη ζώνη και με τον τίτλο του μενού. */
  readonly label: string;
  readonly format: TableAxisFormatSnapshot;
  /** Το δοχείο, ώστε ο γονέας να αναγνωρίζει «κλικ πάνω μου» στο `onInteractOutside`. */
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
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
  /**
   * ADR-750 Φ3 — το dropdown περιγραμμάτων· **απόν ⇒ η γραμμή δεν το δείχνει καθόλου**.
   *
   * Προαιρετικό και όχι υποχρεωτικό, ώστε ο μόνος σημερινός καλών να μην αλλάξει υπογραφή: η
   * μορφοποίηση κειμένου (Β/Ι/Υ) είναι πράξη **άξονα**, τα περιγράμματα πράξη **περιοχής**.
   * Είναι δύο ορθογώνια επίπεδα που τυχαίνει να μοιράζονται γραμμή εργαλείων — όχι ένα.
   */
  readonly borders?: Omit<TableBorderMenuProps, 'roving'>;
}

/** Απόσταση από το σημείο κλικ — το «ξεκομμένο» της Α7, σε px. */
const GAP_PX = 6;
/** Ελάχιστη απόσταση από την άκρη του παραθύρου. */
const EDGE_PAD_PX = 4;
/** Κάθε split button χρώματος είναι **δύο** εστιάσιμα μισά, όχι ένα. */
const COLOR_SLOTS = 2;

const TOGGLES: readonly {
  readonly key: TableToggleFormatKey;
  readonly Icon: typeof Bold;
  readonly labelKey: string;
}[] = [
  { key: 'bold', Icon: Bold, labelKey: 'table.formatToolbar.bold' },
  { key: 'italic', Icon: Italic, labelKey: 'table.formatToolbar.italic' },
  { key: 'underline', Icon: Underline, labelKey: 'table.formatToolbar.underline' },
];

export function TableFormatToolbar(props: TableFormatToolbarProps): React.ReactElement | null {
  const {
    anchorX, anchorY, axis, label, format, surfaceRef, onToggle, onStepSize, onReset, borders,
    onSetTextColor, onSetFillColor,
  } = props;
  const { t } = useTranslation('dxf-viewer');
  /**
   * 🔴 Οι θέσεις roving **παράγονται με τη σειρά εμφάνισης**, ποτέ γραμμένες ως σταθερές.
   *
   * Το πλήθος ακολουθεί την **παρουσία** κάθε προαιρετικού χειριστηρίου: με σταθερό μέγεθος, ο
   * δείκτης θα έδειχνε σε κουμπί που δεν υπάρχει και η γραμμή θα έμενε χωρίς στάση `Tab` (δες
   * `use-roving-toolbar`).
   *
   * Και οι **δείκτες** παράγονται για τον ίδιο λόγο, ένα επίπεδο πιο πέρα: κάθε νέο χειριστήριο
   * στη μέση της γραμμής μετακινεί όλα τα επόμενα. Γραμμένοι με το χέρι (`TOGGLES.length + 3`)
   * είναι μια σιωπηλή εξάρτηση που σπάει στην **επόμενη** προσθήκη — και δύο ταυτόχρονες
   * προσθήκες σε κοινό working tree θα έδιναν δύο διαφορετικούς αριθμούς για την ίδια θέση.
   */
  const textColorBase = TOGGLES.length;
  const fillColorBase = textColorBase + COLOR_SLOTS;
  const sizeBase = fillColorBase + COLOR_SLOTS;
  const resetIndex = sizeBase + 2;
  const bordersIndex = resetIndex + 1;
  const roving = useRovingToolbar(bordersIndex + (borders ? 1 : 0));

  useToolbarPlacement(surfaceRef, anchorX, anchorY);
  useAriaHiddenGuard(surfaceRef);

  if (typeof document === 'undefined') return null;

  const hint = (state: TableToggleFormatState): string | undefined => {
    if (state.mixed) return t('table.formatToolbar.mixedHint');
    return state.explicit ? t('table.formatToolbar.explicitHint') : undefined;
  };

  return createPortal(
    // 🔴 Δικός του `TooltipProvider`, όχι εξάρτηση από τον περιβάλλοντα.
    //
    // Το React **διατηρεί** το context μέσα από portal, οπότε τεχνικά ένας provider ψηλότερα
    // θα δούλευε. Δεν υπάρχει όμως τέτοιος: το μόνο άλλο σημείο του DXF viewer με tooltip
    // (`canvas-v2/overlays/RulerCornerBox.tsx`) στήνει κι εκείνο τον δικό του — δηλαδή το
    // μοτίβο του subapp είναι «τοπικός provider», όχι καθολικός. Χωρίς αυτόν, το Radix πετά
    // σφάλμα την πρώτη φορά που θα σταθεί ο δείκτης σε κουμπί.
    //
    // Η καθυστέρηση είναι σκόπιμα **μικρή**: η γραμμή είναι ήδη ανοιχτή επειδή ο χρήστης
    // έκανε δεξί κλικ, δηλαδή ψάχνει ενεργά — δεν είναι διακριτική βοήθεια σε ένα εικονίδιο
    // που προσπερνάς κατά λάθος.
    <TooltipProvider delayDuration={300}>
    <div
      ref={surfaceRef}
      role="toolbar"
      aria-orientation="horizontal"
      aria-label={t(
        axis === 'column' ? 'table.formatToolbar.columnLabel' : 'table.formatToolbar.rowLabel',
        { label },
      )}
      className={cn(
        styles.toolbar,
        'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
      )}
      {...TABLE_CELL_SESSION_MARKER}
    >
      {TOGGLES.map(({ key, Icon, labelKey }, index) => (
        <ToolbarButton
          key={key}
          roving={roving.itemProps(index)}
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
        rovingApply={roving.itemProps(textColorBase)}
        rovingMenu={roving.itemProps(textColorBase + 1)}
        state={format.textColor}
        onSet={onSetTextColor}
      />
      <TableAxisColorMenu
        role="fill"
        rovingApply={roving.itemProps(fillColorBase)}
        rovingMenu={roving.itemProps(fillColorBase + 1)}
        state={format.fillColor}
        onSet={onSetFillColor}
      />

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={roving.itemProps(sizeBase)}
        title={t('table.formatToolbar.increaseSize')}
        onActivate={() => onStepSize(1)}
      >
        <AArrowUp size={16} />
      </ToolbarButton>
      <ToolbarButton
        roving={roving.itemProps(sizeBase + 1)}
        title={t('table.formatToolbar.decreaseSize')}
        onActivate={() => onStepSize(-1)}
      >
        <AArrowDown size={16} />
      </ToolbarButton>

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={roving.itemProps(resetIndex)}
        title={t('table.formatToolbar.resetFormatting')}
        disabled={!format.canReset}
        onActivate={onReset}
      >
        <RotateCcw size={15} />
      </ToolbarButton>

      {/*
        ADR-750 Φ3 — τα περιγράμματα σε **δικό τους** διαμέρισμα, μετά τη μορφοποίηση κειμένου.
        Ο διαχωριστής δεν είναι διακόσμηση: σηματοδοτεί ότι από εδώ και πέρα η πράξη αφορά την
        **περιοχή**, όχι τον άξονα — η ίδια διάκριση που κάνει και η Α19 στις δύο «Επαναφορές».
      */}
      {borders ? (
        <>
          <span className={styles.separator} aria-hidden="true" />
          <TableBorderMenu roving={roving.itemProps(bordersIndex)} {...borders} />
        </>
      ) : null}
    </div>
    </TooltipProvider>,
    document.body,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  readonly roving: RovingItemProps;
  readonly title: string;
  readonly hint?: string;
  readonly state?: TableToggleFormatState;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly children: React.ReactNode;
}

/**
 * Ένα κουμπί της γραμμής.
 *
 * Το ανενεργό κουμπί μένει **εστιάσιμο** με `aria-disabled` αντί για `disabled`: ένα
 * πραγματικά απενεργοποιημένο κουμπί βγαίνει από τη σειρά εστίασης και ο δείκτης του roving
 * θα «έπεφτε σε τρύπα» — το APG ορίζει ρητά ότι τα χειριστήρια ενός toolbar παραμένουν
 * προσπελάσιμα ώστε ο χρήστης να μαθαίνει τι υπάρχει, ακόμη κι όταν δεν εφαρμόζεται τώρα.
 *
 * ## 🔴 Γιατί το `title=` δεν ήταν απλώς «μη κεντρικοποιημένο»
 * Ο native τίτλος δεν εμφανίζεται **ποτέ** σε πλοήγηση με πληκτρολόγιο — μόνο σε hover
 * ποντικιού. Σε ένα toolbar με roving tabindex, όπου η ρητή προδιαγραφή είναι ότι ο χρήστης
 * περιηγείται με τα βέλη, αυτό σημαίνει ότι το `hint` («ανάμεικτο» / «ρητό στον άξονα») ήταν
 * **αόρατο ακριβώς σε όποιον το χρειάζεται**. Το Radix tooltip ανοίγει και στο `focus`.
 * Δηλαδή η CHECK 3.23 δεν έπιασε στιλιστικό θέμα· έπιασε **κενό προσβασιμότητας**.
 *
 * ## Γιατί το `aria-label` μένει και ΔΕΝ γίνεται `aria-describedby`
 * Το κουμπί έχει μόνο εικονίδιο: χωρίς `aria-label` δεν έχει **όνομα**. Το tooltip δίνει
 * περιγραφή, όχι όνομα — και το Radix το συνδέει μόνο του. Το όνομα μένει σκέτο (`title`)
 * ακόμη κι όταν υπάρχει `hint`: το «Έντονα» δεν πρέπει να διαβάζεται «Έντονα — ανάμεικτο»
 * κάθε φορά που περνά ο δρομέας του αναγνώστη.
 */
function ToolbarButton({
  roving, title, hint, state, disabled, onActivate, children,
}: ToolbarButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          ref={roving.ref}
          tabIndex={roving.tabIndex}
          onKeyDown={roving.onKeyDown}
          onFocus={roving.onFocus}
          className={cn(
            styles.button,
            state?.active && !state.mixed && styles.buttonActive,
            state?.mixed && styles.buttonMixed,
          )}
          aria-label={title}
          aria-pressed={state ? (state.mixed ? 'mixed' : state.active) : undefined}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onActivate();
          }}
          {...TABLE_CELL_SESSION_MARKER}
        >
          {children}
          {state?.explicit ? <span className={styles.explicitDot} aria-hidden="true" /> : null}
        </button>
      </TooltipTrigger>
      {/*
        🔴 Το σημάδι της συνεδρίας ταξιδεύει ΚΑΙ εδώ, για τον ίδιο λόγο με τα κουμπιά: το
        περιεχόμενο ζει σε **δικό του** portal στο `body`, δηλαδή για τον φύλακα του §26.15
        είναι «κάποιο ξένο στοιχείο». Το tooltip δεν παίρνει εστίαση, οπότε σήμερα δεν
        μπορεί να σκοτώσει τη συνεδρία — αλλά το σημάδι κοστίζει μηδέν και κλείνει την
        κατηγορία, αντί να στηρίζεται σε λεπτομέρεια υλοποίησης του Radix.
      */}
      <TooltipContent side="top" {...TABLE_CELL_SESSION_MARKER}>
        {hint ? `${title} — ${hint}` : title}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Τοποθετεί τη γραμμή **πάνω** από το σημείο κλικ, πριν το βάψιμο.
 *
 * Το ύψος δεν είναι σταθερά σε δύο αρχεία: μετριέται από το ίδιο το στοιχείο. Ένα
 * `TOOLBAR_HEIGHT_PX` σε TypeScript δίπλα σε ένα `padding` στο CSS είναι δύο πηγές για την
 * ίδια απόφαση, και αποκλίνουν στην πρώτη αλλαγή εικονιδίου.
 *
 * Το κόψιμο στο `EDGE_PAD_PX` είναι ασφαλές **επειδή** το toolbar κάθεται από πάνω: ακόμη κι
 * όταν σπρωχτεί στην κορυφή της οθόνης, μένει πάνω από το σημείο κλικ, άρα δεν σκεπάζει ποτέ
 * το μενού που ανοίγει από κάτω.
 */
function useToolbarPlacement(
  surfaceRef: RefObject<HTMLDivElement | null>,
  anchorX: number,
  anchorY: number,
): void {
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const { height, width } = el.getBoundingClientRect();
    const maxLeft = Math.max(EDGE_PAD_PX, window.innerWidth - width - EDGE_PAD_PX);
    el.style.left = `${Math.min(Math.max(EDGE_PAD_PX, anchorX), maxLeft)}px`;
    el.style.top = `${Math.max(EDGE_PAD_PX, anchorY - GAP_PX - height)}px`;
  }, [surfaceRef, anchorX, anchorY]);
}

/**
 * Κρατά τη γραμμή **έξω** από το `aria-hidden` που απλώνει το modal μενού — και **μετά**.
 *
 * ## 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (ζωντανή μέτρηση 2026-08-03)
 * Εδώ υπήρχε σκέτο `el.removeAttribute('aria-hidden')` μέσα στο `useLayoutEffect` της θέσης.
 * Ήταν **νεκρή εγγραφή**: μετρήθηκε στον browser `aria-hidden="true"` σε **κάθε** άνοιγμα.
 *
 * Η αιτία είναι **σειρά**, όχι λογική. Το `hideOthers()` (πακέτο `aria-hidden`, το καλεί το
 * modal `DropdownMenu`) διατρέχει τα παιδιά του `body` **τη στιγμή που τρέχει το δικό του
 * effect** — και το περιεχόμενο του Radix mount-άρει **μετά** από αυτό εδώ το portal. Δηλαδή
 * η σειρά ήταν πάντα: αφαιρώ → με προσπερνά → μου το ξαναγράφει. Ένα `removeAttribute` που
 * τρέχει **πριν** από τον γραφέα δεν μπορεί να νικήσει ποτέ, όσο σωστό κι αν είναι.
 *
 * Ο παρατηρητής δεν εξαρτάται από σειρά mount: όποτε κι αν γραφτεί το attribute, φεύγει.
 * Δεν βρόχεται — το `removeAttribute` γεννά νέα μεταβολή, αλλά τότε το `hasAttribute` είναι
 * ήδη ψευδές και ο φύλακας δεν ξαναγράφει.
 *
 * ## Γιατί ΟΧΙ οι δύο «προφανείς» εναλλακτικές
 * · `modal={false}` στο μενού — ξεκλειδώνει και τα outside pointer events, αλλάζοντας
 *   συμπεριφορά που δεν ζήτησε κανείς (και θα έσπαγε τον φύλακα `keepOpenOnToolbar`).
 * · `aria-live` στο δοχείο — είναι το **επίσημο** escape hatch της `hideOthers()` (εξαιρεί
 *   ρητά `[aria-live], script`), αλλά θα δήλωνε τη γραμμή ως live region: ο αναγνώστης θα
 *   ανακοίνωνε **ολόκληρη** τη γραμμή σε κάθε αλλαγή `aria-pressed`. Θεραπεία χειρότερη από
 *   την ασθένεια — δανειζόμαστε σημασιολογία που δεν ισχύει, για να πετύχουμε παρενέργεια.
 *
 * ⚠️ Αυτό επαναφέρει τον **αναγνώστη οθόνης** (browse mode), όχι την **εστίαση**: όσο το
 * μενού είναι modal, το `FocusScope` του Radix επαναφέρει κάθε εστίαση πίσω στο `role="menu"`,
 * άρα τα βέλη του {@link useRovingToolbar} δεν είναι προσπελάσιμα με πληκτρολόγιο. Μετρημένο
 * ζωντανά (και με `Tab`, και με άμεσο `focus()`) — δες ADR-739 §28.12.
 */
function useAriaHiddenGuard(surfaceRef: RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    const strip = (): void => {
      if (el.hasAttribute('aria-hidden')) el.removeAttribute('aria-hidden');
    };

    strip();
    const observer = new MutationObserver(strip);
    observer.observe(el, { attributes: true, attributeFilter: ['aria-hidden'] });
    return () => { observer.disconnect(); };
  }, [surfaceRef]);
}
