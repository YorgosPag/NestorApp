'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 (απόφαση Α7) — **το mini toolbar μορφοποίησης των ζωνών δείκτη**.
 *
 * Δεξί κλικ σε γράμμα στήλης ή αριθμό γραμμής ⇒ **δύο** επιφάνειες: αυτή εδώ, ξεκομμένη, και
 * από κάτω το μενού εισαγωγής/διαγραφής. Ακριβώς όπως το Excel, και όπως το ζήτησε ρητά ο
 * ιδιοκτήτης: «ξεκομμένο … πάνω από το μενού προσθήκης».
 *
 * ## 🔴 Γιατί σκέτα `<button>` και ΟΧΙ `DxfMenuItem` (ρίσκο 1 του §28.7)
 * Το `DxfMenuItem` είναι Radix `menuitem`: το `onSelect` του καλεί `onOpenChange(false)`.
 * Δηλαδή **το πρώτο πάτημα στο «Β» θα έκλεινε το μενού** — και η μορφοποίηση είναι κατεξοχήν
 * επαναλαμβανόμενη πράξη (έντονα, μετά πλάγια, μετά ένα μέγεθος πάνω). Εδώ τα κουμπιά είναι
 * σκέτα `<button>` μέσα σε `role="toolbar"` με δικό του roving tabindex.
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
}

/** Απόσταση από το σημείο κλικ — το «ξεκομμένο» της Α7, σε px. */
const GAP_PX = 6;
/** Ελάχιστη απόσταση από την άκρη του παραθύρου. */
const EDGE_PAD_PX = 4;

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
  const { anchorX, anchorY, axis, label, format, surfaceRef, onToggle, onStepSize, onReset } = props;
  const { t } = useTranslation('dxf-viewer');
  const roving = useRovingToolbar(TOGGLES.length + 3);

  useToolbarPlacement(surfaceRef, anchorX, anchorY);

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

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={roving.itemProps(TOGGLES.length)}
        title={t('table.formatToolbar.increaseSize')}
        onActivate={() => onStepSize(1)}
      >
        <AArrowUp size={16} />
      </ToolbarButton>
      <ToolbarButton
        roving={roving.itemProps(TOGGLES.length + 1)}
        title={t('table.formatToolbar.decreaseSize')}
        onActivate={() => onStepSize(-1)}
      >
        <AArrowDown size={16} />
      </ToolbarButton>

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        roving={roving.itemProps(TOGGLES.length + 2)}
        title={t('table.formatToolbar.resetToStyle')}
        disabled={!format.canReset}
        onActivate={onReset}
      >
        <RotateCcw size={15} />
      </ToolbarButton>
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

    /**
     * 🔴 Το δεύτερο μισό του ίδιου προβλήματος με το `pointer-events` του CSS.
     *
     * Το modal Radix menu καλεί `hideOthers()` και σημαδεύει `aria-hidden="true"` **κάθε**
     * sibling του `body` εκτός του δικού του δέντρου — δηλαδή και αυτό εδώ. Το CSS επανέφερε
     * το **ποντίκι**· αυτό επαναφέρει τον **αναγνώστη οθόνης**, αλλιώς η γραμμή εργαλείων
     * δουλεύει για όλους εκτός από όποιον τη χρειάζεται περισσότερο.
     *
     * Γίνεται εδώ και όχι με `modal={false}` στο μενού: εκείνο θα ξεκλείδωνε και τα outside
     * pointer events, αλλάζοντας συμπεριφορά που δεν ζήτησε κανείς.
     */
    el.removeAttribute('aria-hidden');
  }, [surfaceRef, anchorX, anchorY]);
}
