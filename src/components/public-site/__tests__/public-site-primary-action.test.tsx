/**
 * @fileoverview **ΤΟ CTA ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΕΦΑΛΙΔΑΣ** — πράξη, όχι πλοήγηση (ADR-660 §5.11, στάδιο Β).
 * @related components/public-site/PublicSiteHeader.tsx
 *
 * 🔑 Μεταφέρθηκε από το `shared/__tests__/desktop-only-exit.test.tsx` (2026-10-02, ADR-900 §8 #3): η ομάδα **Τ**
 * εκεί έκρινε την έξοδο της πύλης Α8 στο κινητό — η πύλη **καταργήθηκε** (οι φόρμες ανοίγουν σε κάθε πλάτος),
 * άρα η Τ έφυγε μαζί της. Η **Υ** κρίνει την κεφαλίδα, που μένει· οι άγκυρες είναι αυτούσιες.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ⚠️ **ΚΑΙ ΤΟ `i18n`, ΟΧΙ ΜΟΝΟ ΤΟ `t`.** Το `Υ` αποδίδει την **πραγματική** δημόσια
// κεφαλίδα, που κουβαλά τον επιλογέα γλώσσας (`ShellUtilities → language-switcher`), και
// εκείνος διαβάζει `i18n.language` σε `useEffect`. Διπλό μόνο με `t` έδινε
// `TypeError: Cannot read properties of undefined (reading 'language')` — δηλαδή η άγκυρα
// θα κοκκίνιζε για **λείπον διπλό**, όχι για λάθος συμπεριφορά.
// 🔑 Ίδιο σχήμα με το `personal-custody-notice.test.tsx` — ένα διπλό `useTranslation`, όχι δύο.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// 🔴 **ΜΟΝΟ ο δρομολογητής διπλασιάζεται — ΠΟΤΕ ολόκληρο το σύνορο πλοήγησης.**
//
// Το `Υ` αποδίδει την **αληθινή** `PublicSiteHeader`, της οποίας το κέλυφος καλεί
// `useRouter()`· έξω από το Next runtime εκείνο πετά *«invariant expected app router to
// be mounted»*. Το καθιερωμένο διπλό του repo (`shell-utilities-identity.test.tsx`)
// αντικαθιστά **όλο** το module — και μαζί το `Link` με `<span>`.
//
// ⛔ **Εδώ αυτό θα έσβηνε την ίδια την ερώτηση**: και οι τρεις άγκυρες κρίνουν
// `href` πάνω σε **`<a>`** *(«πού πάει η πόρτα;»)*. Με `<span>` θα γίνονταν πράσινες
// χωρίς να κοιτάξουν τίποτα — φρουρός χωρίς απόδειξη ζωής (ADR-749 §5).
//
// ⇒ `requireActual` κρατά το πραγματικό `Link` / `usePathname`, και **μόνο** το
// `useRouter` γίνεται κενό: είναι το μόνο κομμάτι που απαιτεί χρόνο εκτέλεσης Next.
jest.mock('@/lib/workspace/navigation', () => ({
  ...jest.requireActual('@/lib/workspace/navigation'),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import { PublicSiteHeader } from '@/components/public-site/PublicSiteHeader';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';

describe('Υ — το CTA της δημόσιας κεφαλίδας', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: null }));

  it('Υ1 — υπάρχει, και δείχνει στη ΦΟΡΜΑ (πράξη, όχι πλοήγηση)', () => {
    render(<PublicSiteHeader />);

    const cta = screen.getByText('property-market:offer.door.cta').closest('a');
    expect(cta).toHaveAttribute('href', NEW_OFFER_ROUTE);
  });

  it('Υ2 — 🔴 ΞΕΧΩΡΙΖΕΙ ΟΠΤΙΚΑ από τους συνδέσμους πλοήγησης', () => {
    render(<PublicSiteHeader />);

    const cta = screen.getByText('property-market:offer.door.cta').closest('a');
    const navLink = screen.getByText('property-market:offer.door.label').closest('a');

    // Η idealista το κάνει **κουμπί**, ξεχωριστό από τη πλοήγηση. Ένα τέταρτο
    // πανομοιότυπο ορθογώνιο δεν είναι CTA — είναι τέταρτος σύνδεσμος.
    expect(cta?.className).not.toBe(navLink?.className);
    expect(cta?.className).toContain('bg-foreground');
    expect(cta?.className).toContain('text-background');
  });

  it('Υ3 — οι δύο πόρτες πλοήγησης ΜΕΝΟΥΝ στους καταλόγους', () => {
    render(<PublicSiteHeader />);

    expect(screen.getByText('property-market:offer.door.label').closest('a')).toHaveAttribute(
      'href',
      MY_OFFERS_ROUTE,
    );
    expect(screen.getByText('property-market:demand.door.label').closest('a')).toHaveAttribute(
      'href',
      '/demands',
    );
  });
});
