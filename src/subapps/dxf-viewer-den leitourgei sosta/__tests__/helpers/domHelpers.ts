/**
 * 🎯 DOM HELPERS - Centralized DOM Utilities για Testing
 *
 * Single source of truth για DOM-related test utilities.
 * Περιλαμβάνει selectors, element creation, και DOM assertions.
 *
 * @module __tests__/helpers/domHelpers
 */

/**
 * 🎯 QUERY SELECTOR - Safe element query
 *
 * Wrapper γύρω από document.querySelector με type safety.
 *
 * @param {string} selector - CSS selector
 * @returns {HTMLElement | null} Element ή null
 *
 * @example
 * ```typescript
 * const canvas = querySelector('[data-canvas-type="dxf"]');
 * expect(canvas).not.toBeNull();
 * ```
 */
export const querySelector = (selector: string): HTMLElement | null => {
  return document.querySelector(selector);
};

/**
 * 🎯 QUERY SELECTOR ALL - Safe element query για multiple elements
 *
 * @param {string} selector - CSS selector
 * @returns {HTMLElement[]} Array of elements
 *
 * @example
 * ```typescript
 * const canvases = querySelectorAll('canvas');
 * expect(canvases.length).toBeGreaterThan(0);
 * ```
 */
export const querySelectorAll = (selector: string): HTMLElement[] => {
  return Array.from(document.querySelectorAll(selector));
};

/**
 * 🎯 REQUIRE ELEMENT - Query element and throw if not found
 *
 * Useful για tests όπου το element ΠΡΕΠΕΙ να υπάρχει.
 *
 * @param {string} selector - CSS selector
 * @returns {HTMLElement} Element (throws if not found)
 * @throws {Error} If element not found
 *
 * @example
 * ```typescript
 * const canvas = requireElement('[data-canvas-type="dxf"]');
 * // Guaranteed to be non-null
 * ```
 */
export const requireElement = (selector: string): HTMLElement => {
  const element = querySelector(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
};

/**
 * 🎯 CREATE TEST ELEMENT - Create element με attributes
 *
 * @param {string} tag - HTML tag name
 * @param {Record<string, string>} attributes - Element attributes
 * @param {string} textContent - Optional text content
 * @returns {HTMLElement} Created element
 *
 * @example
 * ```typescript
 * const div = createTestElement('div', {
 *   'data-testid': 'grips-count',
 *   'role': 'status'
 * }, '0 grips');
 * document.body.appendChild(div);
 * ```
 */
export const createTestElement = (
  tag: string,
  attributes: Record<string, string> = {},
  textContent?: string
): HTMLElement => {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
};

/**
 * 🎯 CREATE MOCK CANVAS - Create mock canvas element
 *
 * @param {Object} options - Canvas options
 * @returns {HTMLCanvasElement} Mock canvas
 *
 * @example
 * ```typescript
 * const canvas = createMockCanvas({
 *   width: 800,
 *   height: 600,
 *   canvasType: 'dxf'
 * });
 * ```
 */
export const createMockCanvas = (options?: {
  width?: number;
  height?: number;
  canvasType?: string;
}): HTMLCanvasElement => {
  const { width = 800, height = 600, canvasType = 'dxf' } = options || {};

  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-canvas-type', canvasType);
  canvas.width = width;
  canvas.height = height;

  return canvas;
};

/**
 * 🎯 APPEND TO BODY - Append element to document.body
 *
 * @param {HTMLElement} element - Element to append
 * @returns {HTMLElement} The same element (για chaining)
 */
export const appendToBody = (element: HTMLElement): HTMLElement => {
  document.body.appendChild(element);
  return element;
};

/**
 * 🎯 REMOVE FROM BODY - Remove element from document.body
 *
 * @param {HTMLElement} element - Element to remove
 */
export const removeFromBody = (element: HTMLElement): void => {
  if (element.parentElement === document.body) {
    document.body.removeChild(element);
  }
};

/**
 * 🎯 CLEANUP DOM - Remove all test elements
 *
 * Removes all elements με data-testid attribute.
 * Useful για afterEach cleanup.
 */
export const cleanupDOM = (): void => {
  const testElements = document.querySelectorAll('[data-testid]');
  testElements.forEach((el) => {
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
  });
};

/**
 * 🎯 WAIT FOR ELEMENT - Wait για element να εμφανιστεί στο DOM
 *
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout σε ms (default: 5000)
 * @returns {Promise<HTMLElement>} Promise που resolves με το element
 *
 * @example
 * ```typescript
 * const canvas = await waitForElement('[data-canvas-type="dxf"]', 1000);
 * expect(canvas).not.toBeNull();
 * ```
 */
export const waitForElement = (
  selector: string,
  timeout: number = 5000
): Promise<HTMLElement> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }

      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
};

/**
 * 🎯 GET ELEMENT TEXT - Get element text content safely
 *
 * @param {string} selector - CSS selector
 * @returns {string | null} Text content ή null
 */
export const getElementText = (selector: string): string | null => {
  const element = querySelector(selector);
  return element ? element.textContent : null;
};

/**
 * 🎯 SET ELEMENT TEXT - Set element text content
 *
 * @param {string} selector - CSS selector
 * @param {string} text - New text content
 * @returns {boolean} True if element found and updated
 */
export const setElementText = (selector: string, text: string): boolean => {
  const element = querySelector(selector);
  if (element) {
    element.textContent = text;
    return true;
  }
  return false;
};

/**
 * 🎯 HAS CLASS - Check if element has class
 *
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to check
 * @returns {boolean} True if element has class
 */
export const hasClass = (selector: string, className: string): boolean => {
  const element = querySelector(selector);
  return element ? element.classList.contains(className) : false;
};

/**
 * 🎯 SIMULATE CLICK - Simulate click event on element
 *
 * @param {string | HTMLElement} target - CSS selector ή element
 */
export const simulateClick = (target: string | HTMLElement): void => {
  const element = typeof target === 'string' ? querySelector(target) : target;
  if (element) {
    element.click();
  }
};
