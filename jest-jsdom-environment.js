/**
 * 🌐 CUSTOM JSDOM ENVIRONMENT για Jest
 *
 * Χρησιμοποιεί το υπάρχον jsdom package αντί να εγκαταστήσουμε
 * το jest-environment-jsdom (που timeout-άρει).
 *
 * Βασισμένο στο official jest-environment-jsdom implementation.
 */

const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const JSDOMEnvironment = require('jest-environment-node').TestEnvironment;

class CustomJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    // Create JSDOM instance
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost/',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
      resources: 'usable',
    });

    // Setup global environment
    this.global.window = dom.window;
    this.global.document = dom.window.document;
    this.global.navigator = dom.window.navigator;
    this.global.HTMLElement = dom.window.HTMLElement;
    this.global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    this.global.CustomEvent = dom.window.CustomEvent;
    this.global.Event = dom.window.Event;
    this.global.Node = dom.window.Node;

    // Copy all DOM globals
    Object.keys(dom.window).forEach((property) => {
      if (typeof this.global[property] === 'undefined') {
        this.global[property] = dom.window[property];
      }
    });

    this.dom = dom;
  }

  async teardown() {
    if (this.dom) {
      this.dom.window.close();
    }
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
}

module.exports = CustomJSDOMEnvironment;
