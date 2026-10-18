import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"
import { useBorderTokens } from "@/hooks/useBorderTokens"
import '@/lib/design-system';
import cardSectionsStyles from './card-sections.module.css';

/**
 * **Το σήμα «είμαι επιφάνεια-κάρτα»** (ADR-912 §12.18). Το φορά κάθε `Card`· το απλώνει ρητά όποια επιφάνεια ζωγραφίζει
 * κάρτα χωρίς `Card` (π.χ. ο μετρητής πληρότητας). Μόνο του δεν αλλάζει τίποτα — το διαβάζει το `CARD_SECTIONS_SCOPE`.
 */
export const CARD_SURFACE_MARKER = { 'data-card': '' } as const;

/**
 * **Μέσα σε αυτό το δοχείο οι κάρτες γίνονται ενότητες με διαχωριστικά** (Apple / Google Maps place sheet · Material 3
 * «μην εμφωλεύεις κάρτες»). Το δηλώνει ρητά η επιφάνεια που είναι ήδη επιφάνεια (φύλλο κινητού) — ποτέ η κάρτα.
 */
export const CARD_SECTIONS_SCOPE = cardSectionsStyles.scope;

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Η επιφάνεια φοριέται από το ΠΑΙΔΙ (`<section>` · `<article>` · `<li>` · `<fieldset>` …) αντί για δικό της `<div>`:
   * ένας κόμβος DOM, η σημασιολογία μένει στον καλούντα. Υπάρχει ώστε κανείς να μη χρειάζεται να ξαναγράψει με το
   * χέρι όριο/φόντο/ακτίνα μόνο και μόνο επειδή ήθελε άλλο στοιχείο (ADR-777 §8.87.10).
   */
  asChild?: boolean;
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, asChild = false, ...props }, ref) => {
  const { quick } = useBorderTokens();
  const Comp = asChild ? Slot : 'div';

  // 🔑 `overflow-clip`, ΟΧΙ `overflow-hidden` (ADR-777 §8.87.9): το `hidden` κάνει το κουτί δοχείο κύλισης, άρα ως
  //    παιδί flex το αυτόματο ελάχιστο ύψος του γίνεται 0 — σε στήλη που γεμίζει την οθόνη η κάρτα συμπιέζεται και
  //    ΚΟΒΕΙ το κείμενό της (μετρημένο στην παραγωγή: 87px ορατά από 129). Το `clip` κόβει ίδια στις γωνίες, αλλά το
  //    ελάχιστο ύψος μένει το περιεχόμενο. Το πλάτος υποχωρεί ρητά (`min-w-0`)· όποιος θέλει να υποχωρεί ΚΑΙ το ύψος
  //    (δικό του κυλιόμενο παιδί) το δηλώνει με `min-h-0`, όπως ήδη κάνουν όλοι οι τέτοιοι καταναλωτές.
  return (
    <Comp
      ref={ref}
      {...CARD_SURFACE_MARKER}
      className={cn(
        `${quick.card} bg-card text-card-foreground shadow-sm overflow-clip min-w-0`,
        className
      )}
      {...props}
    />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-2", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4';
}

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  CardTitleProps
>(({ className, as: Comp = 'h3', ...props }, ref) => (
  <Comp
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-2 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-2 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
