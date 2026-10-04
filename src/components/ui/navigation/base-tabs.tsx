'use client';

/**
 * BaseTabs — canonical pure-renderer tabs primitive (ADR-328 Phase I).
 *
 * No state, no routing. Wraps `@/components/ui/tabs` (Radix) with the centralized
 * theme + iconSizes + i18n-agnostic label rendering. Two modes:
 *
 *   1. **Array mode** (default): pass `tabs[].content` and BaseTabs renders both
 *      `<TabsList>` and `<TabsContent>` for each entry.
 *   2. **Children mode**: pass `children` to render custom `<TabsContent>` blocks
 *      yourself (e.g. `BuildingDataTabs.tsx` which owns layout). When `children`
 *      is provided, `tab.content` is ignored.
 *
 * Wrappers:
 *   - `StateTabs` adds controlled/uncontrolled state + selection banner + fillHeight.
 *   - `RouteTabs` adds pathname/router awareness.
 *
 * Direct use of `BaseTabs` is allowed but rare — prefer the wrappers.
 *
 * @see ADR-328 §Architecture
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabsTriggerClassName } from '@/components/ui/tabs';
import { Link } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { cn } from '@/lib/utils';
import {
  getThemeVariant,
  type ThemeVariant,
} from '@/components/ui/theme/ThemeComponents';
import { useIconSizes } from '@/hooks/useIconSizes';
import { TABS_STYLES, type BaseTabDef } from './tabs-types';

export type { BaseTabDef, TabDefinition, TabsNavTab } from './tabs-types';
export { TABS_STYLES } from './tabs-types';
export { TabsContent };

export interface BaseTabsProps {
  /** Tab definitions. Renders trigger per entry, plus content if no `children` provided. */
  tabs: readonly BaseTabDef[];
  /** Active tab id. Required (controlled). */
  value: string;
  /** Tab change handler. Required (controlled). */
  onValueChange: (value: string) => void;
  /** Visual theme variant from `ThemeComponents` (default: `'default'`). */
  theme?: ThemeVariant;
  /** Additional className applied to the `<Tabs>` root. */
  className?: string;
  /** Additional className applied to the inner `<TabsList>` (e.g. `flex-shrink-0`). */
  listClassName?: string;
  /** ARIA label propagated to the `<Tabs>` root. */
  ariaLabel?: string;
  /** Force label visibility on small viewports (default: hidden below `sm:`). */
  alwaysShowLabels?: boolean;
  /**
   * When provided, replaces the automatic `tab.content` rendering. Use this for
   * consumers that own their own `<TabsContent>` layout. If both `children` and
   * `tab.content` are provided, `children` wins; a dev-only `console.warn` flags
   * the conflict.
   */
  children?: React.ReactNode;
}

interface TabLinkProps {
  href: string;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}

/**
 * Καρτέλα-σύνδεσμος (ADR-328 · ADR-330): μέλος της λωρίδας (`role="tab"`), αλλά **ποτέ**
 * επιλεγμένη — η επιφάνειά της ζει σε άλλη διαδρομή. Ανενεργή ⇒ χωρίς `href`, άρα δεν πλοηγεί.
 */
function TabLink({ href, disabled, className, children }: TabLinkProps) {
  if (disabled) {
    return (
      <span role="tab" aria-selected={false} aria-disabled className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link
      role="tab"
      aria-selected={false}
      href={declaredHref('BaseTabs είναι γενικό UI primitive · η τιμή προήλθε από tab.href.', href)}
      className={className}
    >
      {children}
    </Link>
  );
}

export function BaseTabs({
  tabs,
  value,
  onValueChange,
  theme = 'default',
  className,
  listClassName,
  ariaLabel,
  alwaysShowLabels = false,
  children,
}: BaseTabsProps) {
  const iconSizes = useIconSizes();
  const triggerClassName = useTabsTriggerClassName();
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');

  // Use loose `!= null` so that a deliberately-passed `null` (e.g. triggers-only
  // wrappers like `TabsOnlyTriggers` send `children ?? null`) or `content: null`
  // tabs are treated as "not provided" and never trip a false-positive warning.
  // Only a genuine conflict — real children AND real tab.content — should warn.
  if (
    process.env.NODE_ENV !== 'production' &&
    children != null &&
    tabs.some((t) => 'content' in t && (t as { content: unknown }).content != null)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[BaseTabs] `children` and `tab.content` both provided. `children` wins; tab.content is ignored.',
    );
  }

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      className={cn(TABS_STYLES.container, className)}
    >
      <TabsList className={cn(TABS_STYLES.list, listClassName)}>
        {tabs.map((tab) => {
          const face = (
            <>
              {tab.icon
                ? React.createElement(tab.icon, {
                    className: cn(iconSizes.sm, tab.iconColor),
                  })
                : null}
              <span className={alwaysShowLabels ? '' : 'hidden sm:inline'}>
                {tab.label}
              </span>
              {tab.warningDot ? (
                <span className="ml-1 h-2 w-2 rounded-full bg-[hsl(var(--status-warning))] shrink-0" />
              ) : null}
            </>
          );
          if (tab.href !== undefined) {
            return (
              <TabLink
                key={tab.id}
                href={tab.href}
                disabled={tab.disabled}
                className={cn(triggerClassName, themeConfig?.tabTrigger)}
              >
                {face}
              </TabLink>
            );
          }
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={themeConfig?.tabTrigger}
            >
              {face}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {children !== undefined
        ? children
        : tabs.filter((tab) => tab.href === undefined).map((tab) => {
            const content = (tab as { content?: React.ReactNode }).content;
            return (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className={themeConfig?.content}
              >
                <div className={TABS_STYLES.contentWrapper}>{content}</div>
              </TabsContent>
            );
          })}
    </Tabs>
  );
}
