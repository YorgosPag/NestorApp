'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 — **ένα κουμπί του mini toolbar**.
 *
 * Εξήχθη από το `TableFormatToolbar.tsx` (ADR-755): εκείνο έφτασε **445/500** γραμμές και το
 * ADR-755 προσθέτει τρίτο διαμέρισμα. Η τομή είναι σημασιολογική, όχι μετρική — εδώ ζει «πώς
 * φαίνεται και πώς ανακοινώνεται ένα κουμπί», εκεί «ποια κουμπιά υπάρχουν και με ποια σειρά».
 * Δεύτερος καταναλωτής υπάρχει ήδη: το τμήμα μορφοποίησης άξονα (`TableFormatSection`).
 *
 * Το ανενεργό κουμπί μένει **εστιάσιμο** με `aria-disabled` αντί για `disabled`: ένα πραγματικά
 * απενεργοποιημένο κουμπί βγαίνει από τη σειρά εστίασης και ο δείκτης του roving θα «έπεφτε σε
 * τρύπα» — το APG ορίζει ρητά ότι τα χειριστήρια ενός toolbar παραμένουν προσπελάσιμα ώστε ο
 * χρήστης να μαθαίνει τι υπάρχει, ακόμη κι όταν δεν εφαρμόζεται τώρα.
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
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/ToolbarButton
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import type { RovingItemProps } from './use-roving-toolbar';
import styles from './TableFormatToolbar.module.css';

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

/**
 * 🔴 ADR-739 §55 — **ο ίδιος** trigger για κάθε πτυσσόμενο χειριστήριο που ΔΕΝ είναι split.
 *
 * Πριν από αυτό, όποιος ήθελε κουμπί-με-μενού είχε δύο επιλογές: να αντιγράψει τον σκελετό του
 * {@link ToolbarSplitButton} (μαζί με το επικίνδυνο κομμάτι του — το `ref` που γράφεται σε
 * **δύο** θέσεις ταυτόχρονα, δες την κεφαλίδα εκείνου) ή να ξαναγράψει `<button>` + tooltip +
 * σημάδι συνεδρίας. Με τρία νέα πτυσσόμενα στη σειρά (γραμματοσειρά, μέγεθος, στοίχιση) και τα
 * δύο θα ήταν sibling clones — ακριβώς το σχήμα που πιάνει η CHECK 3.28 (N.18).
 */
export interface ToolbarButtonPopup {
  readonly isOpen: boolean;
  readonly panelId: string;
  /** Τι ανοίγει: λίστα τιμών (`listbox`) ή εντολές (`menu`) — ταξιδεύει στο `aria-haspopup`. */
  readonly kind: 'listbox' | 'menu';
  /** Ο trigger του πάνελ· γράφεται **μαζί** με το roving ref, ποτέ αντ' αυτού. */
  readonly triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export interface ToolbarButtonProps {
  readonly roving: RovingItemProps;
  readonly title: string;
  readonly hint?: string;
  readonly state?: TableToggleFormatState;
  readonly disabled?: boolean;
  /** Επιπλέον κλάσεις — π.χ. το πλάτος ενός combobox που δείχνει τιμή αντί για εικονίδιο. */
  readonly className?: string;
  /** Απόν ⇒ σκέτο κουμπί εντολής. Παρόν ⇒ trigger πτυσσόμενου (δες {@link ToolbarButtonPopup}). */
  readonly popup?: ToolbarButtonPopup;
  readonly onActivate: () => void;
  readonly children: React.ReactNode;
}

export function ToolbarButton({
  roving, title, hint, state, disabled, className, popup, onActivate, children,
}: ToolbarButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          // 🔴 Και οι δύο παραλήπτες, με αυτή τη σειρά. Ξεχασμένος ο πρώτος, το `Escape` δεν
          // γυρίζει την εστίαση· ξεχασμένος ο δεύτερος, το κουμπί βγαίνει από το roving. Και
          // τα δύο συμπτώματα είναι ασυμμετρίες που καμία οπτική επιθεώρηση δεν πιάνει.
          ref={(node) => {
            if (popup) popup.triggerRef.current = node;
            roving.ref(node);
          }}
          tabIndex={roving.tabIndex}
          onKeyDown={roving.onKeyDown}
          onFocus={roving.onFocus}
          className={cn(
            styles.button,
            state?.active && !state.mixed && styles.buttonActive,
            state?.mixed && styles.buttonMixed,
            popup?.isOpen && styles.buttonActive,
            className,
          )}
          aria-label={title}
          aria-pressed={state ? (state.mixed ? 'mixed' : state.active) : undefined}
          aria-haspopup={popup?.kind}
          aria-expanded={popup ? popup.isOpen : undefined}
          aria-controls={popup?.isOpen ? popup.panelId : undefined}
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
