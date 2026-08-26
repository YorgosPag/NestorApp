'use client';

/**
 * =============================================================================
 * NOT FOUND PAGE - ENTERPRISE 404 ERROR PAGE
 * =============================================================================
 *
 * Enterprise Pattern: Centralized design tokens + i18n
 * - Uses centralized layout hooks (useLayoutClasses)
 * - Uses centralized typography hooks (useTypography)
 * - Uses centralized color hooks (useSemanticColors)
 * - Uses centralized route constants (HOME_REDIRECT_ROUTE — ADR-819 §8)
 * - Uses i18n translations (useTranslation)
 * - Uses shadcn/ui Button component
 *
 * @module app/not-found
 * @enterprise ADR-024 - Zero Hardcoded Values
 */

import { Link } from '@/lib/workspace/navigation';
import { Button } from '@/components/ui/button';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';
import '@/lib/design-system';

/**
 * Enterprise 404 Not Found Page
 *
 * Features:
 * - Centralized design tokens (zero hardcoded Tailwind classes)
 * - Full i18n support
 * - Accessible exit that the **server** resolves (ADR-819 §8)
 * - Theme-aware styling via semantic colors
 */
export default function NotFound() {
  const layout = useLayoutClasses();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { t } = useTranslation('errors');

  return (
    <main
      className={`${layout.shellAuthStandalone} ${layout.padding4}`}
      role="main"
      aria-labelledby="not-found-title"
    >
      <section className={`${layout.textCenter} ${layout.flexColGap4}`}>
        {/* 404 Title */}
        <h1
          id="not-found-title"
          className={`${typography.heading.xl} ${colors.text.muted}`}
        >
          {t('notFound.title')}
        </h1>

        {/* Message */}
        <p className={`${typography.body.base} ${colors.text.secondary}`}>
          {t('notFound.message')}
        </p>

        {/*
          * 🔴 ADR-819 §8 — ΕΔΩ ΕΓΡΑΦΕ `AUTH_ROUTES.login`, ΚΑΙ ΗΤΑΝ ΑΔΙΕΞΟΔΟ.
          *
          * Μετρημένο στην οθόνη 2026-08-26: ο `int.architect@alpha.local`, σε
          * παλιό σελιδοδείκτη ξένου χώρου, έβλεπε 404 **με το κέλυφός του
          * γύρω-γύρω** (sidebar, όνομα, μενού λογαριασμού) και μόνη έξοδο μια
          * σύνδεση που **είχε ήδη κάνει**.
          *
          * ⚠️ **Ο προορισμός ΔΕΝ αποφασίζεται εδώ, και δεν είναι λεπτομέρεια**:
          *    αυτό είναι client component, και η άγκυρα **Λ2** απαγορεύει στον
          *    πελάτη να μαντεύει τον χώρο από claims — *claim που ανακλήθηκε
          *    δίνει σύνδεσμο προς γραφείο όπου δεν είσαι μέλος*, δηλαδή το
          *    κουμπί εξόδου θα οδηγούσε σε **νέο 404**. Αποφασίζει ο
          *    διακομιστής, στο `app/home/route.ts`.
          *
          * ⚠️ **Η ετικέτα είναι ουδέτερη ΕΠΙΤΗΔΕΣ**: η ίδια σελίδα σερβίρεται
          *    και σε **ανώνυμο** επισκέπτη, για τον οποίο η σύνδεση είναι ο
          *    σωστός προορισμός. Ένα κουμπί, δύο σωστές απαντήσεις — και το
          *    στατικό HTML δεν χρειάζεται να ξέρει ποια από τις δύο ισχύει.
          */}
        <div className={layout.marginTop1}>
          <Button asChild className={layout.widthFull} size="lg">
            <Link href={HOME_REDIRECT_ROUTE}>
              {t('notFound.backHome')}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}






