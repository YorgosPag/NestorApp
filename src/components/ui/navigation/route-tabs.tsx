'use client';

/**
 * RouteTabs — pathname-driven wrapper around `BaseTabs` (ADR-328 Phase I).
 *
 * Mirrors the original `TabsNav variant='radix'` behavior: each tab is bound
 * to an `href`; the active tab is derived from `usePathname()` via
 * `isTabActive`/`findActiveHref`, and tab changes call `router.push(href)`.
 *
 * Use `StateTabs` instead when tabs are local in-page state (no URL).
 *
 * @see ADR-328 §RouteTabs API
 * @see ADR-267 §Phase F — Sub-nav SSoT extraction
 */

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { BaseTabs } from './base-tabs';
import type { BaseTabDef, TabsNavTab } from './tabs-types';

export interface RouteTabsProps {
  tabs: readonly TabsNavTab[];
  i18nNamespace: string;
  ariaLabel: string;
  className?: string;
}

export function isTabActive(pathname: string, tab: TabsNavTab): boolean {
  if (tab.exactMatch) return pathname === tab.href;
  if (!pathname.startsWith(tab.href)) return false;
  return !tab.excludeStartsWith?.some((p) => pathname.startsWith(p));
}

export function findActiveHref(
  pathname: string,
  tabs: readonly TabsNavTab[],
): string | undefined {
  return tabs.find((tab) => isTabActive(pathname, tab))?.href;
}

export function RouteTabs({
  tabs,
  i18nNamespace,
  ariaLabel,
  className,
}: RouteTabsProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { t } = useTranslation(i18nNamespace);

  const activeHref = findActiveHref(pathname, tabs) ?? '';

  const baseTabs: BaseTabDef[] = tabs.map((tab) => ({
    id: tab.href,
    label: t(tab.labelKey),
    icon: tab.icon,
    iconColor: tab.iconColor,
  }));

  return (
    <BaseTabs
      tabs={baseTabs}
      value={activeHref}
      onValueChange={(href) => router.push(href)}
      ariaLabel={ariaLabel}
      className={cn('mb-2', className)}
      alwaysShowLabels
    >
      <></>
    </BaseTabs>
  );
}
