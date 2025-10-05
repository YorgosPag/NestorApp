/**
 * 🌐 MINIMAL DOM ENVIRONMENT για Jest
 *
 * Δημιουργεί minimal DOM mocks χωρίς να χρειάζεται jsdom.
 * Αρκετό για integration tests που χρειάζονται CustomEvent, window, document.
 */

const NodeEnvironment = require('jest-environment-node').TestEnvironment;

class MinimalDOMEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);

    // Setup minimal window object
    this.global.window = this.global;

    // Setup minimal document
    this.global.document = {
      createElement: function(tagName) {
        return {
          tagName: tagName.toUpperCase(),
          style: {},
          setAttribute: function() {},
          getAttribute: function() { return null; },
          addEventListener: function() {},
          removeEventListener: function() {},
          appendChild: function() {},
          removeChild: function() {},
          querySelector: function() { return null; },
          querySelectorAll: function() { return []; }
        };
      },
      body: {
        appendChild: function() {},
        removeChild: function() {}
      },
      addEventListener: function() {},
      removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; }
    };

    // Setup CustomEvent
    this.global.CustomEvent = class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
        this.bubbles = options.bubbles || false;
        this.cancelable = options.cancelable || false;
      }
    };

    // Setup Event
    this.global.Event = class Event {
      constructor(type, options = {}) {
        this.type = type;
        this.bubbles = options.bubbles || false;
        this.cancelable = options.cancelable || false;
      }
    };

    // Setup event dispatching
    const eventListeners = new Map();

    this.global.addEventListener = (type, listener) => {
      if (!eventListeners.has(type)) {
        eventListeners.set(type, []);
      }
      eventListeners.get(type).push(listener);
    };

    this.global.removeEventListener = (type, listener) => {
      if (eventListeners.has(type)) {
        const listeners = eventListeners.get(type);
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };

    this.global.dispatchEvent = (event) => {
      if (eventListeners.has(event.type)) {
        const listeners = eventListeners.get(event.type);
        listeners.forEach(listener => listener(event));
      }
      return true;
    };

    // Setup Node (for DOM checks)
    this.global.Node = class Node {};

    // Setup HTMLElement (basic)
    this.global.HTMLElement = class HTMLElement {
      constructor() {
        this.style = {};
        this.className = '';
      }
    };

    // Setup HTMLCanvasElement (basic)
    this.global.HTMLCanvasElement = class HTMLCanvasElement extends this.global.HTMLElement {
      constructor() {
        super();
        this.width = 800;
        this.height = 600;
      }

      getContext() {
        return {
          canvas: this,
          save: () => {},
          restore: () => {},
          clearRect: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
          rect: () => {}
        };
      }

      getBoundingClientRect() {
        return {
          x: 0, y: 0,
          top: 0, left: 0,
          width: this.width,
          height: this.height,
          right: this.width,
          bottom: this.height
        };
      }

      toDataURL() {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      }
    };

    // Setup navigator
    this.global.navigator = {
      userAgent: 'Mozilla/5.0 (jsdom test environment)',
      platform: 'Win32'
    };

    // Setup location
    this.global.location = {
      href: 'http://localhost/',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: ''
    };

    // Setup performance
    if (!this.global.performance) {
      this.global.performance = {
        now: () => Date.now(),
        mark: () => {},
        measure: () => {}
      };
    }
  }

  async teardown() {
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
}

module.exports = MinimalDOMEnvironment;
