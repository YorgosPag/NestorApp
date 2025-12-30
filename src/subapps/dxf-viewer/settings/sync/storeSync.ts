/**
 * @file Store Sync - Pure Functions with Ports & Adapters
 * @module settings/sync/storeSync
 *
 * ✅ ENTERPRISE: Hexagonal Architecture - Zero Coupling to Legacy Stores
 *
 * **ARCHITECTURAL PRINCIPLES**:
 * - Dependency Inversion: Depends on ports (abstractions), not implementations
 * - Pure Functions: No React hooks, no side effects (except via ports)
 * - Testability: Can be tested with fake ports
 * - Flexibility: Swap implementations without changing this file
 *
 * **ZERO IMPORTS FROM**:
 * - ❌ stores/* (NO direct store access)
 * - ❌ contexts/* (NO context dependencies)
 * - ❌ components/* (NO component coupling)
 *
 * **ONLY IMPORTS**:
 * - ✅ ports.ts (abstract interfaces)
 * - ✅ Domain types (LineSettings, TextSettings, etc.)
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI) + ChatGPT-5 Architecture
 * @since 2025-10-09
 */

import type { SyncDependencies, ToolStylePort, TextStylePort, GripStylePort, GridPort, RulerPort, Unsubscribe } from './ports';
import type { LineSettings, TextSettings } from '../core/types';
import type { GripSettings } from '../../types/gripSettings';
import type { ViewerMode } from '../core/types';
import { UI_COLORS } from '../../config/color-config';

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
// MAPPER FUNCTIONS (Settings → Port Format)
// ============================================================================

/**
 * Map LineSettings → ToolStylePort format
 */
function mapLineToToolStyle(line: LineSettings): Parameters<ToolStylePort['apply']>[0] {
  return {
    stroke: line.color,
    fill: UI_COLORS.TRANSPARENT, // Transparent fill
    width: line.lineWidth,
    opacity: line.opacity,
    dashArray: [] // TODO: Map from lineType to dashArray
  };
}

/**
 * Map TextSettings → TextStylePort format
 */
function mapTextToTextStyle(text: TextSettings): Parameters<TextStylePort['apply']>[0] {
  return {
    font: text.fontFamily,
    size: text.fontSize,
    color: text.color,
    weight: text.isBold ? 'bold' : 'normal',
    style: text.isItalic ? 'italic' : 'normal'
  };
}

/**
 * Map GripSettings → GripStylePort format
 */
function mapGripToGripStyle(grip: GripSettings): Parameters<GripStylePort['apply']>[0] {
  return {
    size: grip.gripSize,
    color: grip.colors?.cold ?? UI_COLORS.SNAP_CENTER,
    hoverColor: grip.colors?.warm ?? UI_COLORS.SNAP_INTERSECTION,
    selectedColor: grip.colors?.hot ?? UI_COLORS.SNAP_ENDPOINT
  };
}

// ============================================================================
// PORT WIRING FUNCTION (Generic)
// ============================================================================

/**
 * Wire a port for bidirectional sync
 *
 * @param port - Port to wire
 * @param pickFromEffective - Function to extract data from effective settings
 * @param deps - Sync dependencies
 * @param getEffective - Getter for effective settings
 * @returns Push function and cleanup subscriptions
 */
function wirePort<TPort extends { apply(p: unknown): void; onChange(h: (p: unknown) => void): Unsubscribe }>(
  port: TPort,
  pickFromEffective: (getter: EffectiveSettingsGetter) => unknown,
  deps: SyncDependencies,
  getEffective: EffectiveSettingsGetter
): { push: () => void; subscriptions: Unsubscribe[] } {
  const subscriptions: Unsubscribe[] = [];

  // ===== UNIDIRECTIONAL FLOW: Settings → Port =====
  const push = () => {
    try {
      const data = pickFromEffective(getEffective);
      port.apply(data);
      deps.logger.info('[StoreSync] Pushed to port', data);
    } catch (err) {
      deps.logger.warn('[StoreSync] Apply failed', err);
    }
  };

  // ===== OPTIONAL BIDIRECTIONAL: Port → Settings (via EventBus) =====
  if (deps.bus) {
    const unsub = port.onChange((delta) => {
      try {
        deps.logger.info('[StoreSync] Port delta received', delta);
        deps.bus!.emit({ type: 'PORT_DELTA', payload: delta });
      } catch (err) {
        deps.logger.warn('[StoreSync] onChange failed', err);
      }
    });
    subscriptions.push(unsub);
  }

  return { push, subscriptions };
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
      deps.logger.info('[StoreSync] Starting sync');

      // ===== WIRE TOOL STYLE PORT =====
      if (deps.toolStyle) {
        const { push, subscriptions } = wirePort(
          deps.toolStyle,
          (getter) => mapLineToToolStyle(getter.line('preview')),
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      // ===== WIRE TEXT STYLE PORT =====
      if (deps.textStyle) {
        const { push, subscriptions } = wirePort(
          deps.textStyle,
          (getter) => mapTextToTextStyle(getter.text()),
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      // ===== WIRE GRIP STYLE PORT =====
      if (deps.gripStyle) {
        const { push, subscriptions } = wirePort(
          deps.gripStyle,
          (getter) => mapGripToGripStyle(getter.grip('preview')),
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      // ===== WIRE GRID PORT =====
      if (deps.grid) {
        const { push, subscriptions } = wirePort(
          deps.grid,
          () => ({ enabled: true, spacing: 10, color: UI_COLORS.LIGHT_GRAY, opacity: 0.5 }), // TODO: Map from settings
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      // ===== WIRE RULER PORT =====
      if (deps.ruler) {
        const { push, subscriptions } = wirePort(
          deps.ruler,
          () => ({ enabled: true, units: 'mm', color: UI_COLORS.WHITE, opacity: 1.0 }), // TODO: Map from settings
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      // ===== INITIAL PUSH (Settings → Ports) =====
      const pushFromSettings = () => {
        deps.logger.info('[StoreSync] Pushing from settings');
        for (const push of pushers) {
          push();
        }
      };

      // Push immediately on start
      pushFromSettings();

      // ===== RETURN CONTROL API =====
      return {
        stop() {
          deps.logger.info('[StoreSync] Stopping sync');
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
