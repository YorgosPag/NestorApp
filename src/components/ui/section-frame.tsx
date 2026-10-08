'use client';

/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΜΙΑΣ ΕΝΟΤΗΤΑΣ ΜΕ ΤΙΤΛΟ** — μία επιφάνεια (`Card`), μία επικεφαλίδα, ένα ορόσημο με όνομα.
 * @related ADR-777 §8.87.4 · §8.87.10 · `card.tsx` (`asChild`) · `spatial-tour/TourPanelSection.tsx` (η τοπική του μορφή)
 * @module components/ui/section-frame
 *
 * 🔴 **ΑΝΕΒΗΚΕ ΑΠΟ ΤΟ `TourPanelSection`** (N.0.2): η ίδια ενότητα — όριο, φόντο, ακτίνα, εσωτερικό κενό, επικεφαλίδα —
 * ζούσε γραμμένη με το χέρι σε δεκάδες οθόνες, με **δύο** ακτίνες και **δύο** επιφάνειες για το ίδιο πράγμα.
 *
 * 🔑 **Η επιφάνεια ΕΙΝΑΙ το `Card`** — καμία δεύτερη συνταγή ορίου/φόντου. Ακτίνα και ανύψωση αλλάζουν σε ΕΝΑ σημείο.
 * 🔑 **Το ορόσημο έχει ΠΑΝΤΑ όνομα**: το `aria-labelledby` δένεται εδώ με την ορατή επικεφαλίδα, ώστε να μην είναι
 * πειθαρχία του καλούντος (σκέτο `<section>` + `<h2>` δεν είναι ορόσημο· `aria-label` δίπλα σε ορατό τίτλο τον διπλασιάζει).
 * ⚠️ `headingLevel` **υποχρεωτικό**: το περίγραμμα του εγγράφου το ξέρει μόνο η σελίδα, δεν μαντεύεται (WCAG 1.3.1).
 * ⚠️ `titleSize` και `gap` είναι **κλειστά σύνολα** και δεν υπάρχει `className`: καμία πόρτα για χειρόγραφη τιμή.
 * ⚠️ Ό,τι **δεν** είναι ενότητα με τίτλο (γραμμή λίστας, κάρτα οντότητας, σκελετός) παίρνει `<Card asChild>`, όχι αυτό.
 */

import React, { useId } from 'react';

import { Card } from '@/components/ui/card';

const HEADING_CLASSES = {
  /** Ετικέτα πάνω από το περιεχόμενο — το περιεχόμενο είναι ο πρωταγωνιστής (τιμή, χαρακτηριστικά). */
  eyebrow: 'text-sm font-medium text-muted-foreground',
  sm: 'text-sm font-semibold text-foreground',
  base: 'text-base font-semibold text-foreground',
  lg: 'text-lg font-semibold text-foreground',
} as const;

const GAP_CLASSES = { 2: 'flex flex-col gap-2', 3: 'flex flex-col gap-3', 4: 'flex flex-col gap-4' } as const;

export type SectionFrameTitleSize = keyof typeof HEADING_CLASSES;
export type SectionFrameGap = keyof typeof GAP_CLASSES;
export type SectionFrameHeadingLevel = 'h2' | 'h3' | 'h4';

type SectionFrameProps = Omit<
  React.ComponentPropsWithoutRef<'section'>,
  'className' | 'title' | 'aria-labelledby' | 'aria-label'
> & {
  readonly title: React.ReactNode;
  readonly headingLevel: SectionFrameHeadingLevel;
  /** Σταθερό `id` της επικεφαλίδας όπου το χρειάζεται άγκυρα· αλλιώς παράγεται. */
  readonly headingId?: string;
  readonly titleSize?: SectionFrameTitleSize;
  /** Μία γραμμή κάτω από τον τίτλο — τι είναι η ενότητα, όχι περιεχόμενό της. */
  readonly description?: React.ReactNode;
  /** Ενέργεια της ενότητας, στην ίδια γραμμή με τον τίτλο. */
  readonly actions?: React.ReactNode;
  /** `aside` όταν η ενότητα είναι παράπλευρη προς το κύριο περιεχόμενο (ορόσημο `complementary`). */
  readonly as?: 'section' | 'aside';
  /** Κάθετο κενό μεταξύ των παιδιών. Χωρίς τιμή τα παιδιά κρατούν τη δική τους ροή και τα δικά τους περιθώρια. */
  readonly gap?: SectionFrameGap;
};

export function SectionFrame({
  title,
  headingLevel: Heading,
  headingId,
  titleSize = 'base',
  description,
  actions,
  as: Landmark = 'section',
  gap,
  children,
  ...rest
}: SectionFrameProps): React.ReactElement {
  const generatedId = useId();
  const id = headingId ?? generatedId;
  const heading = <Heading id={id} className={`m-0 ${HEADING_CLASSES[titleSize]}`}>{title}</Heading>;
  const hasHeaderRow = actions !== undefined || description !== undefined;

  return (
    <Card asChild className={`p-4 ${gap === undefined ? '' : GAP_CLASSES[gap]}`}>
      <Landmark {...rest} aria-labelledby={id}>
        {hasHeaderRow ? (
          <header className={`flex flex-wrap justify-between gap-2 ${description === undefined ? 'items-center' : 'items-start'}`}>
            <span className="flex min-w-0 flex-col gap-1">
              {heading}
              {description !== undefined && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
            </span>
            {actions}
          </header>
        ) : heading}
        {children}
      </Landmark>
    </Card>
  );
}
