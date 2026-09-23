/**
 * @fileoverview **ΚΟΥΜΠΙ ΜΕ ΠΑΤΗΜΕΝΗ ΚΑΤΑΣΤΑΣΗ** — το πρότυπο Fluent 2 `ToggleButton` (checked).
 * @related ADR-770 §17 (ρόλος `--control-*`) · §19 (αυτό το primitive) · ui/segmented-control
 * @module components/ui/toggle-button
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Η κατάσταση «πατημένο» γραφόταν ως `variant={x ? 'default' : 'outline'}` σε 111
 * σημεία. Στο σκοτεινό θέμα `bg-primary` ≡ `bg-secondary` ≡ `--card` (1,00:1): το πατημένο **χανόταν** και το
 * μη πατημένο (`bg-background`) έμοιαζε επιλεγμένο. Μετρήθηκε σε ζωντανή σελίδα (ADR-777 §8.72.8 #2).
 *
 * 🔑 **Η επιλογή δεν είναι παραλλαγή κουμπιού — είναι ΚΑΤΑΣΤΑΣΗ.** Το `variant` λέει μόνο πώς φαίνεται το
 * **μη** πατημένο· το πατημένο το ντύνει **ένας** ρόλος (`COLOR_BRIDGE.selectionControl.pressed`), και η
 * προσβασιμότητα βγαίνει από την ίδια πηγή (`aria-pressed` ή `aria-selected`) — δεν ξεχνιέται ποτέ.
 *
 * ⚠️ Για **αποκλειστική** επιλογή (ένα από Ν) χρησιμοποίησε το `SegmentedControl`: βελάκια + radio σημασιολογία.
 * Η πύλη Ο5ε (`theme-token-hygiene.test.js`) αρνείται νέο `variant={συνθήκη ? … : …}`.
 */

import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';

/** Η μη πατημένη όψη. Το `default` λείπει επίτηδες: είναι επιφάνεια στο σκοτεινό (ADR-770 §18.7 #1). */
export type ToggleButtonRestVariant = 'outline' | 'ghost' | 'secondary';

/** Ποιο χαρακτηριστικό ARIA φέρει την κατάσταση — **ένα**, ανάλογα με τον ρόλο (WAI-ARIA 1.2). */
const STATE_ATTRIBUTE = {
  pressed: 'aria-pressed',
  selected: 'aria-selected',
  checked: 'aria-checked',
} as const;

export interface ToggleButtonProps
  extends Omit<ButtonProps, 'variant' | 'aria-pressed' | 'aria-selected' | 'aria-checked'> {
  /** Η κατάσταση. Υποχρεωτική: ένα κουμπί εναλλαγής χωρίς κατάσταση δεν υπάρχει. */
  readonly pressed: boolean;
  readonly variant?: ToggleButtonRestVariant;
  /**
   * `pressed` ⇒ `aria-pressed` (εναλλαγή). `selected` ⇒ `aria-selected` (`role="tab"`/`"option"`). `checked` ⇒
   * `aria-checked` (`role="radio"`). Το WAI-ARIA **απαγορεύει** το `aria-pressed` σε αυτούς τους ρόλους — γι' αυτό
   * τα τρία χαρακτηριστικά λείπουν από τα props: ο καταναλωτής δεν μπορεί να γράψει δεύτερο.
   */
  readonly semantics?: keyof typeof STATE_ATTRIBUTE;
}

export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ pressed, variant = 'outline', semantics = 'pressed', className, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      data-state={pressed ? 'on' : 'off'}
      {...{ [STATE_ATTRIBUTE[semantics]]: pressed }}
      className={cn(className, pressed && COLOR_BRIDGE.selectionControl.pressed)}
      {...props}
    />
  ),
);
ToggleButton.displayName = 'ToggleButton';
