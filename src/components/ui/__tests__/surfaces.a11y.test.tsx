/**
 * ADR-598 G11 — axe στις επιφάνειες-κελύφη της ρίζας του `ui/`: η κάρτα auth και το βάθος επιφάνειας.
 *
 * Το `surface-context` δεν αποδίδει DOM — αποδίδει **επίπεδο επικεφαλίδας**. Άρα η ουσιαστική
 * σάρωση δεν είναι «mount χωρίς σφάλμα» αλλά το **outline**: μια σελίδα `h1 → h2`, ένα κέλυφος
 * στο βάθος 0 (`h3`) και ένα εμφωλευμένο στο βάθος 1 (`h4`) πρέπει να περνούν τον κανόνα
 * `heading-order` του axe. Αυτό ακριβώς το σχήμα έσπαγε πριν υπάρξει το module (`h3` μέσα σε
 * `h3`, ADR-710 §11). Ο κανόνας είναι `best-practice`, άρα ενεργοποιείται ρητά εδώ.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { expectNoA11yViolations, HEADING_OUTLINE_RULES } from '@/test-utils/a11y';

import { AuthCardSection } from '../auth-card-section';
import { SurfaceBoundary, useHeadingTag } from '../surface-context';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

/** Ένα ελάχιστο κέλυφος όπως το `ReportSection` / `ChartPlot`: τίτλος στο επίπεδό του, παιδιά ένα βαθύτερα. */
function Shell({ title, children }: { readonly title: string; readonly children?: React.ReactNode }) {
  const Heading = useHeadingTag();
  return (
    <section aria-label={title}>
      <Heading>{title}</Heading>
      <SurfaceBoundary>{children}</SurfaceBoundary>
    </section>
  );
}

describe('AuthCardSection a11y', () => {
  it.each([3, 4, 5] as const)('κάρτα με επικεφαλίδα και φόρμα (gap %i)', async (gap) => {
    await expectNoA11yViolations(
      <main>
        <AuthCardSection gap={gap} aria-labelledby="invite-title">
          <h1 id="invite-title">Πρόσκληση σε χώρο εργασίας</h1>
          <p>Σας προσκάλεσαν στο γραφείο «Νέστωρ».</p>
          <form>
            <label htmlFor="invite-email">Email</label>
            <input id="invite-email" type="email" autoComplete="email" />
            <button type="submit">Αποδοχή</button>
          </form>
        </AuthCardSection>
      </main>,
    );
  });

  it('η κάρτα ονομάζεται από τον τίτλο της', () => {
    render(
      <AuthCardSection aria-labelledby="t">
        <h1 id="t">Προτιμήσεις email</h1>
      </AuthCardSection>,
    );
    expect(screen.getByRole('region', { name: 'Προτιμήσεις email' })).toBeInTheDocument();
  });
});

describe('surface-context a11y — το outline επικεφαλίδων', () => {
  it('σελίδα h1 → h2 → κέλυφος h3 → εμφωλευμένο κέλυφος h4', async () => {
    const { container } = render(
      <main>
        <h1>Χρηματοοικονομικά</h1>
        <h2>Αναφορές</h2>
        <Shell title="Ταμειακές ροές">
          <Shell title="Λήξεις δανείων" />
        </Shell>
      </main>,
    );

    expect(screen.getByRole('heading', { name: 'Ταμειακές ροές' }).tagName).toBe('H3');
    expect(screen.getByRole('heading', { name: 'Λήξεις δανείων' }).tagName).toBe('H4');
    await expectNoA11yViolations(container, HEADING_OUTLINE_RULES);
  });

  it('στο βαθύτερο σημείο κόβεται στο h6 — ποτέ άκυρο h7', async () => {
    const { container } = render(
      <main>
        <h1>α</h1>
        <h2>β</h2>
        <Shell title="3">
          <Shell title="4">
            <Shell title="5">
              <Shell title="6">
                <Shell title="7" />
              </Shell>
            </Shell>
          </Shell>
        </Shell>
      </main>,
    );

    expect(screen.getByRole('heading', { name: '7' }).tagName).toBe('H6');
    await expectNoA11yViolations(container, HEADING_OUTLINE_RULES);
  });
});
