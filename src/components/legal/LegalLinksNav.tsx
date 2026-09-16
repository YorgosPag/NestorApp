'use client';

/**
 * @fileoverview ⚖️ **ΟΙ ΝΟΜΙΚΟΙ ΣΥΝΔΕΣΜΟΙ, ΜΙΑ ΦΟΡΑ** — μενού · οθόνες σύνδεσης · σελίδα νομικών στοιχείων (ADR-861 Φ2).
 * @related lib/routes/legalRoutes.ts · components/app-sidebar.tsx · auth/components/AuthScreenChrome.tsx
 * @module components/legal/LegalLinksNav
 *
 * 🔴 **Γιατί υπάρχει**: οι σύνδεσμοι ζούσαν **μόνο** στο πλαϊνό μενού, που βλέπει μόνο όποιος έχει
 * συνδεθεί. Ο επισκέπτης της οθόνης σύνδεσης δεν είχε πρόσβαση σε πολιτική απορρήτου ή όρους —
 * ενώ το Π.Δ. 131/2003 άρθ. 4 ζητά «εύκολη, άμεση και συνεχή πρόσβαση».
 *
 * 🔑 Το namespace **δηλώνεται εδώ** (`navigation`, ταξιδεύει ολόκληρο στο shell slice — ADR-744 §18),
 * καμία prop `t`. Η πλοήγηση περνά από το **σύνορο** (CHECK 3.61): οι νομικές διαδρομές είναι εκτός
 * χώρου, άρα μένουν ωμές — αλλά χωρίς πλήρη επαναφόρτωση σελίδας, όπως έκανε το παλιό `<a>`.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LEGAL_LINK_ORDER, LEGAL_ROUTES, type LegalRouteId } from '@/lib/routes/legalRoutes';
import { Link } from '@/lib/workspace/navigation';

/**
 * Ρητός χάρτης ετικετών — ο γεννήτορας του slice λύνει τις τιμές του.
 *
 * ⚠️ **Σκέτο `as const`, ΟΧΙ `satisfies`**: ο γεννήτορας ξετυλίγει μόνο `AsExpression`
 * (`key-tables.js`)· με `satisfies` το κέλυφος **αρνήθηκε** να εκπεμφθεί (μετρημένο 2026-09-16).
 * Η πληρότητα φυλάγεται ήδη από τον τύπο: `LABEL_KEYS[id]` με `id: LegalRouteId` δεν μεταγλωττίζεται αν λείπει κλειδί.
 */
const LABEL_KEYS = {
  privacyPolicy: 'legal.privacyPolicy',
  terms: 'legal.termsOfService',
  dataDeletion: 'legal.dataDeletion',
  legalNotice: 'legal.legalNotice',
  openSource: 'legal.openSource',
  privateMarketingDisclosure: 'legal.privateMarketingDisclosure',
} as const;

const TOUCH_TARGET = 'inline-flex min-h-[24px] min-w-[24px] items-center px-0.5 py-0.5 transition-colors';

/** Η **όψη** ανά επιφάνεια — η λίστα, η σειρά και οι ετικέτες μένουν κοινές. */
const VARIANTS = {
  sidebar: {
    nav: 'px-2 py-1.5 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden',
    list: 'm-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0',
    link: `${TOUCH_TARGET} hover:text-sidebar-foreground hover:underline`,
  },
  standalone: {
    nav: 'text-xs text-muted-foreground',
    list: 'm-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0',
    link: `${TOUCH_TARGET} hover:text-foreground hover:underline`,
  },
  prose: {
    nav: '',
    list: 'flex flex-col gap-1',
    link: 'text-foreground underline underline-offset-4',
  },
} as const;

export function LegalLinksNav({
  variant,
  current,
}: {
  readonly variant: keyof typeof VARIANTS;
  /** Η σελίδα στην οποία βρίσκεται ήδη ο αναγνώστης — `aria-current`, όχι απόκρυψη. */
  readonly current?: LegalRouteId;
}): React.JSX.Element {
  const { t } = useTranslation('navigation');
  const classes = VARIANTS[variant];
  return (
    <nav aria-label={t('legal.legalLinks')} className={classes.nav}>
      <ul className={classes.list}>
        {LEGAL_LINK_ORDER.map((id) => (
          <li key={id}>
            <Link
              href={LEGAL_ROUTES[id]}
              className={classes.link}
              aria-current={id === current ? 'page' : undefined}
            >
              {t(LABEL_KEYS[id])}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
