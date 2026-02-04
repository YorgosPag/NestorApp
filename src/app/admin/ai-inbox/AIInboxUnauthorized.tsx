'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldX, LogIn } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PageContainer } from '@/core/containers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/lib/routes';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface AIInboxUnauthorizedProps {
  error: string;
}

export function AIInboxUnauthorized({ error }: AIInboxUnauthorizedProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  return (
    <PageContainer ariaLabel={t('accessDenied.ariaLabel')}>
      <section className={layout.responsivePagePadding}>
        <Card className={layout.cardLgWidth}>
          <CardHeader>
            <CardTitle className={layout.flexCenterGap2}>
              <ShieldX className={`${iconSizes.sm} ${colors.text.destructive}`} />
              {t('accessDenied.title')}
            </CardTitle>
            <CardDescription>{t('accessDenied.description')}</CardDescription>
          </CardHeader>
          <CardContent className={layout.flexColGap2}>
            <p className={`text-sm ${colors.text.muted}`}>{error}</p>
            <div className={layout.flexGap2}>
              <Button asChild variant="default">
                <Link href={AUTH_ROUTES.login}>
                  <LogIn className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
                  {t('accessDenied.login')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={AUTH_ROUTES.home}>{t('accessDenied.home')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}

export default AIInboxUnauthorized;
