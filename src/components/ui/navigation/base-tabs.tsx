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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');

  if (
    process.env.NODE_ENV !== 'production' &&
    children !== undefined &&
    tabs.some((t) => 'content' in t && (t as { content: unknown }).content !== undefined)
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
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={themeConfig?.tabTrigger}
          >
            {tab.icon
              ? React.createElement(tab.icon, {
                  className: cn(iconSizes.sm, tab.iconColor),
                })
              : null}
            <span className={alwaysShowLabels ? '' : 'hidden sm:inline'}>
              {tab.label}
            </span>
            {tab.warningDot ? (
              <span className="ml-1 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      {children !== undefined
        ? children
        : tabs.map((tab) => {
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
