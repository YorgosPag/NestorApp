"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import type { ExplicitAccessibleName } from '@/lib/a11y/accessible-name'
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useDropdownTokens } from '@/hooks/useDropdownTokens'
import { componentSizes } from '@/styles/design-tokens'
// ADR-364 §10.15 — δήλωση Κ3 ιδιοκτησίας Esc. ΕΝΑ module για όλα τα Radix wrappers.
import { withRadixEscapeOwner } from '@/components/ui/radix-escape-ownership'
import '@/lib/design-system';

// ============================================================================
// ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΝΑΔΥΟΜΕΝΟΥ (ADR-598 G11 · Δ)
// ============================================================================
//
// 🔴 Το Radix δίνει σε **κάθε** `Popover.Content` `role="dialog"` — και **κανένα** όνομα.
//    Μετρήθηκε 2026-09-21: **28 από 29** χρήσεις στο `src/` ήταν ανώνυμος διάλογος (axe
//    `aria-dialog-name`): ο αναγνώστης οθόνης ανακοίνωνε «διάλογος» και τίποτε άλλο.
//
// 🔑 Τρία πρότυπα, και τα τρία εδώ:
//    1. **React Aria `DialogTrigger`** — το trigger παίρνει `id` και ο διάλογος
//       `aria-labelledby = triggerId`. Το κουμπί «Φίλτρα» ανοίγει διάλογο «Φίλτρα» χωρίς
//       ούτε μία γραμμή στον καταναλωτή. Ρητό όνομα (`aria-label` / `aria-labelledby`) κερδίζει.
//    2. **Fluent `PopoverSurface`** — `dialog` μόνο όταν είναι διάλογος. Όταν η εστίαση μένει
//       έξω (combobox: το popup είναι το **listbox**), το δοχείο είναι ουδέτερο:
//       `role="presentation"`, και τότε **ο τύπος απαγορεύει** όνομα.
//    3. **ARIA APG** — διάλογος χωρίς όνομα δεν επιτρέπεται. Όπου δεν υπάρχει trigger
//       (`PopoverAnchor`), το όνομα πρέπει να δοθεί ρητά. Αυτό το ελέγχει το
//       `__tests__/popover-naming.test.ts` σε **όλο** το `src/`.
//
// ⛔ **Τα μενού ΔΕΝ ανήκουν εδώ**: `role="menu"` υπόσχεται πλοήγηση με βελάκια (APG Menu),
//    που το Popover δεν δίνει. Για μενού → `@/components/ui/dropdown-menu`.

interface PopoverLabelling {
  /** Το `id` που **πράγματι** φέρει το trigger στο DOM · `null` = δεν υπάρχει trigger. */
  readonly triggerId: string | null;
  readonly setTriggerId: (id: string | null) => void;
}

const PopoverLabellingContext = React.createContext<PopoverLabelling | null>(null)

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [triggerId, setTriggerId] = React.useState<string | null>(null)
  const labelling = React.useMemo(() => ({ triggerId, setTriggerId }), [triggerId])
  return (
    <PopoverLabellingContext.Provider value={labelling}>
      <PopoverPrimitive.Root {...props} />
    </PopoverLabellingContext.Provider>
  )
}

/**
 * Trigger που **δηλώνει τον εαυτό του** ως όνομα του αναδυόμενου.
 *
 * ⚠️ Καταχωρείται το `id` που διαβάζεται **από το DOM**, όχι αυτό που δώσαμε: με `asChild`
 *    το Slot του Radix αφήνει το `id` του **παιδιού** να κερδίσει. Ένα `aria-labelledby` προς
 *    το δικό μας `id` θα έδειχνε σε στοιχείο που **δεν υπάρχει**, κάτι χειρότερο από την
 *    απουσία του.
 */
const PopoverTrigger = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ id, ...props }, forwardedRef) => {
  const generatedId = React.useId()
  const setTriggerId = React.useContext(PopoverLabellingContext)?.setTriggerId
  const nodeRef = React.useRef<HTMLButtonElement | null>(null)

  const ref = React.useCallback((node: HTMLButtonElement | null) => {
    nodeRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  // 🔴 Εξαρτήσεις = τα `id`: ένα effect χωρίς λίστα θα έγραφε κατάσταση του γονέα σε ΚΑΘΕ
  //    render του trigger — ο γονέας ξαναποδίδει το trigger, και ο κύκλος δεν τελειώνει.
  React.useEffect(() => {
    if (!setTriggerId) return
    setTriggerId(nodeRef.current?.id || null)
    return () => setTriggerId(null)
  }, [setTriggerId, id, generatedId])

  return <PopoverPrimitive.Trigger ref={ref} id={id ?? generatedId} {...props} />
})
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName

/**
 * Anchor-only positioning for controlled Popovers.
 * Unlike PopoverTrigger, Anchor does NOT toggle open state on click — use it
 * when the component fully owns the open/close logic (e.g. focus-driven
 * comboboxes) to avoid click-focus race conditions that flash the popover.
 * ⚠️ Anchor ≠ trigger: δεν ονομάζει το αναδυόμενο — δώσε όνομα ή `role="presentation"`.
 */
const PopoverAnchor = PopoverPrimitive.Anchor

/** Ρητό όνομα διαλόγου: **ένα** από τα δύο, ή κανένα (⇒ το όνομα του trigger). */
type PopoverDialogName =
  | ExplicitAccessibleName
  | { readonly 'aria-label'?: undefined; readonly 'aria-labelledby'?: undefined }

/** Η σημασιολογία του δοχείου: διάλογος με όνομα, ή ουδέτερος φορέας άλλου popup. */
type PopoverContentSemantics =
  | ({ readonly role?: 'dialog' } & PopoverDialogName)
  | { readonly role: 'presentation'; readonly 'aria-label'?: never; readonly 'aria-labelledby'?: never }

type PopoverContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
  'role' | 'aria-label' | 'aria-labelledby'
> & PopoverContentSemantics

/**
 * Τα ARIA γνωρίσματα ονομασίας του δοχείου — **η μία απάντηση** για κάθε `Popover.Content`.
 *
 * Εξάγεται για τα δοχεία που αποδίδουν το **ωμό** `PopoverPrimitive.Content` για δικούς τους
 * λόγους (π.χ. `multi-combobox`: χωρίς Portal), ώστε να μη γράψουν δεύτερη απάντηση.
 * Προϋπόθεση: να ζουν μέσα στο `Popover` **αυτού** του module.
 */
function usePopoverContentNaming(
  role: 'dialog' | 'presentation' = 'dialog',
  ariaLabel?: string,
  ariaLabelledBy?: string,
): {
  readonly role: 'dialog' | 'presentation'
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
} {
  const triggerId = React.useContext(PopoverLabellingContext)?.triggerId ?? null
  if (role === 'presentation') return { role }
  if (ariaLabel !== undefined || ariaLabelledBy !== undefined) {
    return { role: 'dialog', 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy }
  }
  return { role: 'dialog', 'aria-labelledby': triggerId ?? undefined }
}

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({
  className,
  align = "center",
  sideOffset = componentSizes.dropdown.content.sideOffset,
  onEscapeKeyDown,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();
  const naming = usePopoverContentNaming(role, ariaLabel, ariaLabelledBy);

  return (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        `${dropdown.content.zIndex} ${dropdown.popover.width} ${quick.table} bg-popover ${dropdown.popover.padding} text-popover-foreground ${dropdown.content.shadow} outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
        className
      )}
      {...props}
      {...naming}
      onEscapeKeyDown={withRadixEscapeOwner('ui/popover-content', onEscapeKeyDown)}
    />
  </PopoverPrimitive.Portal>
  );
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent, usePopoverContentNaming }
export type { PopoverContentProps }
