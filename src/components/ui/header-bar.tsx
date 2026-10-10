/**
 * @fileoverview **Η ΜΙΑ ΓΡΑΜΜΗ «ΤΙΤΛΟΣ + ΠΡΑΞΕΙΣ»** — μόνο διάταξη· ο τίτλος και οι πράξεις ανήκουν στον καλούντα.
 * @related ADR-912 §8 · `card.tsx` (`CardHeader`) · `chart-card/ChartCardHeader.tsx` · `BuildingSpaceTabHeader.tsx`
 * @module components/ui/header-bar
 *
 * 🔴 Το σχήμα ζούσε γραμμένο με το χέρι ως `flex items-center justify-between` **χωρίς αναδίπλωση** σε 55 κεφαλίδες
 * καρτών: στα 390px οι πράξεις έβγαιναν από το πλαίσιο και ο τίτλος συμπιεζόταν σε στενή στήλη.
 *
 * 🔑 **Σύνθεση, όχι ιδιότητες τίτλου**: τα παιδιά είναι ό,τι είχε ήδη ο καλών (`CardTitle`, `CardDescription`, `<h2>`)·
 * η τυπογραφία κάθε οθόνης μένει δική της.
 * 🔑 **Η βάση της περιοχής τίτλου είναι το κρίσιμο σημείο**: χωρίς βάση μια μακριά περιγραφή ρίχνει τις πράξεις κάτω
 * και σε φαρδύ χώρο· με μηδενική, ο τίτλος συμπιέζεται. Με `basis-48` οι πράξεις κατεβαίνουν μόνο όταν ο τίτλος θα
 * έπεφτε κάτω από 12rem.
 * ⚠️ **ΜΗΝ το κάνεις `@container`**: δημιουργεί stacking context και containing block για `position: fixed`
 * (ADR-912 §2.1 · ADR-797 §3.1). Εδώ αλλάζει μόνο γεωμετρία — το `flex-wrap` αρκεί, χωρίς μέτρηση.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const ALIGN_CLASSES = { center: 'items-center', start: 'items-start' } as const;

export interface HeaderBarProps {
  /** Ο τίτλος (και η περιγραφή του), όπως τον αποδίδει ήδη ο καλών. */
  readonly children: ReactNode;
  /** Ό,τι στέκεται απέναντι από τον τίτλο: κουμπιά, σήματα, πλήθος. Χωρίς τιμή δεν αποδίδεται κόμβος. */
  readonly actions?: ReactNode;
  /** `start` όταν ο τίτλος έχει περιγραφή και οι πράξεις πρέπει να μείνουν στο ύψος της πρώτης γραμμής. */
  readonly align?: keyof typeof ALIGN_CLASSES;
  /** `header` όταν η γραμμή είναι η κεφαλίδα μιας ενότητας και δεν ζει ήδη μέσα σε `CardHeader`. */
  readonly as?: 'div' | 'header';
  /** `nav` όταν οι πράξεις είναι η πλοήγηση/εργαλειοθήκη της ενότητας. */
  readonly actionsAs?: 'div' | 'nav';
  readonly className?: string;
}

export function HeaderBar({
  children,
  actions,
  align = 'center',
  as: Root = 'div',
  actionsAs: Actions = 'div',
  className,
}: HeaderBarProps) {
  const hasActions = actions !== undefined && actions !== null && actions !== false;
  return (
    <Root className={cn('flex flex-wrap justify-between gap-x-4 gap-y-2', ALIGN_CLASSES[align], className)}>
      <div className="min-w-0 flex-1 basis-48">{children}</div>
      {hasActions && <Actions className="flex max-w-full flex-wrap items-center gap-2">{actions}</Actions>}
    </Root>
  );
}
