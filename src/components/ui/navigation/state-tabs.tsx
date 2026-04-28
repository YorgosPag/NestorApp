'use client';

/**
 * StateTabs — controlled+uncontrolled wrapper around `BaseTabs` (ADR-328 Phase I).
 *
 * Adds:
 *   - controlled (`value`) or uncontrolled (`defaultTab` + internal state) mode,
 *   - `useTransition` defer for INP responsiveness,
 *   - optional selection banner above the tabs strip,
 *   - `fillHeight` opt-in flex-column layout (parity with legacy `TabsOnlyTriggers`).
 *
 * Use `RouteTabs` instead when tabs are pathname-driven.
 *
 * @see ADR-328 §StateTabs API
 */

import React, { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  getThemeVariant,
  type ThemeVariant,
} from '@/components/ui/theme/ThemeComponents';
import { BaseTabs, type BaseTabsProps } from './base-tabs';

export interface StateTabsProps
  extends Omit<BaseTabsProps, 'value' | 'onValueChange' | 'theme' | 'listClassName'> {
  /** Controlled active tab id. When provided, internal state is bypassed. */
  value?: string;
  /** Initial active tab id for uncontrolled mode. Falls back to `tabs[0].id`. */
  defaultTab?: string;
  /** Tab change callback (always called, regardless of controlled vs uncontrolled). */
  onTabChange?: (id: string) => void;
  /** Selected items array. Selection banner shows only when length > 0 AND `selectionMessage` provided. */
  selectedItems?: string[];
  /** Selection banner message. Rendered above the tabs strip. */
  selectionMessage?: string;
  /** Apply flex-column layout (`flex-1 flex flex-col min-h-0`) for height-filling parents. */
  fillHeight?: boolean;
  /** Visual theme variant from `ThemeComponents` (default: `'default'`). */
  theme?: ThemeVariant;
}

const FILL_COL = 'flex-1 flex flex-col min-h-0';

export function StateTabs({
  tabs,
  value,
  defaultTab,
  onTabChange,
  selectedItems = [],
  selectionMessage,
  fillHeight = false,
  theme = 'default',
  className,
  children,
  ...rest
}: StateTabsProps) {
  const [, startTransition] = useTransition();
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id || '',
  );
  const activeTab = value !== undefined ? value : internalActiveTab;
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');

  const handleChange = (id: string) => {
    if (value === undefined) {
      startTransition(() => setInternalActiveTab(id));
    }
    onTabChange?.(id);
  };

  return (
    <div
      className={cn(
        themeConfig?.container,
        fillHeight && FILL_COL,
        className,
      )}
    >
      {selectedItems.length > 0 && selectionMessage ? (
        <div
          className={cn(
            'text-sm text-muted-foreground mb-2 px-2',
            fillHeight && 'flex-shrink-0',
          )}
        >
          {selectionMessage}
        </div>
      ) : null}

      <BaseTabs
        tabs={tabs}
        value={activeTab}
        onValueChange={handleChange}
        theme={theme}
        className={cn(fillHeight && FILL_COL)}
        listClassName={fillHeight ? 'flex-shrink-0' : undefined}
        {...rest}
      >
        {children}
      </BaseTabs>
    </div>
  );
}
