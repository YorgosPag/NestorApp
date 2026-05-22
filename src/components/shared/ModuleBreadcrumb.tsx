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
  Package,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

/**
 * Config per URL segment: i18n key, icon, and color class.
 * Matches NavigationBreadcrumb pattern (colored icons + entity-specific styling).
 */
const SEGMENT_CONFIG: Record<string, { labelKey: string; icon: LucideIcon; color: string }> = {
  // CRM
  'crm':            { labelKey: 'module.crm',            icon: BarChart,     color: 'text-primary' },
  'dashboard':      { labelKey: 'module.crmDashboard',   icon: BarChart,     color: 'text-primary' },
  'tasks':          { labelKey: 'module.tasks',           icon: ClipboardList, color: 'text-primary' },
  'calendar':       { labelKey: 'module.calendar',        icon: CalendarDays, color: 'text-primary' },
  'leads':          { labelKey: 'module.leads',           icon: Target,       color: 'text-[hsl(var(--text-warning))]' },
  'pipeline':       { labelKey: 'module.pipeline',        icon: Filter,       color: 'text-[hsl(var(--text-warning))]' },
  'communications': { labelKey: 'module.communications',  icon: Phone,        color: 'text-primary' },
  'teams':          { labelKey: 'module.teams',           icon: Users,        color: 'text-primary' },
  'notifications':  { labelKey: 'module.notifications',   icon: Bell,         color: 'text-[hsl(var(--text-warning))]' },
  'email-analytics': { labelKey: 'module.emailAnalytics', icon: BarChart,     color: 'text-primary' },
  // Sales, Spaces
  'sales':          { labelKey: 'module.sales',           icon: DollarSign,   color: 'text-green-707' },
  'spaces':         { labelKey: 'module.spaces',          icon: Layout,       color: 'text-primary' },
  // Obligations, Contacts
  'obligations':    { labelKey: 'module.obligations',     icon: Scale,        color: 'text-destructive' },
  'contacts':       { labelKey: 'module.contacts',        icon: Users,        color: 'text-green-707' },
  // Accounting
  'accounting':     { labelKey: 'module.accounting',      icon: Calculator,   color: 'text-green-707' },
  'setup':          { labelKey: 'module.setup',           icon: Settings,     color: 'text-muted-foreground' },
  'invoices':       { labelKey: 'module.invoices',        icon: DollarSign,   color: 'text-green-707' },
  'journal':        { labelKey: 'module.journal',         icon: ClipboardList, color: 'text-primary' },
  'vat':            { labelKey: 'module.vat',             icon: Calculator,   color: 'text-green-707' },
  'bank':           { labelKey: 'module.bank',            icon: DollarSign,   color: 'text-green-707' },
  'efka':           { labelKey: 'module.efka',            icon: Shield,       color: 'text-destructive' },
  'assets':         { labelKey: 'module.assets',          icon: Layout,       color: 'text-primary' },
  'documents':      { labelKey: 'module.documents',       icon: ClipboardList, color: 'text-primary' },
  'reports':        { labelKey: 'module.reports',         icon: BarChart,     color: 'text-primary' },
  // Account
  'account':        { labelKey: 'module.account',         icon: User,         color: 'text-muted-foreground' },
  'profile':        { labelKey: 'module.profile',         icon: User,         color: 'text-primary' },
  'preferences':    { labelKey: 'module.preferences',     icon: Settings,     color: 'text-muted-foreground' },
  'privacy':        { labelKey: 'module.privacy',         icon: Lock,         color: 'text-[hsl(var(--text-warning))]' },
  'security':       { labelKey: 'module.security',        icon: Shield,       color: 'text-destructive' },
  // Admin
  'admin':          { labelKey: 'module.admin',           icon: Settings,     color: 'text-destructive' },
  'ai-inbox':       { labelKey: 'module.aiInbox',         icon: Inbox,        color: 'text-primary' },
  'operator-inbox': { labelKey: 'module.operatorInbox',   icon: Headphones,   color: 'text-primary' },
  // Financial Intelligence (SPEC-242C)
  'financial-intelligence': { labelKey: 'module.financialIntelligence', icon: BarChart3, color: 'text-green-707' },
  // Procurement (ADR-267 + ADR-327 + ADR-328)
  'procurement':    { labelKey: 'module.procurement',     icon: Package,     color: 'text-[hsl(var(--text-warning))]' },
  'quotes':         { labelKey: 'module.quotes',          icon: FileText,    color: 'text-[hsl(var(--text-warning))]' },
  'rfqs':           { labelKey: 'module.rfqs',            icon: ClipboardList, color: 'text-[hsl(var(--text-warning))]' },
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
  const colors = useSemanticColors();

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
        className={cn("flex items-center gap-1 hover:text-foreground transition-colors", colors.text.muted)}
      >
        <Home className="h-3.5 w-3.5" />
        <span>{t('module.home')}</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;

        return (
          <React.Fragment key={item.href}>
            <span className={`${colors.text.muted}/50`} aria-hidden="true">
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
                className={cn("flex items-center gap-1 hover:text-foreground transition-colors", colors.text.muted)}
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
