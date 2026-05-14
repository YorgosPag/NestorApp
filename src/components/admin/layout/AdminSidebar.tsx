'use client';

/**
 * ADR-347: Admin Console Sidebar
 *
 * Google Admin Console-style navigation sidebar for all /admin/* pages.
 * Desktop: permanent fixed sidebar (w-64). Mobile: Sheet drawer via hamburger.
 * Role-gated: super_admin-only items hidden from other admin roles.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Wrench,
  FileText,
  Archive,
  Settings,
  Database,
  Building2,
  Search,
  Bot,
  MessageSquare,
  Menu,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

export interface AdminSidebarProps {
  isSuperAdmin: boolean;
}

interface SidebarContentProps {
  isSuperAdmin: boolean;
  pathname: string;
  t: (key: string) => string;
}

// =============================================================================
// NAV CONFIG — SSoT for admin navigation structure
// =============================================================================

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'userManagement',
    items: [
      { href: '/admin/role-management', labelKey: 'roleManagement', icon: Users },
      {
        href: '/admin/users/claims-repair',
        labelKey: 'claimsRepair',
        icon: Wrench,
        superAdminOnly: true,
      },
    ],
  },
  {
    groupKey: 'dataAudit',
    items: [
      { href: '/admin/audit-log', labelKey: 'auditLog', icon: FileText },
      { href: '/admin/backup', labelKey: 'backup', icon: Archive },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { href: '/admin/setup', labelKey: 'setup', icon: Settings },
      { href: '/admin/database-update', labelKey: 'databaseUpdate', icon: Database },
      { href: '/admin/enterprise-migration', labelKey: 'enterpriseMigration', icon: Building2 },
      { href: '/admin/search-backfill', labelKey: 'searchBackfill', icon: Search },
    ],
  },
  {
    groupKey: 'communications',
    items: [
      { href: '/admin/ai-inbox', labelKey: 'aiInbox', icon: Bot },
      { href: '/admin/operator-inbox', labelKey: 'operatorInbox', icon: MessageSquare },
    ],
  },
];

// =============================================================================
// SIDEBAR CONTENT — shared between desktop aside and mobile Sheet
// =============================================================================

function SidebarContent({ isSuperAdmin, pathname, t }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Logo / title */}
      <header className="flex items-center gap-3 px-4 py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary flex-shrink-0">
          <Shield aria-hidden="true" className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          {t('sidebar.title')}
        </span>
      </header>

      {/* Navigation */}
      <nav
        aria-label={t('sidebar.title')}
        className="flex-1 overflow-y-auto py-3 px-2 space-y-4"
      >
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <section
              key={group.groupKey}
              aria-label={t(`sidebar.nav.${group.groupKey}`)}
            >
              <p className="px-3 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                {t(`sidebar.nav.${group.groupKey}`)}
              </p>
              <ul className="space-y-0.5" role="list">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        <span>{t(`sidebar.nav.${item.labelKey}`)}</span>
                        {item.superAdminOnly && (
                          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded">
                            SA
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AdminSidebar({ isSuperAdmin }: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation('admin');
  const pathname = usePathname();

  const contentProps: SidebarContentProps = { isSuperAdmin, pathname, t };

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <aside
        aria-label={t('sidebar.title')}
        className="hidden lg:flex flex-col w-64 border-r border-gray-200 flex-shrink-0 h-full"
      >
        <SidebarContent {...contentProps} />
      </aside>

      {/* Mobile: hamburger → Sheet drawer */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('sidebar.openMenu')}
              className="fixed top-3 left-3 z-40 h-9 w-9 bg-white shadow-md border border-gray-200 rounded-lg"
            >
              <Menu aria-hidden="true" className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">{t('sidebar.title')}</SheetTitle>
            <SidebarContent {...contentProps} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
