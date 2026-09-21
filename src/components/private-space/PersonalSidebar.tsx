'use client';

/**
 * **Η στήλη του προσωπικού χώρου** — «τα δικά μου», πάντα ορατά.
 *
 * @related ADR-871 (§5 απόφαση · §10 υλοποίηση) · ADR-777 §8.12 (CHECK 3.52) · ADR-797 (CHECK 3.63)
 * @module components/private-space/PersonalSidebar
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΙΔΙΟ ΟΠΤΙΚΟ ΣΥΣΤΗΜΑ ΜΕ ΤΟ ΓΡΑΦΕΙΟ, ΑΛΛΟ ΠΕΡΙΕΧΟΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κοινά με το `AppSidebar`: το primitive (`ui/sidebar`), το `SidebarMenuSection`, το
 * `SidebarLogo`, το `LegalLinksNav`, το `useSidebarState`. Δικός του **μόνο** ο
 * κατάλογος (`config/personal-navigation`).
 *
 * ⛔ **ΔΕΝ εισάγει το `AppSidebar`** (CHECK 3.52 Κ3) και **κανέναν** από τους 9 βαρείς
 * providers του `(app)` — το `(me)` υπάρχει επειδή είναι −41% έως −59% ελαφρύτερο.
 * ⛔ **ΔΕΝ περιέχει τον διακόπτη χώρου** — μένει στο `UserMenu` (ADR-820).
 */

import React from 'react';

import { useAuth } from '@/auth';
import { LegalLinksNav } from '@/components/legal/LegalLinksNav';
import { SidebarLogo } from '@/components/sidebar/sidebar-logo';
import { SidebarMenuSection } from '@/components/sidebar/sidebar-menu-section';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { PERSONAL_PRIMARY_ACTION, resolvePersonalNavigation } from '@/config/personal-navigation';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';

/** Η κύρια πράξη, πάνω από την πλοήγηση — εικονίδιο με tooltip όταν η στήλη είναι συμπτυγμένη. */
function PrimaryAction({ label }: Readonly<{ label: string }>): React.JSX.Element {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = PERSONAL_PRIMARY_ACTION.icon;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={label} className={`font-semibold ${COLOR_BRIDGE.action.primary}`}>
          <Link
            href={PERSONAL_PRIMARY_ACTION.href}
            onClick={() => { if (isMobile) setOpenMobile(false); }}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function PersonalSidebar(): React.JSX.Element {
  const { t } = useTranslation(['navigation', 'property-market']);
  const { user, loading } = useAuth();
  const { expandedItems, toggleExpanded, isItemActive } = useSidebarState();

  // `null` όσο η ταυτότητα δεν έχει λυθεί — ο κατάλογος τότε κρύβει ό,τι εξαρτάται
  // από τον οργανισμό (ADR-871 §10.3 Υ5).
  const groups = resolvePersonalNavigation(
    loading || user === null ? null : { companyId: user.companyId },
    'sidebar',
  );
  const lastIndex = groups.length - 1;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarLogo />
        <PrimaryAction label={t(PERSONAL_PRIMARY_ACTION.labelKey)} />
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={t('personal.sidebarLabel')} className="flex min-h-0 flex-1 flex-col">
          {groups.map((group, index) => (
            <SidebarMenuSection
              key={group.id}
              label={t(group.labelKey)}
              items={[...group.items]}
              expandedItems={expandedItems}
              onToggleExpanded={toggleExpanded}
              isItemActive={isItemActive}
              // Ο λογαριασμός κάθεται στη βάση, όπως οι ρυθμίσεις στο γραφείο.
              className={index === lastIndex ? 'mt-auto' : undefined}
            />
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <LegalLinksNav variant="sidebar" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
