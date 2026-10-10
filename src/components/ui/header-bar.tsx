/**
 * @fileoverview **Η ΜΙΑ ΓΡΑΜΜΗ «ΤΙΤΛΟΣ + ΠΡΑΞΕΙΣ»** — μόνο διάταξη· ο τίτλος και οι πράξεις ανήκουν στον καλούντα.
 * @related ADR-912 §8 · `card.tsx` (`CardHeader`) · `section-frame.tsx` · `chart-card/ChartCardHeader.tsx` · `BuildingSpaceTabHeader.tsx`
 * @module components/ui/header-bar
 *
 * 🔴 Το σχήμα ζούσε γραμμένο με το χέρι ως `flex items-center justify-between` **χωρίς αναδίπλωση** σε 55 κεφαλίδες
 * καρτών: στα 390px οι πράξεις έβγαιναν από το πλαίσιο και ο τίτλος συμπιεζόταν σε στενή στήλη.
 *
 * 🔑 **Σύνθεση, όχι ιδιότητες τίτλου**: τα παιδιά είναι ό,τι είχε ήδη ο καλών (`CardTitle`, `<h2>`)· η τυπογραφία κάθε
 * οθόνης μένει δική της.
 * 🔑 **Ποιος αποφασίζει την αναδίπλωση: το ΠΕΡΙΕΧΟΜΕΝΟ του τίτλου, όχι ένας αριθμός.** Η περιοχή τίτλου έχει βάση
 * `auto`: οι πράξεις κατεβαίνουν ακριβώς όταν «τίτλος σε μία γραμμή + πράξεις» δεν χωρούν — ποτέ νωρίτερα, ποτέ
 * αργότερα. Η πρώτη μορφή είχε σταθερή βάση 12rem· σε στενή κάρτα (πλακίδιο KPI, κάρτα τριμήνου, ~14rem) θα έριχνε
 * σήμα ή εικονίδιο κάτω από τίτλο δύο λέξεων, και σε desktop.
 * 🔑 **Η περιγραφή ΔΕΝ ψηφίζει**: μπαίνει στο `description` και αποδίδεται με `w-0 min-w-full` — μηδενική συνεισφορά
 * στο εγγενές πλάτος, πλήρες πλάτος στη διάταξη. Αλλιώς μια μακριά περιγραφή θα έριχνε τις πράξεις κάτω σε κάθε πλάτος
 * (ο λόγος που υπήρχε η σταθερή βάση).
 * ⚠️ `wrap={false}` **μόνο** για διακοσμητικό σταθερού μεγέθους (εικονίδιο): δεν μπορεί να στριμώξει τον τίτλο, και αν
 * αναδιπλωνόταν θα έμενε μόνο του σε δική του γραμμή.
 * ⚠️ **ΜΗΝ το κάνεις `@container`**: δημιουργεί stacking context και containing block για `position: fixed`
 * (ADR-912 §2.1 · ADR-797 §3.1). Εδώ αλλάζει μόνο γεωμετρία — το `flex-wrap` αρκεί, χωρίς μέτρηση.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const ALIGN_CLASSES = { center: 'items-center', start: 'items-start' } as const;

function isRendered(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false;
}

export interface HeaderBarProps {
  /** Ο τίτλος, όπως τον αποδίδει ήδη ο καλών. Το εγγενές του πλάτος αποφασίζει πότε κατεβαίνουν οι πράξεις. */
  readonly children: ReactNode;
  /** Ό,τι εξηγεί τον τίτλο (π.χ. `CardDescription`). Απλώνεται κάτω από τον τίτλο χωρίς να επηρεάζει την αναδίπλωση. */
  readonly description?: ReactNode;
  /** Ό,τι στέκεται απέναντι από τον τίτλο: κουμπιά, σήματα, πλήθος. Χωρίς τιμή δεν αποδίδεται κόμβος. */
  readonly actions?: ReactNode;
  /** `start` όταν οι πράξεις πρέπει να μείνουν στο ύψος της πρώτης γραμμής. Προεπιλογή: `start` με περιγραφή, αλλιώς `center`. */
  readonly align?: keyof typeof ALIGN_CLASSES;
  /** `false` μόνο για διακοσμητικό σταθερού μεγέθους (εικονίδιο) απέναντι από τον τίτλο. */
  readonly wrap?: boolean;
  /** `header` όταν η γραμμή είναι η κεφαλίδα μιας ενότητας και δεν ζει ήδη μέσα σε `CardHeader`. */
  readonly as?: 'div' | 'header';
  /** `nav` όταν οι πράξεις είναι η πλοήγηση/εργαλειοθήκη της ενότητας. */
  readonly actionsAs?: 'div' | 'nav';
  readonly className?: string;
}

export function HeaderBar({
  children,
  description,
  actions,
  align,
  wrap = true,
  as: Root = 'div',
  actionsAs: Actions = 'div',
  className,
}: HeaderBarProps) {
  const hasDescription = isRendered(description);
  const alignment = align ?? (hasDescription ? 'start' : 'center');
  return (
    <Root
      className={cn(
        'flex justify-between gap-x-4 gap-y-2',
        wrap ? 'flex-wrap' : 'flex-nowrap',
        ALIGN_CLASSES[alignment],
        className,
      )}
    >
      <div className={cn('min-w-0', wrap ? 'flex-auto' : 'flex-1')}>
        {children}
        {hasDescription && <div className="w-0 min-w-full">{description}</div>}
      </div>
      {isRendered(actions) && (
        <Actions className={cn('flex max-w-full items-center gap-2', wrap ? 'flex-wrap' : 'shrink-0')}>
          {actions}
        </Actions>
      )}
    </Root>
  );
}
