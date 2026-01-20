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
 * - Uses centralized route constants (AUTH_ROUTES)
 * - Uses i18n translations (useTranslation)
 * - Uses shadcn/ui Button component
 *
 * @module app/not-found
 * @enterprise ADR-024 - Zero Hardcoded Values
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AUTH_ROUTES } from '@/lib/routes';

/**
 * Enterprise 404 Not Found Page
 *
 * Features:
 * - Centralized design tokens (zero hardcoded Tailwind classes)
 * - Full i18n support
 * - Accessible navigation back to login
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
          className={`${typography.heading.lg} ${colors.text.muted}`}
          style={{ fontSize: '6rem', lineHeight: 1 }}
        >
          {t('notFound.title')}
        </h1>

        {/* Message */}
        <p className={`${typography.body.base} ${colors.text.secondary}`}>
          {t('notFound.message')}
        </p>

        {/* Back to Login Button */}
        <div className={layout.marginTop1}>
          <Button asChild className={layout.widthFull} size="lg">
            <Link href={AUTH_ROUTES.login}>
              {t('notFound.backToLogin')}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
