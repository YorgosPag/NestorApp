'use client';

/**
 * TabsComponents — DEPRECATED alias shims (ADR-328 Phase I L4).
 *
 * The legacy `TabsContainer`, `ToolbarTabs`, and `TabsOnlyTriggers` now
 * forward to `StateTabs` from `@/components/ui/navigation/state-tabs`. New
 * code MUST import `StateTabs` directly. CHECK 3.24 ratchets new imports
 * of the deprecated symbols at pre-commit time.
 *
 * @see ADR-328 §Alias adapters (L4)
 * @see src/components/ui/navigation/state-tabs.tsx
 */

import React from 'react';
import { StateTabs, type StateTabsProps } from './state-tabs';
import { TabsContent } from '@/components/ui/tabs';

export { TabsContent };
export { TABS_STYLES } from './tabs-types';
export type { TabDefinition, BaseTabDef, TabsNavTab } from './tabs-types';

type AliasProps = Omit<StateTabsProps, 'fillHeight'>;

/**
 * @deprecated Use `StateTabs` from `@/components/ui/navigation/state-tabs`.
 * Renders tabs with auto-mapped `tab.content`. ADR-328.
 */
export function TabsContainer(props: AliasProps) {
  return <StateTabs {...props} fillHeight={false} />;
}

/**
 * @deprecated Use `StateTabs` from `@/components/ui/navigation/state-tabs`.
 * Identical to `TabsContainer`. ADR-328.
 */
export const ToolbarTabs = TabsContainer;

/**
 * @deprecated Use `StateTabs` from `@/components/ui/navigation/state-tabs`
 * with `fillHeight={true}`. Renders only the trigger strip; consumer owns
 * `<TabsContent>` via children. ADR-328.
 */
export function TabsOnlyTriggers(props: AliasProps) {
  return <StateTabs {...props} fillHeight />;
}
