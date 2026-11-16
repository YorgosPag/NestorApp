'use client';

/**
 * ADR-929 §6.25 — **«Λεπτομέρειες»**: τα τεχνικά ενός βήματος, ΣΤΟ ίδιο πλαίσιο αλλά ΚΛΕΙΣΤΑ.
 *
 * 🏆 Η πρακτική: Revit — το «Expand» των προειδοποιήσεων και το `TaskDialog.ExpandedContent` (κρυφό από προεπιλογή)·
 *   NN/g progressive disclosure — το δευτερεύον σε δεύτερο επίπεδο, **ποτέ** πάνω από δύο επίπεδα· Apple HIG
 *   disclosure group. Όχι καθολική ρύθμιση «για προχωρημένους»: ο μηχανικός που θέλει το σ ή το sha256 το θέλει
 *   **δίπλα** στην απόφαση που αφορά, όχι σε άλλη οθόνη.
 *
 * 🔑 `forceMount`: το περιεχόμενο μένει στο DOM — για τα tests, χωρίς ξαναϋπολογισμό σε κάθε άνοιγμα. ⚠️ Με
 *   `forceMount` το Radix **δεν** βάζει ποτέ `hidden` (το `isOpen` γίνεται πάντα true)· το κλειστό κρύβεται **μόνο**
 *   με CSS (`data-[state=closed]:hidden` ⇒ `display:none`), άρα **δεν** το βρίσκει το Ctrl+F. Η ορατότητα
 *   ρωτιέται στο `data-state`, όχι στο `hidden`.
 */

import * as React from 'react';
import { ChevronRight, CircleAlert } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function StepDetails({ label, hint, children, testId }: {
  /** Μεταφρασμένη ετικέτα («Λεπτομέρειες», «Λεπτομέρειες υπολογισμού» …). */
  readonly label: string;
  /**
   * Ό,τι αξίζει προσοχή μέσα, ορατό ΚΑΙ κλειστό (Revit: το «Expand» δείχνει πόσα υπάρχουν). Κλειστό ≠ σιωπηλό.
   */
  readonly hint?: string;
  readonly children: React.ReactNode;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <Collapsible className="group/details flex flex-col gap-1.5" data-testid={testId}>
      <CollapsibleTrigger
        className="flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]/details:rotate-90" aria-hidden="true" />
        <span>{label}</span>
        {hint ? (
          <span className="ml-auto flex items-center gap-1 text-foreground" data-testid={testId ? `${testId}-hint` : undefined}>
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {hint}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="flex flex-col gap-1.5 border-l border-border pl-2 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
