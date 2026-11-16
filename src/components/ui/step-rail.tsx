'use client';

/**
 * ADR-929 §6.25 — **«Πού βρίσκομαι, τι έγινε, τι μένει;»** — η ράγα βημάτων ενός οδηγού που ζει ΜΕΣΑ σε πάνελ.
 *
 * 🏆 Η πρακτική: NN/g *staged disclosure* (ένα υποσύνολο ανά βήμα) — αλλά με τη ρητή προειδοποίηση του ίδιου άρθρου
 *   ότι τα βήματα που **αλληλοεξαρτώνται** θέλουν ελεύθερη μετάβαση. Άρα κάθε βήμα είναι **κουμπί**: ο άνθρωπος
 *   γυρίζει πίσω χωρίς κλείδωμα (Bluebeam: η επαναβαθμονόμηση δεν κρύβεται ποτέ). Revit/CubiCasa: η κατάσταση κάθε
 *   βήματος (έγινε / θέλει προσοχή) φαίνεται χωρίς να το ανοίξεις.
 *
 * 🔑 **Κανάλι κατάστασης χωρίς χρώμα** (CHECK 3.41): κάθε κατάσταση έχει ΔΙΚΟ της σχήμα (✓ · ⚠ · αριθμός) **και**
 *   κείμενο για τον αναγνώστη οθόνης· το χρώμα είναι πλεονασμός, ποτέ το μόνο σήμα.
 * 🔑 Σημασιολογία WAI-ARIA: `<nav>` + `<ol>` + `aria-current="step"` — «βήμα 2 από 3, τρέχον».
 * 🔑 Γενικό: δεν ξέρει τι είναι τα βήματα· ετικέτες και κείμενα κατάστασης έρχονται μεταφρασμένα από τον καταναλωτή.
 */

import * as React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `done` = ολοκληρώθηκε · `attention` = θέλει απόφαση πριν προχωρήσει · `pending` = δεν άρχισε. */
export type StepRailStatus = 'done' | 'attention' | 'pending';

interface StepRailStep<TId extends string = string> {
  readonly id: TId;
  /** Μεταφρασμένη ετικέτα. */
  readonly label: string;
  readonly status: StepRailStatus;
  /** Μεταφρασμένο κείμενο κατάστασης για τον αναγνώστη οθόνης («ολοκληρώθηκε» κ.λπ.). */
  readonly statusLabel: string;
}

interface StepRailProps<TId extends string = string> {
  readonly steps: readonly StepRailStep<TId>[];
  readonly currentId: TId;
  readonly onSelect: (id: TId) => void;
  /** Μεταφρασμένο όνομα της πλοήγησης. */
  readonly ariaLabel: string;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

function StepGlyph({ index, status }: { readonly index: number; readonly status: StepRailStatus }): React.ReactElement {
  const base = 'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold';
  if (status === 'done') {
    return <span aria-hidden="true" className={cn(base, 'border border-foreground text-foreground')}><Check className="size-3" /></span>;
  }
  if (status === 'attention') {
    return <span aria-hidden="true" className={cn(base, 'text-destructive')}><AlertTriangle className="size-3.5" /></span>;
  }
  return <span aria-hidden="true" className={cn(base, 'border border-border text-muted-foreground')}>{index + 1}</span>;
}

export function StepRail<TId extends string>(props: StepRailProps<TId>): React.JSX.Element {
  const { steps, currentId, onSelect, ariaLabel, className } = props;
  return (
    <nav aria-label={ariaLabel} className={className} data-testid={props['data-testid']}>
      <ol className="m-0 flex list-none items-stretch gap-1 p-0">
        {steps.map((step, index) => {
          const current = step.id === currentId;
          return (
            <li key={step.id} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={current ? 'step' : undefined}
                data-step={step.id}
                data-status={step.status}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-1.5 rounded border-b-2 px-1.5 py-1 text-left text-xs transition-colors',
                  'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  current ? 'border-foreground bg-accent font-semibold text-foreground' : 'border-transparent text-muted-foreground',
                )}
              >
                <StepGlyph index={index} status={step.status} />
                <span className="min-w-0 truncate">{step.label}</span>
                <span className="sr-only">{step.statusLabel}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
