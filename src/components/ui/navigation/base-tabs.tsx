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

import React, { useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabsTriggerClassName } from '@/components/ui/tabs';
import { Link } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { cn } from '@/lib/utils';
import {
  getThemeVariant,
  type ThemeVariant,
} from '@/components/ui/theme/ThemeComponents';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { TABS_RAIL_BELOW_REM, TabsRail } from './tabs-rail';
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
  /** Force label visibility on small viewports (default: below `sm:` only the ACTIVE tab shows its label). */
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

/**
 * Η ετικέτα μιας καρτέλας (ADR-912 §2.2). Κάτω από `sm` φαίνεται **μόνο της ενεργής** — αλλά δεν κρύβεται ποτέ
 * από την υποβοηθητική τεχνολογία: `sr-only`, όχι `hidden`. Με `hidden` κάθε καρτέλα-εικονίδιο ήταν κουμπί
 * **χωρίς όνομα** σε κάθε κινητό (WCAG 4.1.2).
 *
 * ⚠️ Το `!` στα `not-sr-only` ΔΕΝ είναι διακοσμητικό: το `globals.css` ξαναδηλώνει το `.sr-only` με `!important`,
 * άρα ένα σκέτο `sm:not-sr-only` χάνει **πάντα** — μετρημένο ζωντανά 2026-10-10: η ετικέτα έμενε κρυφή σε κάθε
 * πλάτος, και στην ενεργή καρτέλα. Το jsdom δεν το βλέπει (δεν φορτώνει CSS).
 */
const LABEL_RESPONSIVE = 'sr-only sm:!not-sr-only [[data-state=active]>&]:!not-sr-only';

interface TabStripItemsProps {
  tabs: readonly BaseTabDef[];
  triggerTheme: string | undefined;
  alwaysShowLabels: boolean;
}

/** Τα μέλη της λωρίδας — **μία** δήλωση για τη φαρδιά (`TabsList`) και τη στενή (`TabsRail`) εκδοχή. */
function TabStripItems({ tabs, triggerTheme, alwaysShowLabels }: TabStripItemsProps) {
  const iconSizes = useIconSizes();
  const triggerClassName = useTabsTriggerClassName();

  return (
    <>
      {tabs.map((tab) => {
        const face = (
          <>
            {tab.icon ? React.createElement(tab.icon, { className: cn(iconSizes.sm, tab.iconColor) }) : null}
            <span className={alwaysShowLabels ? '' : LABEL_RESPONSIVE}>{tab.label}</span>
            {tab.warningDot ? (
              <span className="ml-1 h-2 w-2 rounded-full bg-[hsl(var(--status-warning))] shrink-0" />
            ) : null}
          </>
        );
        if (tab.href !== undefined) {
          return (
            <TabLink key={tab.id} href={tab.href} disabled={tab.disabled} className={cn(triggerClassName, triggerTheme)}>
              {face}
            </TabLink>
          );
        }
        return (
          <TabsTrigger key={tab.id} value={tab.id} disabled={tab.disabled} className={triggerTheme}>
            {face}
          </TabsTrigger>
        );
      })}
    </>
  );
}

/** Dev-only: πραγματικά `children` ΚΑΙ πραγματικό `tab.content` — τα `children` κερδίζουν, και το λέμε. */
function warnOnContentConflict(tabs: readonly BaseTabDef[], children: React.ReactNode): void {
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
  const themeConfig = getThemeVariant(theme) || getThemeVariant('default');
  const rootRef = useRef<HTMLDivElement>(null);
  // Ο ΧΩΡΟΣ που υπάρχει, όχι το παράθυρο (ADR-912 §2.1): το ίδιο πάνελ είναι στενό και σε desktop με ανοιχτή
  // πλαϊνή στήλη. `'measuring'` (SSR · jsdom) ⇒ η φαρδιά εκδοχή, δηλαδή η συμπεριφορά πριν από αυτή την αλλαγή.
  const isRail = useContainerClass(rootRef, TABS_RAIL_BELOW_REM, { zeroWidth: 'measuring' }) === 'narrow';

  warnOnContentConflict(tabs, children);

  const items = (
    <TabStripItems tabs={tabs} triggerTheme={themeConfig?.tabTrigger} alwaysShowLabels={alwaysShowLabels} />
  );

  return (
    <Tabs
      ref={rootRef}
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      className={cn(TABS_STYLES.container, className)}
    >
      {isRail ? (
        <TabsRail value={value} className={listClassName}>{items}</TabsRail>
      ) : (
        <TabsList className={cn(TABS_STYLES.list, listClassName)}>{items}</TabsList>
      )}

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
