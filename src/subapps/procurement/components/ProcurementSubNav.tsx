'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const TABS = [
  { href: '/procurement',        labelKey: 'nav.purchaseOrders' },
  { href: '/procurement/quotes', labelKey: 'nav.quotes'         },
] as const;

export function ProcurementSubNav() {
  const pathname = usePathname();
  const { t } = useTranslation('procurement');

  return (
    <nav aria-label="Procurement sub-navigation" className="flex gap-1 border-b pb-0 mb-2">
      {TABS.map(({ href, labelKey }) => {
        const active = href === '/procurement'
          ? pathname === '/procurement'
          : pathname.startsWith(href) && !pathname.startsWith('/procurement/quotes/scan') && !pathname.includes('/review');

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              active
                ? 'border border-b-background bg-background text-foreground -mb-px'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
