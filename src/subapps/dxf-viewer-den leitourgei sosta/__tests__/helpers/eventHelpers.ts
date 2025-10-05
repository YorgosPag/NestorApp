/**
 * 🎯 EVENT HELPERS - Centralized Event Utilities για Testing
 *
 * Single source of truth για event-related test utilities.
 * Περιλαμβάνει event constants, dispatchers, και listeners.
 *
 * @module __tests__/helpers/eventHelpers
 */

/**
 * 🎯 TEST EVENT CONSTANTS - Centralized event names
 *
 * Single source of truth για όλα τα event names που χρησιμοποιούνται στα tests.
 * ΔΕΝ πρέπει να hardcode-άρουμε event strings στα tests!
 */
export const TEST_EVENTS = {
  HILITE: 'dxf.highlightByIds',
  HOVER: 'dxf.hover',
  SELECT: 'dxf.select',
  CLEAR: 'dxf.clear',
  LAYER_TOGGLE: 'dxf.layerToggle',
  ENTITY_CLICK: 'dxf.entityClick'
} as const;

/**
 * 🎯 HILITE EVENT DETAIL - Type-safe payload για highlight events
 */
export interface HiliteDetail {
  ids: string[];
  mode: 'select' | 'hover' | 'replace';
}

/**
 * 🎯 PUBLISH HIGHLIGHT - Dispatch highlight event
 *
 * Centralized utility για publishing highlight events.
 * Χρησιμοποιείται σε όλα τα integration tests.
 *
 * @param {string[]} ids - Entity IDs to highlight
 * @param {HiliteDetail['mode']} mode - Highlight mode (default: 'select')
 *
 * @example
 * ```typescript
 * publishHighlight(['line-1', 'line-2'], 'select');
 * publishHighlight(['circle-1'], 'hover');
 * ```
 */
export const publishHighlight = (
  ids: string[],
  mode: HiliteDetail['mode'] = 'select'
): void => {
  const event = new CustomEvent<HiliteDetail>(TEST_EVENTS.HILITE, {
    detail: { ids, mode },
    bubbles: true
  });
  window.dispatchEvent(event);
};

/**
 * 🎯 CREATE EVENT LISTENER - Helper για creating typed event listeners
 *
 * @param {string} eventName - Event name (use TEST_EVENTS constants)
 * @param {Function} handler - Event handler
 * @returns {Function} Event listener function
 *
 * @example
 * ```typescript
 * const listener = createEventListener(TEST_EVENTS.HILITE, (event) => {
 *   console.log('Highlighted:', event.detail.ids);
 * });
 * window.addEventListener(TEST_EVENTS.HILITE, listener);
 * ```
 */
export const createEventListener = <T = any>(
  eventName: string,
  handler: (event: CustomEvent<T>) => void
): ((event: Event) => void) => {
  return (event: Event) => {
    handler(event as CustomEvent<T>);
  };
};

/**
 * 🎯 WAIT FOR EVENT - Wait για specific event to fire
 *
 * Useful για async testing - περιμένει μέχρι να fire ένα event.
 *
 * @param {string} eventName - Event name to wait for
 * @param {number} timeout - Timeout σε ms (default: 5000)
 * @returns {Promise<Event>} Promise που resolves με το event
 *
 * @example
 * ```typescript
 * await waitForEvent(TEST_EVENTS.HILITE, 1000);
 * // Event fired!
 * ```
 */
export const waitForEvent = (
  eventName: string,
  timeout: number = 5000
): Promise<Event> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const listener = (event: Event) => {
      clearTimeout(timer);
      window.removeEventListener(eventName, listener);
      resolve(event);
    };

    window.addEventListener(eventName, listener);
  });
};

/**
 * 🎯 DISPATCH CUSTOM EVENT - Generic custom event dispatcher
 *
 * @param {string} eventName - Event name
 * @param {T} detail - Event detail payload
 * @param {boolean} bubbles - Whether event bubbles (default: true)
 *
 * @example
 * ```typescript
 * dispatchCustomEvent('dxf.custom', { value: 42 });
 * ```
 */
export const dispatchCustomEvent = <T = any>(
  eventName: string,
  detail: T,
  bubbles: boolean = true
): void => {
  const event = new CustomEvent<T>(eventName, { detail, bubbles });
  window.dispatchEvent(event);
};

/**
 * 🎯 TRACK EVENT LISTENERS - Helper για tracking listeners για cleanup
 *
 * Returns an object με methods για adding/removing/cleaning up listeners.
 *
 * @returns {Object} Listener tracker
 *
 * @example
 * ```typescript
 * const tracker = trackEventListeners();
 *
 * const listener = (e) => console.log(e);
 * tracker.add(TEST_EVENTS.HILITE, listener);
 *
 * // Later, cleanup all listeners:
 * tracker.cleanup();
 * ```
 */
export const trackEventListeners = () => {
  const listeners: Array<{
    eventName: string;
    listener: (event: Event) => void;
  }> = [];

  return {
    add: (eventName: string, listener: (event: Event) => void) => {
      window.addEventListener(eventName, listener);
      listeners.push({ eventName, listener });
    },

    remove: (eventName: string, listener: (event: Event) => void) => {
      window.removeEventListener(eventName, listener);
      const index = listeners.findIndex(
        (l) => l.eventName === eventName && l.listener === listener
      );
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },

    cleanup: () => {
      listeners.forEach(({ eventName, listener }) => {
        window.removeEventListener(eventName, listener);
      });
      listeners.length = 0;
    },

    getCount: () => listeners.length
  };
};
