/**
 * 🧪 Debug Hub
 * @route /debug
 * Development-only navigation entry point for diagnostics.
 */
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/core/containers';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { cn, getSpacingClass } from '@/lib/design-system';

export default function DebugHubPage() {
  const { t } = useTranslation('common');
  const layout = useLayoutClasses();
  const typography = useTypography();
  const colors = useSemanticColors();
  const sectionGap = getSpacingClass('m', 'md', 'b');

  return (
    <PageContainer ariaLabel={t('debug.title')}>
      <section className={cn(layout.responsivePagePadding, sectionGap)}>
        <Card className={layout.cardLgWidth}>
          <CardHeader>
            <CardTitle className={typography.heading.lg}>{t('debug.title')}</CardTitle>
            <CardDescription>{t('debug.description')}</CardDescription>
          </CardHeader>
          <CardContent className={layout.flexColGap2}>
            <Link className={colors.text.primary} href="/debug/token-info">
              {t('debug.links.tokenInfo')}
            </Link>
            <p className={typography.body.sm}>
              {t('debug.note')}
            </p>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
