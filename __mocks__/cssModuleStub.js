/**
 * Jest moduleNameMapper stub for CSS/SCSS/LESS modules.
 *
 * Mirrors `identity-obj-proxy`: any property access returns the accessed key
 * name as a string, so `import styles from './x.module.css'` yields
 * `styles.foo === 'foo'` inside tests. Self-contained (no external dependency)
 * so the test infra has no install-order coupling.
 */
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? false : String(key)),
  },
);
