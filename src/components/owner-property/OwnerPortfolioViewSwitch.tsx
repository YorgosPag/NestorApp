'use client';

/**
 * **Ο διακόπτης Λίστα | Χάρτης του χαρτοφυλακίου** (ADR-777 §8.71).
 *
 * 🔑 Radix `Tabs` (`ui/tabs`), όπως το `LandingModeSwitch`: πλήρες WAI-ARIA tablist (βέλη,
 * roving tabindex, Home/End) αντί για χειροποίητα κουμπιά. Η ρίζα `<Tabs>` ζει στη σελίδα· εδώ
 * μόνο η λίστα καρτελών.
 *
 * ⚠️ **Εμφανίζεται μόνο όταν ο χάρτης έχει κάτι να πει** (`hasOwnerPortfolioMap`): τον έλεγχο
 * τον κάνει η σελίδα, μία φορά, για διακόπτη και απόδοση μαζί.
 */

import React from 'react';
import { List, Map as MapIcon } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  OWNER_PORTFOLIO_VIEWS,
  type OwnerPortfolioView,
} from '@/lib/owner-property/owner-portfolio-map';

const K = 'property-market:offer.portfolio.view';

const VIEW_ICON: Record<OwnerPortfolioView, typeof List> = { list: List, map: MapIcon };

/**
 * Μόνο η ενεργή καρτέλα δηλώνει `aria-controls`: ο Radix αποδίδει **μόνο** το ενεργό πάνελ, και
 * ένα `aria-controls` προς πάνελ που δεν υπάρχει είναι σπασμένη αναφορά (ίδιο με `LandingModeSwitch`).
 */
const SUPPRESS_ARIA_CONTROLS = { 'aria-controls': undefined } as const;

export function OwnerPortfolioViewSwitch({ value }: { readonly value: OwnerPortfolioView }) {
  const { t } = useTranslation(['property-market']);

  return (
    <TabsList aria-label={t(`${K}.label`)} className="self-start">
      {OWNER_PORTFOLIO_VIEWS.map((view) => {
        const Icon = VIEW_ICON[view];
        return (
          <TabsTrigger
            key={view}
            value={view}
            className="gap-1.5"
            {...(view === value ? {} : SUPPRESS_ARIA_CONTROLS)}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t(`${K}.${view}`)}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
