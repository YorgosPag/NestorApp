/**
 * =============================================================================
 * 🔐 AUTH FIELD — ΤΟ ΠΕΔΙΟ ΤΩΝ ΟΘΟΝΩΝ ΣΥΝΔΕΣΗΣ (SSoT)
 * =============================================================================
 *
 * Το ίδιο πλέγμα «`fieldset` → `label` → δοχείο → εικονίδιο αριστερά → πεδίο»
 * ήταν γραμμένο **οκτώ φορές** σε τρία αρχεία (`AuthForm` ×5 · `AuthActionContent`
 * ×2 · `MfaVerificationForm` ×1). Το CHECK 3.28 το ανέφερε μόλις η ADR-744 §18
 * έκανε τα αντίγραφα **token-ταυτόσημα** — μέχρι τότε διέφεραν μόνο στο
 * `state.t(...)` έναντι `t(...)`, δηλαδή ο ανιχνευτής ήταν τυφλός σε δίδυμο που
 * υπήρχε **από πριν**.
 *
 * 🔑 **ΠΕΡΙΤΥΛΙΓΜΑ, ΟΧΙ ΠΡΟΩΘΗΣΗ PROPS — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΚΙΝΔΥΝΟΥ.** Τα οκτώ
 * πεδία δίνουν στο `<Input>` **διαφορετικά** props (`type` · `placeholder` ·
 * `maxLength` · `inputMode` · `pattern` · `autoComplete` · `autoFocus` · `minLength`).
 * Ένα component που τα **προωθούσε** θα απαιτούσε να ξαναγραφτεί σωστά η υπογραφή
 * και των οκτώ κλήσεων — σε **δημόσια οθόνη σύνδεσης**, χωρίς διαθέσιμο έλεγχο
 * τύπων (N.17). Το περιτύλιγμα αφαιρεί **μόνο** το κοινό πλέγμα και αφήνει το
 * `<Input>` **ανέγγιχτο** στο σημείο κλήσης: μηδέν επιφάνεια παλινδρόμησης.
 *
 * ⚠️ Το `children` ζει **μέσα** στο δοχείο, **μετά** το εικονίδιο — εκεί μπαίνει και
 * το κουμπί εμφάνισης κωδικού, που υπάρχει σε μερικά μόνο πεδία.
 * ⚠️ Το `<Input>` χρειάζεται ακόμη `id` **και** `hasLeftIcon`: το πρώτο δένει με το
 * `htmlFor` (προσβασιμότητα), το δεύτερο αφήνει χώρο στο εικονίδιο.
 *
 * @module auth/components/AuthField
 */

'use client';

import '@/lib/design-system';
import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface AuthFieldProps {
  /** Δένει την ετικέτα με το πεδίο — το ίδιο `id` πρέπει να δοθεί και στο `<Input>`. */
  readonly id: string;
  /** Ήδη μεταφρασμένο κείμενο ετικέτας. */
  readonly label: string;
  /** Το εικονίδιο αριστερά μέσα στο πεδίο. */
  readonly icon: LucideIcon;
  /** Το `<Input>` και ό,τι άλλο κάθεται μέσα στο δοχείο (π.χ. κουμπί εμφάνισης). */
  readonly children: React.ReactNode;
  /**
   * Βοηθητικό κείμενο **κάτω** από το δοχείο, όχι μέσα του.
   *
   * ⚠️ Υπάρχει ως ξεχωριστή υποδοχή επίτηδες: το πεδίο κωδικού MFA το έχει, και αν
   * περνούσε ως `children` θα ζωγραφιζόταν **μέσα** στο δοχείο του πεδίου — οπτική
   * παλινδρόμηση που καμία πύλη δεν θα έπιανε.
   */
  readonly hint?: React.ReactNode;
}

export function AuthField({ id, label, icon: Icon, children, hint }: AuthFieldProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();

  return (
    <fieldset className={layout.flexColGap2}>
      <label htmlFor={id} className={typography.label.sm}>
        {label}
      </label>
      <div className={layout.inputContainer}>
        <Icon className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
        {children}
      </div>
      {hint !== undefined && (
        <p className={`${typography.body.sm} ${colors.text.muted}`}>{hint}</p>
      )}
    </fieldset>
  );
}
