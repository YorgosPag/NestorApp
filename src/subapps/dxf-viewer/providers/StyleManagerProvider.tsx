'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_STYLE_MANAGER_PROVIDER = false;

import React, { useEffect } from 'react';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../settings-provider';
// 🏢 SSoT single writer: effective line settings → completionStyleStore.
import { syncCompletionStyleStoreFromSettings } from '../stores/style-store-sync';

/**
 * StyleManagerProvider — keeps `completionStyleStore` in sync with ongoing
 * line-settings changes.
 *
 * Initial hydration of ALL legacy style stores (tool / text / grip / completion)
 * is owned by `EnterpriseDxfSettingsProvider` — a single on-load driver that
 * calls the SSoT writers in `stores/style-store-sync.ts`. This component covers
 * the one ongoing concern the on-load driver does not: live completion updates
 * when the user changes line settings after load.
 *
 * 🏢 SSoT cleanup (2026-06-20): the former React context + `useStyleManager()`
 * hook + `syncStores` / `updateStore` API were removed — verified zero consumers
 * app-wide (dead code, the legacy `storeSync.ts` path used to be the real driver).
 */
export function StyleManagerProvider({ children }: { children: React.ReactNode }) {
  const dxfSettings = useDxfSettings();
  const getEffectiveLineSettings = dxfSettings?.getEffectiveLineSettings;

  // ===== ONGOING COMPLETION SYNC =====
  useEffect(() => {
    if (!getEffectiveLineSettings) return;

    const completionSettings = getEffectiveLineSettings('completion');
    syncCompletionStyleStoreFromSettings(completionSettings);

    if (DEBUG_STYLE_MANAGER_PROVIDER) {
      console.log('[StyleManager] Completion store synced:', completionSettings.color);
    }
  }, [getEffectiveLineSettings]);

  return <>{children}</>;
}
