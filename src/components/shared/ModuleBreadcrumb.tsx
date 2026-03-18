'use client';

/**
 * Module Breadcrumb Component
 * Auto-generates breadcrumb path for module/dashboard pages
 *
 * ADR-016: Two types of breadcrumb:
 * 1. NavigationBreadcrumb — Entity hierarchy (Company → Project → Building → Unit)
 * 2. ModuleBreadcrumb — Module path (Αρχική → CRM → Εργασίες)
 *
 * Visual style matches NavigationBreadcrumb for consistency:
 * - Arrow separator (→)
 * - Colored icons per module
 * - Semantic Tailwind colors for light/dark theme support
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BarChart,
  ClipboardList,
  CalendarDays,
  Target,
  Filter,
  Phone,
  DollarSign,
  Layout,
  Scale,
  Users,
  Calculator,
  Settings,
  User,
  Shield,
  Lock,
  Bell,
  Inbox,
  Headphones,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Config per URL segment: i18n key, icon, and color class.
 * Matches NavigationBreadcrumb pattern (colored icons + entity-specific styling).
 */
const SEGMENT_CONFIG: Record<string, { labelKey: string; icon: LucideIcon; color: string }> = {
  // CRM
  'crm':            { labelKey: 'module.crm',            icon: BarChart,     color: 'text-purple-400' },
  'dashboard':      { labelKey: 'module.crmDashboard',   icon: BarChart,     color: 'text-purple-400' },
  'tasks':          { labelKey: 'module.tasks',           icon: ClipboardList, color: 'text-blue-400' },
  'calendar':       { labelKey: 'module.calendar',        icon: CalendarDays, color: 'text-sky-400' },
  'leads':          { labelKey: 'module.leads',           icon: Target,       color: 'text-amber-400' },
  'pipeline':       { labelKey: 'module.pipeline',        icon: Filter,       color: 'text-orange-400' },
  'communications': { labelKey: 'module.communications',  icon: Phone,        color: 'text-teal-400' },
  'teams':          { labelKey: 'module.teams',           icon: Users,        color: 'text-indigo-400' },
  'notifications':  { labelKey: 'module.notifications',   icon: Bell,         color: 'text-yellow-400' },
  'email-analytics': { labelKey: 'module.emailAnalytics', icon: BarChart,     color: 'text-cyan-400' },
  // Sales, Spaces
  'sales':          { labelKey: 'module.sales',           icon: DollarSign,   color: 'text-green-400' },
  'spaces':         { labelKey: 'module.spaces',          icon: Layout,       color: 'text-violet-400' },
  // Obligations, Contacts
  'obligations':    { labelKey: 'module.obligations',     icon: Scale,        color: 'text-red-400' },
  'contacts':       { labelKey: 'module.contacts',        icon: Users,        color: 'text-emerald-400' },
  // Accounting
  'accounting':     { labelKey: 'module.accounting',      icon: Calculator,   color: 'text-lime-400' },
  'setup':          { labelKey: 'module.setup',           icon: Settings,     color: 'text-gray-400' },
  'invoices':       { labelKey: 'module.invoices',        icon: DollarSign,   color: 'text-green-400' },
  'journal':        { labelKey: 'module.journal',         icon: ClipboardList, color: 'text-blue-400' },
  'vat':            { labelKey: 'module.vat',             icon: Calculator,   color: 'text-lime-400' },
  'bank':           { labelKey: 'module.bank',            icon: DollarSign,   color: 'text-emerald-400' },
  'efka':           { labelKey: 'module.efka',            icon: Shield,       color: 'text-rose-400' },
  'assets':         { labelKey: 'module.assets',          icon: Layout,       color: 'text-violet-400' },
  'documents':      { labelKey: 'module.documents',       icon: ClipboardList, color: 'text-sky-400' },
  'reports':        { labelKey: 'module.reports',         icon: BarChart,     color: 'text-indigo-400' },
  // Account
  'account':        { labelKey: 'module.account',         icon: User,         color: 'text-slate-400' },
  'profile':        { labelKey: 'module.profile',         icon: User,         color: 'text-blue-400' },
  'preferences':    { labelKey: 'module.preferences',     icon: Settings,     color: 'text-gray-400' },
  'privacy':        { labelKey: 'module.privacy',         icon: Lock,         color: 'text-amber-400' },
  'security':       { labelKey: 'module.security',        icon: Shield,       color: 'text-red-400' },
  // Admin
  'admin':          { labelKey: 'module.admin',           icon: Settings,     color: 'text-rose-400' },
  'ai-inbox':       { labelKey: 'module.aiInbox',         icon: Inbox,        color: 'text-fuchsia-400' },
  'operator-inbox': { labelKey: 'module.operatorInbox',   icon: Headphones,   color: 'text-cyan-400' },
  // Financial Intelligence (SPEC-242C)
  'financial-intelligence': { labelKey: 'module.financialIntelligence', icon: BarChart3, color: 'text-emerald-400' },
};

interface BreadcrumbSegment {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
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
    const config = SEGMENT_CONFIG[segment];
    if (config) {
      items.push({
        label: t(config.labelKey),
        href: currentPath,
        icon: config.icon,
        color: config.color,
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
        const Icon = item.icon;

        return (
          <React.Fragment key={item.href}>
            <span className="text-muted-foreground/50" aria-hidden="true">
              →
            </span>
            {isLast ? (
              <span
                className="flex items-center gap-1 text-foreground font-medium"
                aria-current="page"
              >
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
