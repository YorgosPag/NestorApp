'use client';

/**
 * TabsNav — SSoT top-level navigation tabs (domain sub-navigation)
 *
 * Riusabile per qualsiasi sezione che esponga sub-routes a livello di dominio
 * (es. Procurement: Παραγγελίες | Προσφορές).
 * Differente da EntityTabs (interni a detail panel).
 *
 * @see ADR-267 §Phase F — Sub-nav SSoT extraction
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface TabsNavTab {
  href: string;
  labelKey: string;
  exactMatch?: boolean;
  excludeStartsWith?: readonly string[];
}

interface TabsNavProps {
  tabs: readonly TabsNavTab[];
  i18nNamespace: string;
  ariaLabel: string;
  className?: string;
}

function isTabActive(pathname: string, tab: TabsNavTab): boolean {
  if (tab.exactMatch) return pathname === tab.href;
  if (!pathname.startsWith(tab.href)) return false;
  return !tab.excludeStartsWith?.some((p) => pathname.startsWith(p));
}

export function TabsNav({ tabs, i18nNamespace, ariaLabel, className }: TabsNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation(i18nNamespace);

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
