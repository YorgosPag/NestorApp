/**
 * BuildingSpaceTabHeader — η ΜΙΑ κεφαλίδα των καρτελών χώρων ενός κτιρίου (Όροφοι · Μονάδες · Αποθήκες · Στάθμευση).
 *
 * Υπήρχε τέσσερις φορές ως `flex items-center justify-between` χωρίς αναδίπλωση: στα 390px οι πράξεις έβγαιναν
 * έξω από το πλαίσιο και κόβονταν (μετρημένο ζωντανά 2026-10-10: «Μονάδες» ως τα 458px, «Αποθήκες» ως τα 475px).
 * Εδώ, σε στενό χώρο, οι πράξεις κατεβαίνουν κάτω από τον τίτλο. Η διάταξη ανήκει στο `HeaderBar` (ADR-912 §8)·
 * αυτό το αρχείο κρατά μόνο τη μορφή του τίτλου (εικονίδιο · όνομα · πλήθος).
 *
 * @see ADR-912 §5.3 · §8
 */

import type { ReactNode } from 'react';

import { HeaderBar } from '@/components/ui/header-bar';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface BuildingSpaceTabHeaderProps {
  /** Το εικονίδιο του τίτλου, έτοιμο — το χρώμα του το δηλώνει ο καλών. */
  icon: ReactNode;
  title: string;
  /** Πλήθος δίπλα στον τίτλο, π.χ. «(3)». Παραλείπεται όπου δεν έχει νόημα. */
  count?: number;
  /** Οι πράξεις της καρτέλας (κουμπιά). */
  children: ReactNode;
}

export function BuildingSpaceTabHeader({ icon, title, count, children }: BuildingSpaceTabHeaderProps) {
  const colors = useSemanticColors();
  return (
    <HeaderBar as="header" actionsAs="nav" actions={children}>
      <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
        {count !== undefined && <span className={cn('text-sm font-normal', colors.text.muted)}>({count})</span>}
      </h2>
    </HeaderBar>
  );
}
