/**
 * @file Store Sync - Settings → Legacy Style Stores (single full-state writers)
 * @module settings/sync/storeSync
 *
 * ✅ ENTERPRISE: drives the runtime "settings → style store" hydration on load
 * and on demand (`pushFromSettings`).
 *
 * **SSoT (2026-06-20)**: this file used to carry its OWN lossy settings→store
 * mappers (`mapLineToToolStyle` / `mapTextToTextStyle` / `mapGripToGripStyle`)
 * that wrote a partial subset via the port adapters — a second, diverging writer
 * alongside `StyleManagerProvider`'s full mappings (last-writer-wins hazard).
 * The mapping now lives in exactly ONE place — `stores/style-store-sync.ts` —
 * and this file delegates to those FULL writers. No more partial/lossy writes.
 *
 * The port `onChange` subscriptions are kept as the bidirectional (port → bus)
 * scaffolding; grid/ruler ports remain dormant (RulersGridSystem is their SSoT,
 * see the start() body).
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI) + ChatGPT-5 Architecture
 * @since 2025-10-09
 */

import type { SyncDependencies, Unsubscribe } from './ports';
import type { LineSettings, TextSettings } from '../core/types';
import type { GripSettings } from '../../types/gripSettings';
import type { ViewerMode } from '../core/types';
// 🏢 SSoT full-state writers (single mapping source for the legacy style stores)
import {
  syncToolStyleStoreFromSettings,
  syncTextStyleStoreFromSettings,
  syncCompletionStyleStoreFromSettings,
  syncGripStyleStoreFromSettings,
} from '../../stores/style-store-sync';

// ============================================================================
// EFFECTIVE SETTINGS GETTER TYPE
// ============================================================================

/**
 * Function type that returns effective settings
 * (passed from Provider during initialization)
 */
export interface EffectiveSettingsGetter {
  line: (mode?: ViewerMode) => LineSettings;
  text: (mode?: ViewerMode) => TextSettings;
  grip: (mode?: ViewerMode) => GripSettings;
}

// ============================================================================
// STORE SYNC API
// ============================================================================

/**
 * Store Sync Interface - Public API
 */
export interface StoreSync {
  /**
   * Start synchronization
   * @param getEffective - Getter for effective settings
   * @returns Control object with stop() and pushFromSettings()
   */
  start(getEffective: EffectiveSettingsGetter): {
    stop: () => void;
    pushFromSettings: () => void;
  };
}

// ============================================================================
// PORT onChange WIRING (Bidirectional scaffolding: port → bus)
// ============================================================================

/**
 * Subscribe to a port's external changes and re-emit them on the event bus.
 * This is the ONLY remaining responsibility of the ports here — the settings →
 * store push is done via the SSoT full writers (see createStoreSync below).
 *
 * @param port - Port exposing `onChange`
 * @param deps - Sync dependencies (logger + optional bus)
 * @returns Unsubscribe handle
 */
function subscribePortToBus(
  port: { onChange(h: (p: unknown) => void): Unsubscribe },
  deps: SyncDependencies
): Unsubscribe {
  return port.onChange((delta) => {
    try {
      if (deps.bus) {
        deps.bus.emit({ type: 'PORT_DELTA', payload: delta });
      }
    } catch (err) {
      deps.logger.warn('[StoreSync] onChange failed', err);
    }
  });
}

// ============================================================================
// CREATE STORE SYNC (FACTORY)
// ============================================================================

/**
 * Create Store Sync instance
 *
 * **PURE FACTORY** - No side effects, no React hooks
 *
 * @param deps - Sync dependencies (injected via DI)
 * @returns StoreSync instance
 *
 * @example
 * ```ts
 * const sync = createStoreSync({ logger: consoleLogger, toolStyle: adapter });
 * const { stop, pushFromSettings } = sync.start(getEffectiveSettings);
 * pushFromSettings(); // Push settings → ports
 * stop(); // Cleanup subscriptions
 * ```
 */
export function createStoreSync(deps: SyncDependencies): StoreSync {
  deps.logger.info('[StoreSync] Creating sync instance');

  let allSubscriptions: Unsubscribe[] = [];
  let pushers: Array<() => void> = [];

  return {
    start(getEffective: EffectiveSettingsGetter) {
      // Debug disabled: Starting sync

      // 🏢 SSoT: push FULL effective state into the legacy style stores via the
      // single mapping writers (style-store-sync.ts). Each push is wrapped so a
      // faulty getter is logged, never thrown. Per-entity effective modes are
      // preserved from the previous port pushers (tool/grip = 'preview',
      // completion = 'completion', text = default).
      const addPush = (fn: () => void) => {
        pushers.push(() => {
          try {
            fn();
          } catch (err) {
            deps.logger.warn('[StoreSync] Push failed', err);
          }
        });
      };

      // ===== WIRE TOOL STYLE PORT (+ completion, derived from line settings) =====
      if (deps.toolStyle) {
        allSubscriptions.push(subscribePortToBus(deps.toolStyle, deps));
        addPush(() => syncToolStyleStoreFromSettings(getEffective.line('preview')));
        addPush(() => syncCompletionStyleStoreFromSettings(getEffective.line('completion')));
      }

      // ===== WIRE TEXT STYLE PORT =====
      if (deps.textStyle) {
        allSubscriptions.push(subscribePortToBus(deps.textStyle, deps));
        addPush(() => syncTextStyleStoreFromSettings(getEffective.text()));
      }

      // ===== WIRE GRIP STYLE PORT =====
      if (deps.gripStyle) {
        allSubscriptions.push(subscribePortToBus(deps.gripStyle, deps));
        addPush(() => syncGripStyleStoreFromSettings(getEffective.grip('preview')));
      }

      // ===== WIRE GRID PORT =====
      // 🐛 FIX (2026-05-08): the previous getter hardcoded `enabled: true`
      // and pushed it to globalGridStore on every effective-settings sync,
      // which silently overwrote the user's grid visibility (and any other
      // grid setting) every time line/text/grip changed. RulersGridSystem
      // is the SSoT for grid + ruler — these legacy ports are kept for
      // backward compat with consumers that still subscribe to
      // globalGridStore / globalRulerStore, but storeSync no longer
      // PUSHES into them. The bidirectional store→React sync inside
      // RulersGridSystem (lines 259-279) handles the global-store
      // notifications without involving storeSync.
      // TODO: remove deps.grid / deps.ruler entirely once all legacy
      // consumers migrate to useRulersGridContext.

      // ===== WIRE RULER PORT =====
      // (see grid port comment above)

      // ===== INITIAL PUSH (Settings → Stores via SSoT writers) =====
      const pushFromSettings = () => {
        // Debug disabled: Pushing from settings
        for (const push of pushers) {
          push();
        }
      };

      // Push immediately on start
      pushFromSettings();

      // ===== RETURN CONTROL API =====
      return {
        stop() {
          // Debug disabled: Stopping sync
          for (const unsub of allSubscriptions.splice(0)) {
            try {
              unsub();
            } catch (err) {
              deps.logger.warn('[StoreSync] Unsubscribe failed', err);
            }
          }
          pushers = [];
        },
        pushFromSettings
      };
    }
  };
}
