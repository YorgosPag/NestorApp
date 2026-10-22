'use client';

/**
 * **ΤΟ ΠΡΩΤΟ ΒΗΜΑ ΤΗΣ ΖΗΤΗΣΗΣ — «Πότε το θέλεις;»** σε τρεις μεγάλες κάρτες, χωρίς προεπιλογή.
 *
 * @related ADR-777 §8.98 · SPEC-777B §12.3 · components/ui/choice-cards
 * @module components/demand/DemandTimingChooser
 *
 * 🔑 **Γιατί πρώτο βήμα και όχι πεδίο της φόρμας**: ο χρόνος είναι ο άξονας που **καμία** πύλη δεν ρωτά
 * (`DemandTiming`). Ως τρίτο πλαίσιο με προεπιλεγμένο «Τώρα», σχεδόν κανείς δεν τον άλλαζε, και η
 * διαφορά μας έμενε αόρατη. Το ίδιο κάνει το Airbnb στο «Become a host»: η ερώτηση που πλαισιώνει όλη
 * τη ροή μπαίνει πρώτη, με μεγάλες κάρτες.
 *
 * ⚠️ **ΔΕΝ είναι οδηγός βημάτων.** Η υπόλοιπη φόρμα μένει μία σελίδα, γιατί η Α14 §17.2 δεσμεύεται να
 * δείχνει **όλες** τις παραβιάσεις μαζί. Το «πότε» παραμένει πεδίο της φόρμας και αλλάζει εκεί.
 *
 * 🔗 **Η απάντηση ζει στον σύνδεσμο** (`?when=`, `push` και όχι `replace`), ώστε το «πίσω» να γυρίζει
 * εδώ. Το `from` του χάρτη (ADR-888) κρατιέται.
 */

import React from 'react';
import { CalendarRange, Hourglass, Zap } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRouter } from '@/lib/workspace/navigation';
import { ChoiceCards, type ChoiceCardOption } from '@/components/ui/choice-cards';
import { newDemandWithTimingHref } from '@/lib/demand/demand-routes';
import { DEMAND_TIMING_KINDS, type DemandTimingKind } from '@/types/property-demand';

const NS = 'property-market';

const TIMING_ICONS: Record<DemandTimingKind, React.ElementType> = {
  now: Zap,
  window: CalendarRange,
  whenever: Hourglass,
};

export interface DemandTimingChooserProps {
  /** Το τρέχον query της σελίδας (π.χ. `from=…`), για να κρατηθεί στο επόμενο βήμα. */
  readonly currentQuery: string;
}

export function DemandTimingChooser({ currentQuery }: DemandTimingChooserProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const router = useRouter();

  const options: ChoiceCardOption<DemandTimingKind>[] = DEMAND_TIMING_KINDS.map((kind) => ({
    id: kind,
    icon: TIMING_ICONS[kind],
    title: t(`${NS}:demand.form.timing.${kind}`),
    description: t(`${NS}:demand.form.timing.chooser.${kind}`),
  }));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="demand-timing-chooser-title">
      <header className="flex flex-col gap-1">
        <h1 id="demand-timing-chooser-title" className="text-2xl font-semibold text-foreground">
          {t(`${NS}:demand.form.timing.legend`)}
        </h1>
        <p className="text-sm text-muted-foreground">{t(`${NS}:demand.form.timing.help`)}</p>
      </header>
      <ChoiceCards
        options={options}
        size="lg"
        ariaLabel={t(`${NS}:demand.form.timing.legend`)}
        onSelect={(kind) => router.push(newDemandWithTimingHref(kind, currentQuery))}
      />
      <p className="text-xs text-muted-foreground">{t(`${NS}:demand.form.timing.chooser.changeLater`)}</p>
    </section>
  );
}
