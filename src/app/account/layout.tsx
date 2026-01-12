'use client';

/**
 * =============================================================================
 * ACCOUNT HUB LAYOUT - ENTERPRISE LEFT NAVIGATION
 * =============================================================================
 *
 * Enterprise Pattern: Unified account management hub
 * Following Google/Microsoft/Salesforce UX standards
 *
 * Features:
 * - Left navigation with sections
 * - Active state indication
 * - Responsive design (mobile: top nav, desktop: left nav)
 * - Auth gating (protected route)
 *
 * @module app/account/layout
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Settings,
  Bell,
  Shield,
  Lock,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ACCOUNT_ROUTES } from '@/lib/routes';

/**
 * Navigation item configuration
 */
interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

/**
 * Account navigation items - Using centralized routes
 */
const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: ACCOUNT_ROUTES.profile, labelKey: 'account.nav.profile', icon: User },
  { href: ACCOUNT_ROUTES.preferences, labelKey: 'account.nav.preferences', icon: Settings },
  { href: ACCOUNT_ROUTES.notifications, labelKey: 'account.nav.notifications', icon: Bell },
  { href: ACCOUNT_ROUTES.security, labelKey: 'account.nav.security', icon: Shield },
  { href: ACCOUNT_ROUTES.privacy, labelKey: 'account.nav.privacy', icon: Lock },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  return (
    <main className={cn(
      layout.flexColGap4,
      layout.responsivePagePadding,
      layout.minHeightScreen
    )}>
      {/* Page Header */}
      <header>
        <h1 className={cn(
          typography.heading.lg,
          'text-2xl',
          colors.text.primary
        )}>
          {t('account.title')}
        </h1>
        <p className={cn(
          typography.body.sm,
          layout.marginTop1,
          colors.text.muted
        )}>
          {t('account.subtitle')}
        </p>
      </header>

      {/* Main Content Area */}
      <section className={cn(
        'flex flex-col lg:flex-row',
        layout.gap6
      )}>
        {/* Left Navigation */}
        <nav
          aria-label={t('account.nav.ariaLabel')}
          className={cn(
            'w-full lg:w-64 flex-shrink-0'
          )}
        >
          <Card className={cn(
            borders.getElementBorder('card', 'default'),
            'overflow-hidden'
          )}>
            {/* User Identity Card */}
            <header className={cn(
              layout.flexCenterGap4,
              layout.padding4,
              colors.bg.muted,
              'border-b',
              colors.border.primary
            )}>
              <Avatar className="h-12 w-12">
                {user?.photoURL ? (
                  <AvatarImage
                    src={user.photoURL}
                    alt={user.displayName || t('account.defaultUser')}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className={colors.bg.primary}>
                  <User className={iconSizes.md} />
                </AvatarFallback>
              </Avatar>
              <div className={cn(layout.flex1, layout.minW0)}>
                <p className={cn(
                  typography.label.sm,
                  layout.truncate,
                  colors.text.primary
                )}>
                  {user?.displayName || t('account.defaultUser')}
                </p>
                <p className={cn(
                  typography.body.sm,
                  layout.truncate,
                  colors.text.muted
                )}>
                  {user?.email || t('account.noEmail')}
                </p>
              </div>
            </header>

            {/* Navigation Links */}
            <ul className={layout.padding2}>
              {ACCOUNT_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        layout.flexCenterGap2,
                        layout.paddingNavLink,
                        borders.radiusClass.md,
                        layout.transitionColors,
                        isActive
                          ? cn(colors.bg.info, colors.text.info)
                          : cn(
                              colors.text.secondary,
                              'hover:bg-accent hover:text-accent-foreground'
                            )
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className={iconSizes.sm} aria-hidden="true" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </nav>

        {/* Main Content */}
        <article className={cn(layout.flex1, layout.minW0)}>
          {children}
        </article>
      </section>
    </main>
  );
}
