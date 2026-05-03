/**
 * Tabs types & style constants — canonical home (ADR-328).
 *
 * `BaseTabDef` is the minimal shape consumed by `BaseTabs`. `TabDefinition`
 * is the legacy in-page-tabs shape (icon + content required) re-exported for
 * back-compat. `TabsNavTab` is the routing shape consumed by `RouteTabs`.
 */

import type { LucideIcon } from 'lucide-react';
import type React from 'react';

export interface BaseTabDef {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
  disabled?: boolean;
  /** Amber dot rendered on the tab trigger to signal a required action inside. */
  warningDot?: boolean;
}

export interface TabDefinition extends BaseTabDef {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export interface TabsNavTab {
  href: string;
  labelKey: string;
  exactMatch?: boolean;
  excludeStartsWith?: readonly string[];
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string;
}

export const TABS_STYLES = {
  container: 'w-full',
  list: 'flex flex-wrap gap-1 w-full h-auto min-h-fit',
  content: 'mt-2',
  contentWrapper: 'flex flex-wrap gap-2',
} as const;
