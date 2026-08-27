'use client';

/**
 * =============================================================================
 * 🔘 ToolbarIconButton — ΤΟ ΕΝΑ ΚΟΥΜΠΙ ΤΗΣ ΓΡΑΜΜΗΣ ΕΡΓΑΛΕΙΩΝ
 * =============================================================================
 *
 * ## Γιατί υπάρχει (ADR-823 §14.5)
 *
 * Το `CompactToolbarActions.tsx` περιείχε **δεκατρία** αντίγραφα του **ίδιου**
 * δεκάγραμμου μπλοκ `Tooltip → TooltipTrigger → Button → Icon`, που διέφεραν
 * **μόνο** σε: εικονίδιο · κλειδί χρώματος · χειριστή κλικ · συνθήκη
 * απενεργοποίησης · εφεδρική ετικέτα.
 *
 * **Μετρημένο με `jscpd` (CHECK 3.28, ADR-583)**: **13 ακριβείς κλώνοι, 117
 * διπλότυπες γραμμές, 29,5% του αρχείου.**
 *
 * ⚠️ **Ήταν προϋπάρχον**, όχι εισαγόμενο: το ίδιο εργαλείο μέτρησε **13 κλώνους
 * ΠΡΙΝ και 13 ΜΕΤΑ** την αλλαγή του §14 στο ίδιο αρχείο. Η πύλη το ανέδειξε όταν
 * το αρχείο σταδιοποιήθηκε — και **διορθώθηκε αντί να παρακαμφθεί** (N.0.2).
 *
 * ## Η μία λεπτομέρεια που κρατά τη συμπεριφορά ΤΑΥΤΟΣΗΜΗ
 *
 * Επτά από τα δεκατρία κουμπιά **δεν** περνούσαν καθόλου `disabled`, και το
 * εικονίδιό τους δεν είχε κλάδο «μουτζουρωμένο». Εδώ το `disabled` έχει
 * προεπιλογή `false`:
 *
 *  • `disabled={false}` στο React **δεν** παράγει χαρακτηριστικό στο DOM ⇒ ίδιο HTML·
 *  • `false ? colors.text.muted : getIconColor(k)` ⇒ **πάντα** `getIconColor(k)` ⇒ ίδια κλάση.
 *
 * Δηλαδή η ενοποίηση είναι **σημασιολογικά ουδέτερη**, όχι «περίπου ίδια».
 *
 * ⛔ **ΜΗΝ το χρησιμοποιήσεις για τα δύο dropdown** (φίλτρα · ταξινόμηση): εκεί
 * παρεμβάλλεται `DropdownMenuTrigger asChild` ανάμεσα στο `TooltipTrigger` και
 * στο `Button`, και τα φίλτρα κουβαλούν και σήμα πλήθους. Είναι **άλλο σχήμα** —
 * η βίαιη ενοποίησή τους θα έσπαγε τη σύνθεση του Radix.
 *
 * @module components/core/CompactToolbar/ToolbarIconButton
 * @see ADR-823 §14.5
 */

import '@/lib/design-system';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { getIconColor } from './icon-colors';

/** Το κλειδί χρώματος — δεμένο στην ίδια αυθεντία που το λύνει. */
export type ToolbarIconColorKey = Parameters<typeof getIconColor>[0];

export interface ToolbarIconButtonProps {
  /** Το εικονίδιο. Μπορεί να έρθει και από prop του καταναλωτή (π.χ. `newItemIcon`). */
  readonly icon: LucideIcon;
  /** Ποιο χρώμα δράσης — λύνεται από το `icon-colors`, ποτέ χειρόγραφο. */
  readonly colorKey: ToolbarIconColorKey;
  /** Το κείμενο του tooltip. Αν λείπει, **δεν** αποδίδεται `TooltipContent`. */
  readonly tooltip: string | undefined;
  /** Η προσβάσιμη ετικέτα όταν δεν υπάρχει tooltip — ποτέ κενή. */
  readonly fallbackLabel: string;
  readonly onClick?: (() => void) | undefined;
  /** Προεπιλογή `false`: παράγει **ακριβώς** το ίδιο DOM με το να λείπει. */
  readonly disabled?: boolean;
}

export function ToolbarIconButton({
  icon: Icon,
  colorKey,
  tooltip,
  fallbackLabel,
  onClick,
  disabled = false,
}: ToolbarIconButtonProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`${iconSizes.xl} p-0`}
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip || fallbackLabel}
        >
          <Icon
            className={`${iconSizes.sm} ${disabled ? colors.text.muted : getIconColor(colorKey)}`}
          />
        </Button>
      </TooltipTrigger>
      {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
    </Tooltip>
  );
}
