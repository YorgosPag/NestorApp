import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'
import { COLOR_BRIDGE, SOLID_FILL_INK, type SolidFillKey } from '@/design-system/color-bridge'
import '@/lib/design-system';

type SolidPalette = Pick<typeof COLOR_BRIDGE, 'bg' | 'text'>;

/**
 * 🔑 Συμπαγές σήμα = γέμισμα **+ το ΜΕΤΡΗΜΕΝΟ μελάνι του** (`SOLID_FILL_INK`, ADR-854 §3 · ADR-915 §11.4).
 * ⛔ ΟΧΙ `text-white` παντού: success 2,30:1 (φωτεινό) · warning 3,16:1 — μετρημένο σε browser 2026-10-15.
 */
const solidClasses = (palette: SolidPalette, fill: SolidFillKey): string =>
  `border-transparent ${palette.bg[fill]} ${palette.text[SOLID_FILL_INK[fill]]}`;

// 🏢 ENTERPRISE: Dynamic badge variants using centralized border tokens and semantic colors
// ✅ CENTRALIZED: Single source of truth for ALL badges (Grid view + List view)
const createBadgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors: ReturnType<typeof useSemanticColors>) => cva(
  // `whitespace-nowrap` (ADR-912 §4): σε στενό κελί το κείμενο αναδιπλωνόταν ΜΕΣΑ στο χάπι και το
  // `rounded-full` το έκανε κύκλο («Ειδική / στάθμη»). Το σηματάκι είναι μία λέξη-ετικέτα, όχι πρόζα.
  `inline-flex items-center whitespace-nowrap ${borderTokens.radiusClass.full} border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`,
  {
    variants: {
      variant: {
        default:
          `border-transparent ${colors.bg.primary} ${colors.text.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:opacity-90'}`,
        secondary:
          `border-transparent ${colors.bg.secondary} ${colors.text.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        // ✅ ADR-365 follow-up: SOLID vivid status badges (filled bg + white text)
        destructive:
          `${solidClasses(colors, 'errorSolid')} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:opacity-90'}`,
        outline: "text-foreground",
        success:
          `${solidClasses(colors, 'successSolid')} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER || 'hover:opacity-90'}`,
        warning:
          `${solidClasses(colors, 'warningSolid')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        info:
          `${solidClasses(colors, 'infoSolid')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:opacity-90'}`,
        error:
          `${solidClasses(colors, 'errorSolid')} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:opacity-90'}`,
        purple:
          `${solidClasses(colors, 'purpleSolid')} ${INTERACTIVE_PATTERNS.ACCENT_HOVER || 'hover:opacity-90'}`,
        light:
          `border-transparent ${colors.bg.muted} ${colors.text.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        muted:
          `border-transparent ${colors.bg.muted} ${colors.text.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        subtle:
          `border-transparent ${colors.bg.muted} ${colors.text.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 🏢 ENTERPRISE: Badge variant type definition
export type BadgeVariantProps = {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error' | 'purple' | 'light' | 'muted' | 'subtle';
}

/**
 * ⚠️ **ΤΟ ΣΗΜΑΤΑΚΙ ΕΙΝΑΙ `<span>`, ΟΧΙ `<div>` — ΚΑΙ ΕΙΝΑΙ ΚΑΝΟΝΑΣ, ΟΧΙ ΓΟΥΣΤΟ** (ADR-867 Β9)
 *
 * Ένα `<div>` μέσα σε `<p>` είναι **άκυρη HTML**: ο parser του browser κλείνει το `<p>`
 * **πριν** από το div, δηλαδή παράγει **άλλο δέντρο** από αυτό που έστειλε ο server ⇒
 * `hydration error` και **ξαναχτίσιμο ολόκληρου του υποδέντρου** από τον React.
 * Η αστοχία είναι **σιωπηλή στην οθόνη**: το σηματάκι φαίνεται μια χαρά.
 *
 * Μετρημένο 2026-09-20: **2** σημεία του `src/` έβαζαν `<Badge>` μέσα σε `<p>`
 * (`AudienceRosterPanel` · `PropertyCustomerTab`). Το πρώτο ΕΣΠΑΣΕ σε ζωντανό browser
 * στο `/offers/[offerId]`· το δεύτερο απλώς δεν το είχε ανοίξει κανείς.
 * Η διόρθωση ζει **εδώ** ώστε να μη ρωτηθεί ποτέ ξανά σε 364 σημεία χρήσης.
 *
 * Το `inline-flex` της βάσης ισχύει αυτούσιο σε `<span>` ⇒ **καμία οπτική αλλαγή**.
 * Ίδια απόφαση με το shadcn/ui upstream, για τον ίδιο λόγο.
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeVariantProps {}

function Badge({ className, variant, ...props }: BadgeProps) {
  // 🏢 ENTERPRISE: Use centralized tokens
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const badgeVariants = createBadgeVariants(borderTokens, colors);

  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// 🏢 ENTERPRISE: Static badge variants for use outside of React components
// Uses CSS variables for theme-aware styling (same as dynamic variants)
const staticBadgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-background text-foreground hover:opacity-90",
        secondary: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        // ✅ ADR-365 follow-up: SOLID vivid status badges (--status-* fill + το μετρημένο μελάνι, ADR-915 §11.4)
        destructive: `${solidClasses(COLOR_BRIDGE, 'errorSolid')} hover:opacity-90`,
        outline: "text-foreground",
        success: `${solidClasses(COLOR_BRIDGE, 'successSolid')} hover:opacity-90`,
        warning: `${solidClasses(COLOR_BRIDGE, 'warningSolid')} hover:opacity-90`,
        info: `${solidClasses(COLOR_BRIDGE, 'infoSolid')} hover:opacity-90`,
        error: `${solidClasses(COLOR_BRIDGE, 'errorSolid')} hover:opacity-90`,
        purple: `${solidClasses(COLOR_BRIDGE, 'purpleSolid')} hover:opacity-90`,
        light: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        muted: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        subtle: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
      },
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ✅ ENTERPRISE: Exported static badgeVariants for backward compatibility
const badgeVariants = staticBadgeVariants;

export { Badge, badgeVariants, createBadgeVariants, staticBadgeVariants }
