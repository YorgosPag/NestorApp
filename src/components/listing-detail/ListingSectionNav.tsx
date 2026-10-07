'use client';

/**
 * @fileoverview **Η μπάρα ενοτήτων της αγγελίας** — κολλά στην κορυφή και λέει πού βρίσκεσαι (ADR-907 Φ2β-1).
 * @module components/listing-detail/ListingSectionNav
 * @related hooks/useActiveSection · lib/a11y/active-section · components/ui/scroll-rail · ListingDetailContent (οι ενότητες)
 *
 * 📚 Zillow · Idealista: στοιχεία και τιμές περιοχής **δεν** κρύβονται σε καρτέλες — μία κύλιση, και μια μπάρα που πηδά
 * στις ενότητες. Όλο το περιεχόμενο μένει στο έγγραφο (αναζήτηση στη σελίδα, εκτύπωση, μηχανές αναζήτησης).
 *
 * 🔑 **Πραγματικοί σύνδεσμοι `#…`**: χωρίς JavaScript πηδούν κανονικά. Με JavaScript η κύλιση σέβεται τη ρύθμιση
 * κίνησης (`revealInScroll`) και η εστίαση πηγαίνει **στην ενότητα**, ώστε το επόμενο Tab να συνεχίζει από εκεί — όχι
 * από τη μπάρα. Η διεύθυνση δεν αλλάζει: έξι πατήματα δεν γίνονται έξι βήματα «πίσω».
 *
 * 🔑 **Η λίστα των ενοτήτων είναι ΜΙΑ** ({@link LISTING_SECTIONS}): η μπάρα και οι άγκυρες της σελίδας
 * ({@link ListingSectionAnchor}) διαβάζουν την ίδια, άρα σύνδεσμος χωρίς στόχο δεν γράφεται.
 */

import React, { useCallback, useState } from 'react';

import { ScrollRail } from '@/components/ui/scroll-rail';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import { cn } from '@/lib/utils';

/** Οι ενότητες της σελίδας, **με τη σειρά του εγγράφου**. */
export const LISTING_SECTIONS = ['media', 'price', 'details', 'location', 'market', 'legal'] as const;
export type ListingSection = (typeof LISTING_SECTIONS)[number];

export function listingSectionId(section: ListingSection): string {
  return `listing-section-${section}`;
}

const SECTION_IDS: readonly string[] = LISTING_SECTIONS.map(listingSectionId);

/** Πόσο κάτω από τη μπάρα περνά η γραμμή ανάγνωσης — καλύπτει το `scroll-mt-16` της άγκυρας (μπάρα 44px + ανάσα). */
const READING_LINE_GAP_PX = 24;

const CURRENT_SELECTOR = '[aria-current="location"]';

/**
 * Η ενότητα που στο `lg` **κολλά** δίπλα στα μέσα (η σύνοψη τιμής, `ListingDetailContent`). Εκεί είναι πάντα σε θέα, άρα
 * σύνδεσμος προς αυτήν δεν οδηγεί πουθενά — και το `useActiveSection` δεν τη μετρά ως θέση. Σε μία στήλη υπάρχει κανονικά.
 */
const STICKY_FROM_LG: ListingSection = 'price';

export interface ListingSectionAnchorProps {
  readonly section: ListingSection;
  /** `aside` για τη σύνοψη τιμής — ό,τι άλλο είναι ουδέτερο δοχείο γύρω από ενότητες που έχουν ήδη δική τους σημασιολογία. */
  readonly as?: 'div' | 'aside';
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * Ο **στόχος** ενός συνδέσμου της μπάρας. `scroll-mt-16`: η ενότητα σταματά κάτω από την κολλημένη μπάρα, όχι πίσω της.
 * `tabIndex={-1}`: δέχεται εστίαση από τον σύνδεσμο, χωρίς να μπαίνει στη σειρά του Tab.
 */
export function ListingSectionAnchor({ section, as: Tag = 'div', className, children }: ListingSectionAnchorProps) {
  return (
    <Tag id={listingSectionId(section)} tabIndex={-1} className={cn('scroll-mt-16 outline-none', className)}>
      {children}
    </Tag>
  );
}

/** Απλό αριστερό κλικ — ό,τι άλλο (νέα καρτέλα, μεσαίο κουμπί) το αφήνουμε στον browser. */
function isPlainClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function goToSection(event: React.MouseEvent, id: string): void {
  const target = document.getElementById(id);
  if (target === null || !isPlainClick(event)) return;
  event.preventDefault();
  revealInScroll(target, { urgency: 'requested', block: 'start' });
  target.focus({ preventScroll: true });
}

export function ListingSectionNav() {
  const { t } = useTranslation(['listing-detail']);
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const lineOf = useCallback(() => (bar?.getBoundingClientRect().bottom ?? 0) + READING_LINE_GAP_PX, [bar]);
  const active = useActiveSection(SECTION_IDS, lineOf);

  // Κυριολεκτικά κλειδιά, ένα ανά ενότητα: ο γεννήτορας του route slice τα βλέπει στατικά (CHECK 3.34).
  const labels: Record<ListingSection, string> = {
    media: t('listing-detail:sections.media'),
    price: t('listing-detail:sections.price'),
    details: t('listing-detail:sections.details'),
    location: t('listing-detail:sections.location'),
    market: t('listing-detail:sections.market'),
    legal: t('listing-detail:sections.legal'),
  };

  return (
    <nav
      ref={setBar}
      aria-label={t('listing-detail:sections.label')}
      className="sticky top-0 z-[var(--z-index-sticky)] mt-3 border-b border-border bg-background"
    >
      <ScrollRail
        as="ul"
        prevLabel={t('listing-detail:sections.previous')}
        nextLabel={t('listing-detail:sections.next')}
        revealSelector={CURRENT_SELECTOR}
        revealKey={active}
        className="items-stretch gap-1"
      >
        {LISTING_SECTIONS.map((section) => {
          const id = listingSectionId(section);
          const current = id === active;
          return (
            <li key={section} className={cn('shrink-0', section === STICKY_FROM_LG && 'lg:hidden')}>
              <a
                href={`#${id}`}
                aria-current={current ? 'location' : undefined}
                onClick={(event) => goToSection(event, id)}
                className={cn(
                  'inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm',
                  current
                    ? 'border-foreground font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {labels[section]}
              </a>
            </li>
          );
        })}
      </ScrollRail>
    </nav>
  );
}
