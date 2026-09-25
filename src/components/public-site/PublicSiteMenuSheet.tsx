'use client';

/**
 * **Το συρτάρι του μενού κινητού** — φορτώνεται δυναμικά από το `PublicSiteMenu` (ADR-809 §9).
 *
 * 🔑 **Τρεις ενότητες, με τη σειρά της πρόθεσης**: Εξερεύνηση (ακτίνες) → Ο χώρος μου (πόρτες
 * + η πράξη) → γλώσσα · θέμα (με δικές τους επικεφαλίδες, ίδιο επίπεδο `h3`). Οι προορισμοί έρχονται από το `public-site-nav.ts`,
 * οι προτιμήσεις από τον **ένα** ιδιοκτήτη τους (`ShellPreferences`, CHECK 3.72 Κ3).
 *
 * ♿ Radix Dialog μέσω του κοινού `ui/sheet`: παγίδα εστίασης, Esc, επιστροφή εστίασης στο
 * «☰ Μενού» (ADR-711), κάλυμμα. Κάθε γραμμή ≥ 44 px (Apple HIG · WCAG 2.5.8 ζητά 24).
 */

import React, { useId } from 'react';

import { Link } from '@/lib/workspace/navigation';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShellPreferences } from '@/core/containers/ShellUtilities';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

import {
  PUBLIC_SITE_DOORS,
  PUBLIC_SITE_PRIMARY_ACTION,
  PUBLIC_SITE_SPOKES,
  type PublicSiteDestination,
} from './public-site-nav';

const ROW_CLASS =
  'flex min-h-11 items-center rounded-md px-3 text-base font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const HEADING_CLASS = 'm-0 px-3 text-sm font-medium text-muted-foreground';

interface MenuSectionProps {
  readonly heading: string;
  readonly items: readonly PublicSiteDestination[];
  readonly onNavigate: () => void;
}

function MenuSection({ heading, items, onNavigate }: MenuSectionProps) {
  const { t } = useTranslation(['search-results', 'property-market']);
  const headingId = useId();
  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className={HEADING_CLASS}>{heading}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className={ROW_CLASS} onClick={onNavigate}>
              {t(item.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface PublicSiteMenuSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function PublicSiteMenuSheet({ open, onOpenChange }: PublicSiteMenuSheetProps) {
  const { t } = useTranslation(['common', 'search-results', 'property-market']);
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{t('common:header.menu.label')}</SheetTitle>
          <SheetDescription className="sr-only">{t('common:header.menu.description')}</SheetDescription>
        </SheetHeader>

        <MenuSection
          heading={t('common:header.menu.explore')}
          items={PUBLIC_SITE_SPOKES}
          onNavigate={close}
        />

        <section className="flex flex-col gap-3">
          <MenuSection
            heading={t('common:header.menu.mine')}
            items={PUBLIC_SITE_DOORS}
            onNavigate={close}
          />
          {/* Η πράξη — ίδια σημασιολογικά tokens με τη μπάρα (αντιστροφή, όχι δεύτερη παλέτα). */}
          <Link
            href={PUBLIC_SITE_PRIMARY_ACTION.href}
            onClick={close}
            className={`flex min-h-11 items-center justify-center rounded-md px-4 text-base font-semibold ${COLOR_BRIDGE.action.primary}`}
          >
            {t(PUBLIC_SITE_PRIMARY_ACTION.labelKey)}
          </Link>
        </section>

        <div className="border-t border-border px-3 pt-4">
          <ShellPreferences />
        </div>
      </SheetContent>
    </Sheet>
  );
}
