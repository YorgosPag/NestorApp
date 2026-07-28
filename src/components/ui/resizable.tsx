/**
 * Resizable Panel Components — shadcn/ui pattern
 *
 * Wraps react-resizable-panels with consistent styling.
 * Used for split-panel layouts (file manager, editors, etc.)
 *
 * ── ⚠️ ΤΑ SELECTORS ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΗ ΒΙΒΛΙΟΘΗΚΗ (v4) — ΜΗΝ ΤΑ ΜΑΝΤΕΨΕΙΣ ──
 *
 * Το πακέτο πέρασε από v2/v3 σε **v4** και μετονόμασε ό,τι βγάζει στο DOM. Το στυλ εδώ έμεινε
 * στα παλιά ονόματα, οπότε **δεν εφάρμοζε τίποτα**: ένας selector που δεν ταιριάζει δεν είναι
 * σφάλμα — είναι **σιωπή**. Τρεις σελίδες (file manager, αρχεία οντότητας, συμφωνία λογαριασμών)
 * φαίνονταν να έχουν ένδειξη ενεργού συρσίματος και **δεν είχαν** (ADR-724 §14.4).
 *
 * Τι εκπέμπει **πραγματικά** η `4.7.2` (επαληθευμένο στο bundle **και** σε ζωντανό DOM):
 *
 * | Στοιχείο | Attributes |
 * |---|---|
 * | `Group` | `data-group` — **καμία** ένδειξη κατεύθυνσης· ό,τι κληρονομούσε το `data-panel-group-direction` είναι οριστικά χαμένο εκεί |
 * | `Panel` | `data-panel` |
 * | `Separator` | `data-separator="inactive\|hover\|active\|disabled"` + `role="separator"` + `aria-orientation` |
 *
 * Άρα η **κατεύθυνση** ζει μόνο στο `aria-orientation` του ίδιου του separator — και περιγράφει
 * τη **γραμμή**, όχι την ομάδα: ομάδα `horizontal` (panels δίπλα-δίπλα) ⇒ `aria-orientation`
 * **`vertical`**. Οι κανόνες παρακάτω στοχεύουν το `horizontal`, δηλαδή τη γραμμή που χωρίζει
 * panels στοιβαγμένα **κατακόρυφα**.
 *
 * @see https://github.com/bvaughn/react-resizable-panels
 * @license MIT
 */

'use client';

import type { ComponentProps } from 'react';
import { GripVertical } from 'lucide-react';
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

/**
 * Το `flex-direction` **δεν** μπορεί πια να προκύψει από selector: το `Group` της v4 δεν εκπέμπει
 * την κατεύθυνσή του. Το `orientation` είναι ήδη prop της βιβλιοθήκης (προαιρετικό — προεπιλογή
 * `"horizontal"`), οπότε το διαβάζουμε από εκεί: μία πηγή, όχι δύο.
 */
const ResizablePanelGroup = ({
  className,
  orientation,
  ...props
}: ComponentProps<typeof PanelGroup>) => (
  <PanelGroup
    orientation={orientation}
    className={cn(
      'flex h-full w-full',
      orientation === 'vertical' && 'flex-col',
      className
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <PanelResizeHandle
    className={cn(
      'relative flex w-px items-center justify-center bg-border',
      'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
      // Οριζόντια γραμμή ⇒ panels στοιβαγμένα κατακόρυφα (βλ. σημείωση κατεύθυνσης στην κεφαλίδα).
      '[&[aria-orientation=horizontal]]:h-px [&[aria-orientation=horizontal]]:w-full',
      '[&[aria-orientation=horizontal]]:after:left-0 [&[aria-orientation=horizontal]]:after:h-1',
      '[&[aria-orientation=horizontal]]:after:w-full',
      '[&[aria-orientation=horizontal]]:after:-translate-y-1/2',
      '[&[aria-orientation=horizontal]]:after:translate-x-0',
      // Η ένδειξη ενεργού συρσίματος — η **μόνη** από τις παλιές που είχε ζωντανό καταναλωτή.
      // (Η v4 εκπέμπει και `hover`· δεν το χρωματίζουμε εδώ γιατί δεν το ζητούσε το αρχικό στυλ.)
      'data-[separator=active]:bg-ring',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

/**
 * Το μέγεθος που παραδίδει το `onResize` (σε pixels **και** ποσοστό) — εκτίθεται εδώ ώστε ο
 * καταναλωτής να μην εισάγει το ίδιο το `react-resizable-panels`. Ένα σημείο επαφής με τη
 * βιβλιοθήκη, όχι Ν.
 */
export type { PanelSize } from 'react-resizable-panels';
