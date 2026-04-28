'use client';

/**
 * TabsNav — SSoT top-level navigation tabs (domain sub-navigation)
 *
 * Riusabile per qualsiasi sezione che esponga sub-routes a livello di dominio
 * (es. Procurement: Παραγγελίες | Προσφορές).
 * Differente da EntityTabs (interni a detail panel).
 *
 * Due varianti visive:
 * - `link` (default, backward compat): Next.js `<Link>` styled as tabs con
 *   border-bottom underline pattern.
 * - `radix`: usa Radix `Tabs/TabsList/TabsTrigger` (`@/components/ui/tabs`) per
 *   pieno allineamento visivo con i Trigger Tabs centralizzati usati in tutta
 *   l'app (15+ posti). `onValueChange` fa `router.push(href)` mantenendo il
 *   routing per-page (deep-link, SEO preservati).
 *
 * @see ADR-267 §Phase F — Sub-nav SSoT extraction
 * @see src/components/ui/navigation/TabsComponents.tsx — TabsContainer SSoT (in-page tabs)
 */

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

export interface TabsNavTab {
  href: string;
  labelKey: string;
  exactMatch?: boolean;
  excludeStartsWith?: readonly string[];
  /** Optional icon (rendered only in `radix` variant for visual parity with Trigger Tabs SSoT). */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  /** Optional Tailwind color class for the icon (e.g. `text-orange-600`). */
  iconColor?: string;
}

interface TabsNavProps {
  tabs: readonly TabsNavTab[];
  i18nNamespace: string;
  ariaLabel: string;
  className?: string;
  /**
   * Visual variant.
   * - `link` (default): Next.js Link styled as tabs (route-based, backward compat).
   * - `radix`: Radix TabsList/TabsTrigger styled, navigation via router.push.
   */
  variant?: 'link' | 'radix';
}

function isTabActive(pathname: string, tab: TabsNavTab): boolean {
  if (tab.exactMatch) return pathname === tab.href;
  if (!pathname.startsWith(tab.href)) return false;
  return !tab.excludeStartsWith?.some((p) => pathname.startsWith(p));
}

function findActiveHref(pathname: string, tabs: readonly TabsNavTab[]): string | undefined {
  return tabs.find((tab) => isTabActive(pathname, tab))?.href;
}

export function TabsNav({
  tabs,
  i18nNamespace,
  ariaLabel,
  className,
  variant = 'link',
}: TabsNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation(i18nNamespace);
  const iconSizes = useIconSizes();

  if (variant === 'radix') {
    const activeHref = findActiveHref(pathname, tabs);
    return (
      <Tabs
        value={activeHref}
        onValueChange={(href) => router.push(href)}
        className={cn('w-full mb-2', className)}
        aria-label={ariaLabel}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.href}
              value={tab.href}
              className={cn('flex items-center gap-1', INTERACTIVE_PATTERNS.PRIMARY_HOVER)}
            >
              {tab.icon
                ? React.createElement(tab.icon, {
                    className: cn(iconSizes.sm, tab.iconColor),
                  })
                : null}
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex gap-1 border-b pb-0 mb-2 overflow-x-auto', className)}
    >
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap',
              active
                ? 'border border-b-background bg-background text-foreground -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
