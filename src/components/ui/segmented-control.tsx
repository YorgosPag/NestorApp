'use client';

/**
 * @fileoverview **ΑΠΟΚΛΕΙΣΤΙΚΗ ΕΠΙΛΟΓΗ (ένα από Ν)** — M3 segmented button · Radix ToggleGroup `single`.
 * @related ADR-770 §19 · ui/toggle-button (εναλλαγή on/off) · design-system/color-bridge (`selectionControl`)
 * @module components/ui/segmented-control
 *
 * 🔑 **Τρία πράγματα που τα χειρόγραφα ζευγάρια κουμπιών δεν είχαν:**
 *  1. **Ορατή επιλογή στο σκοτεινό** — ο ρόλος `selectionControl.pressedOn`, όχι `variant="default"` (≡ `--card`).
 *  2. **Σημασιολογία radio + βελάκια** (roving tabindex του Radix): ο αναγνώστης οθόνης ακούει «2 από 3,
 *     επιλεγμένο», και το Tab μπαίνει στην ομάδα **μία** φορά (WAI-ARIA radio group).
 *  3. **Δεν αδειάζει ποτέ.** Το Radix `single` επιτρέπει αποεπιλογή (`''`)· μια προβολή «κάρτες | πίνακας»
 *     χωρίς προβολή δεν υπάρχει. Το `''` αγνοείται εδώ, μία φορά — όχι σε κάθε καταναλωτή (M3: «single-select
 *     segmented buttons always have one selected»).
 *  4. **Η διάταξη ακολουθεί το `orientation`** — εδώ, μία φορά (ADR-809 §9.5 · ADR-797 §Φ.Ρ.3). Το `vertical`
 *     δεν είναι μόνο βελάκια ↑/↓ (Radix): είναι **λίστα** πλήρους πλάτους, με ετικέτες στοιχισμένες αριστερά.
 *     Μετρημένο 2026-09-26: σε 3 σταθερές στήλες το «Σκοτεινό»/«Σύστημα» και το «Ελληνικά» **κόβονταν** στο
 *     συρτάρι (320–390 px). Ετικέτες άγνωστου μήκους × μεταφράσεις δεν χωρούν σε στήλες — iOS Settings,
 *     GOV.UK radios: οι προτιμήσεις είναι **λίστα**. Ο καταναλωτής δηλώνει `orientation`, **όχι** κλάσεις διάταξης.
 */

import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { Button, type ButtonVariantProps } from '@/components/ui/button';
import type { ToggleButtonRestVariant } from '@/components/ui/toggle-button';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';

export interface SegmentedControlProps<T extends string>
  extends Omit<
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
    'type' | 'value' | 'defaultValue' | 'onValueChange'
  > {
  readonly value: T;
  /** Καλείται μόνο με **μη κενή** τιμή — δες την επικεφαλίδα (#3). */
  readonly onValueChange: (value: T) => void;
  /** Όνομα της ομάδας για τον αναγνώστη οθόνης, όταν δεν υπάρχει ορατή ετικέτα. */
  readonly 'aria-label'?: string;
}

function SegmentedControlInner<T extends string>(
  { value, onValueChange, className, orientation, ...props }: SegmentedControlProps<T>,
  ref: React.ForwardedRef<React.ElementRef<typeof ToggleGroupPrimitive.Root>>,
): React.ReactElement {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      type="single"
      value={value}
      // Οι τιμές των items είναι τύπου T (βλ. `SegmentedControlItem`)· το Radix μιλά σε `string`.
      onValueChange={(next) => {
        if (next !== '') onValueChange(next as T);
      }}
      orientation={orientation}
      className={cn(
        orientation === 'vertical' ? 'flex w-full flex-col items-stretch gap-1' : 'inline-flex flex-wrap items-center gap-1',
        className,
      )}
      {...props}
    />
  );
}

export const SegmentedControl = React.forwardRef(SegmentedControlInner) as <T extends string>(
  props: SegmentedControlProps<T> & { readonly ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement;

export interface SegmentedControlItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>, 'asChild'> {
  readonly variant?: ToggleButtonRestVariant;
  readonly size?: ButtonVariantProps['size'];
}

export const SegmentedControlItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  SegmentedControlItemProps
>(({ variant = 'outline', size = 'sm', className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item ref={ref} asChild {...props}>
    <Button
      variant={variant}
      size={size}
      // Το Radix σημαδεύει κάθε item με `data-orientation` — η λίστα (#4) στοιχίζει αριστερά, όπως κάθε λίστα.
      className={cn('data-[orientation=vertical]:justify-start', className, COLOR_BRIDGE.selectionControl.pressedOn)}
    >
      {children}
    </Button>
  </ToggleGroupPrimitive.Item>
));
SegmentedControlItem.displayName = 'SegmentedControlItem';
