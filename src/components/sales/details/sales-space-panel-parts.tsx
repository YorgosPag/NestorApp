'use client';

/**
 * =============================================================================
 * SALES SPACE PANEL PARTS — το κέλυφος ενός πάνελ λεπτομερειών
 * =============================================================================
 *
 * Τα πάνελ στάθμευσης και αποθήκης δεν είναι «παρόμοια»: έχουν **ταυτόσημη**
 * κενή κατάσταση και **ταυτόσημη** επικεφαλίδα ενότητας, με μόνη διαφορά το
 * εικονίδιο και το κείμενο. Το CHECK 3.28 τα μέτρησε ως κλώνο.
 *
 * Ό,τι ανήκει σε έναν χώρο (η ζώνη του parking, ο ιδιοκτήτης της αποθήκης)
 * μένει στο πάνελ του — εδώ ζει μόνο το κοινό **σχήμα**, ώστε μια αλλαγή στην
 * όψη να μην χρειάζεται να θυμηθεί κανείς να την κάνει δύο φορές.
 *
 * @module components/sales/details/sales-space-panel-parts
 */

import type { ReactNode, ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SALES_ICON_COLORS } from '@/components/sales/config/sales-colors';
import { cn } from '@/lib/utils';

/** Μήνυμα «δεν έχει επιλεγεί τίποτα» — η κατάσταση πριν από κάθε πάνελ. */
export function SalesSpaceEmptyPanel({ message }: { message: string }) {
  const colors = useSemanticColors();
  return (
    <section className={cn('p-4 text-center text-sm', colors.text.muted)}>
      {message}
    </section>
  );
}

interface SalesSpaceSectionProps {
  /**
   * Το εικονίδιο της επικεφαλίδας — ταυτότητα της ενότητας.
   *
   * Προαιρετικό: η ενότητα σημειώσεων δεν έχει, και επιβάλλοντάς της ένα θα
   * άλλαζε την όψη της για να βολέψει τον τύπο.
   */
  icon?: ComponentType<{ className?: string }>;
  /** Λυμένος τίτλος· ο καλών ξέρει το namespace του (CHECK 3.8). */
  title: string;
  /** Χρώμα εικονιδίου· εξ ορισμού αυτό της «βασικής» ενότητας. */
  iconColor?: string;
  children: ReactNode;
}

/** Κάρτα ενότητας πάνελ: επικεφαλίδα με εικονίδιο + σώμα με σειρές. */
export function SalesSpaceSection({
  icon: Icon,
  title,
  iconColor = SALES_ICON_COLORS.basicInfoSection,
  children,
}: SalesSpaceSectionProps) {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {Icon && <Icon className={`${iconSizes.sm} ${iconColor}`} />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}
