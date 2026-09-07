'use client';

/**
 * **ΤΑ ΚΕΛΙΑ ΤΗΣ ΓΡΑΜΜΗΣ ΠΕΛΑΤΗ** — το πλέγμα, η άδεια γραμμή, το κελί επικοινωνίας.
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ** *(N.7.1)*: το `CustomerInfoCompact` απαντά *«ποια
 * κατάσταση δείχνει αυτή η κάρτα;»* — φόρτωση, σφάλμα, κενό, δεδομένα. Αυτό εδώ
 * απαντά *«πώς μοιάζει ένα κελί;»*. Οι δύο ερωτήσεις έτυχε να ζουν μαζί μέχρι που
 * ο καθαρισμός του **CHECK 3.28** έκανε το αρχείο να περάσει τις 500 γραμμές.
 *
 * ⚠️ **Δεν είναι «κόψιμο για να χωρέσει»**: αυτά τα τρία είναι **καθαρή παρουσίαση**
 * — δεν ξέρουν τι είναι πελάτης, δεν διαβάζουν hook, δεν έχουν κατάσταση. Ό,τι
 * χρειάζονται τους δίνεται ρητά, γι' αυτό και ήταν εξαγώγιμα χωρίς κόλπα.
 */

import React from 'react';
import { User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * 🔴 **ΤΟ ΠΛΕΓΜΑ ΤΗΣ ΓΡΑΜΜΗΣ — ΜΙΑ ΦΟΡΑ, ΓΙΑ ΚΑΙ ΤΙΣ ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ**
 * *(ADR-841 Α21.1)*.
 *
 * ⚠️ **ΗΤΑΝ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΠΡΟΤΥΠΑ, ΚΑΙ ΕΙΝΑΙ ΟΡΑΤΟ ΕΛΑΤΤΩΜΑ** — μετρημένο από την
 * άγκυρα που γράφτηκε για την εξαγωγή:
 *
 * | Κατάσταση | Τι είχε |
 * |---|---|
 * | δεδομένα · φόρτωση | `2fr_1fr_1.8fr_auto_auto` |
 * | **σφάλμα · «κανένας πελάτης»** | **`2fr_1.2fr_1.5fr_auto_auto`** |
 *
 * ⇒ Σε πίνακα όπου μία σειρά αποτυγχάνει να φορτώσει, **οι στήλες της μετατοπίζονται
 * σε σχέση με τις γειτονικές**. Επικράτησε το πρότυπο των **πραγματικών** γραμμών
 * *(δύο στις τρεις χρήσεις)*, γιατί σε αυτές πρέπει να ευθυγραμμίζονται οι υπόλοιπες.
 *
 * 🔑 Το ελάττωμα ήταν **αόρατο όσο το πλέγμα ήταν γραμμένο τρεις φορές**. Ο λόγος που
 * φάνηκε δεν είναι ότι κάποιος κοίταξε καλύτερα — είναι ότι **έγινε ένα**.
 */
export const TABLE_ROW_GRID =
  'grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 items-center py-3 px-1';

/** Ο **τόνος** της άδειας γραμμής — σφάλμα ή «κανένας πελάτης», ίδιο σχήμα. */
export interface EmptyRowTone {
  readonly row: string;
  readonly bubble: string;
  readonly label: string;
  readonly dash: string;
}

interface EmptyTableRowProps {
  readonly tone: EmptyRowTone;
  readonly message: string;
  readonly avatarClass: string;
  readonly textClass: string;
  readonly iconClass: string;
  readonly className?: string;
  readonly containerStyle?: React.CSSProperties;
}

/**
 * **Η ΓΡΑΜΜΗ ΠΙΝΑΚΑ ΠΟΥ ΔΕΝ ΕΧΕΙ ΠΕΛΑΤΗ — ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ** *(ADR-841 Α21.1 · N.0.2)*.
 *
 * 🔴 Η κατάσταση **σφάλματος** και η κατάσταση **«κανένας πελάτης»** ήταν **δύο
 * αντίγραφα** *(12 γραμμές / 51 tokens — το μέτρησε το CHECK 3.28)*: **ίδιο** πλέγμα
 * πέντε στηλών, **ίδια** φυσαλίδα, **ίδιες** τέσσερις παύλες. Διέφεραν μόνο στον
 * **τόνο** και στο **μήνυμα**.
 *
 * ⚠️ **Το πλέγμα ΕΙΝΑΙ ο λόγος που πρέπει να ζει σε ένα σημείο**: πρέπει να συμφωνεί
 * με τη γραμμή που δείχνει **πραγματικό** πελάτη, αλλιώς οι στήλες του πίνακα
 * **χοροπηδούν** όταν μία σειρά αποτύχει να φορτώσει. Δύο αντίγραφα σήμαιναν **δύο**
 * ευκαιρίες να ξεχαστεί η ευθυγράμμιση.
 *
 * 🔑 **Οι παύλες μένουν τέσσερις, μία ανά υπόλοιπη στήλη** — ποτέ ένα `colSpan`:
 * το πλέγμα είναι CSS grid, όχι `<table>`, και ένα κενό κελί λιγότερο **μετατοπίζει
 * όλες τις επόμενες στήλες**.
 */
export function EmptyTableRow({
  tone,
  message,
  avatarClass,
  textClass,
  iconClass,
  className,
  containerStyle,
}: EmptyTableRowProps) {
  return (
    <div className={cn(TABLE_ROW_GRID, className, tone.row)} style={containerStyle}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            avatarClass,
            tone.bubble,
            'rounded-full shrink-0 flex items-center justify-center'
          )}
        >
          <User className={iconClass} />
        </div>
        <span className={cn(textClass, tone.label, 'truncate')}>{message}</span>
      </div>
      <span className={tone.dash}>—</span>
      <span className={tone.dash}>—</span>
      <div className="flex justify-end pr-3">
        <span>—</span>
      </div>
      <span>—</span>
    </div>
  );
}

interface ContactCellProps {
  readonly icon: LucideIcon;
  readonly value: string | undefined;
  readonly textClass: string;
  readonly iconClass: string;
  readonly mutedClass: string;
}

/**
 * **«ΤΙΜΗ, Ή ΠΑΥΛΑ» — ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ** *(ADR-841 Α21.1 · N.0.2)*.
 *
 * 🔴 Το τηλέφωνο και το email της γραμμής ήταν **δύο αντίγραφα** *(10 γραμμές / 52
 * tokens — το μέτρησε το CHECK 3.28)* που διέφεραν **μόνο** στο εικονίδιο και στην
 * τιμή. Κάθε αλλαγή στην εμφάνιση της **απουσίας** έπρεπε να γίνει δύο φορές, και
 * η δεύτερη ήταν εκείνη που ξεχνιόταν.
 *
 * ⚠️ **Η παύλα ΔΕΝ είναι κείμενο προς μετάφραση** (N.11): είναι **τυπογραφικό
 * σύμβολο κενού κελιού**, το ίδιο σε κάθε γλώσσα — όπως ήταν και στα δύο αντίγραφα.
 */
export function ContactCell({ icon: Icon, value, textClass, iconClass, mutedClass }: ContactCellProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {value ? (
        <>
          <Icon className={cn(iconClass, mutedClass, 'shrink-0')} />
          <span className={cn(textClass, 'text-foreground truncate')}>{value}</span>
        </>
      ) : (
        <span className={cn(textClass, mutedClass)}>—</span>
      )}
    </div>
  );
}
