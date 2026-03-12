'use client';

/**
 * Module Breadcrumb Component
 * Auto-generates breadcrumb path for module/dashboard pages
 *
 * ADR-016: Two types of breadcrumb:
 * 1. NavigationBreadcrumb — Entity hierarchy (Company → Project → Building → Unit)
 * 2. ModuleBreadcrumb — Module path (Αρχική → CRM → Εργασίες)
 *
 * Visual style matches NavigationBreadcrumb for consistency.
 * Uses semantic Tailwind colors for light/dark theme support.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Maps URL path segments to i18n keys under navigation.module.*
 * Covers all module/dashboard routes that need breadcrumbs.
 */
const SEGMENT_LABEL_MAP: Record<string, string> = {
  // CRM
  'crm': 'module.crm',
  'dashboard': 'module.crmDashboard',
  'tasks': 'module.tasks',
  'calendar': 'module.calendar',
  'leads': 'module.leads',
  'pipeline': 'module.pipeline',
  'communications': 'module.communications',
  'teams': 'module.teams',
  'notifications': 'module.notifications',
  'email-analytics': 'module.emailAnalytics',
  // Sales, Spaces
  'sales': 'module.sales',
  'spaces': 'module.spaces',
  // Obligations, Contacts
  'obligations': 'module.obligations',
  'contacts': 'module.contacts',
  // Accounting
  'accounting': 'module.accounting',
  'setup': 'module.setup',
  'invoices': 'module.invoices',
  'journal': 'module.journal',
  'vat': 'module.vat',
  'bank': 'module.bank',
  'efka': 'module.efka',
  'assets': 'module.assets',
  'documents': 'module.documents',
  'reports': 'module.reports',
  // Account
  'account': 'module.account',
  'profile': 'module.profile',
  'preferences': 'module.preferences',
  'privacy': 'module.privacy',
  'security': 'module.security',
  // Admin
  'admin': 'module.admin',
  'ai-inbox': 'module.aiInbox',
  'operator-inbox': 'module.operatorInbox',
};

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface ModuleBreadcrumbProps {
  className?: string;
}

export function ModuleBreadcrumb({ className }: ModuleBreadcrumbProps) {
  const pathname = usePathname();
  const { t } = useTranslation('navigation');

  // Don't render on home page
  if (!pathname || pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  // Build breadcrumb items from path segments
  const items: BreadcrumbSegment[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const labelKey = SEGMENT_LABEL_MAP[segment];
    if (labelKey) {
      items.push({
        label: t(labelKey),
        href: currentPath,
      });
    }
  }

  // No mappable segments found
  if (items.length === 0) return null;

  return (
    <nav
      className={`hidden sm:flex items-center gap-2 text-sm ${className ?? ''}`}
      aria-label="Module breadcrumb"
    >
      {/* Home — always first */}
      <Link
        href="/"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>{t('module.home')}</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.href}>
            <span className="text-muted-foreground/50" aria-hidden="true">
              /
            </span>
            {isLast ? (
              <span
                className="text-foreground font-medium"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
