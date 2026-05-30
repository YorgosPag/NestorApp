/**
 * Jest moduleNameMapper stub for static asset imports (images, svg, etc.).
 * Returns a stable string so components importing assets render in jsdom
 * without the bundler. Standard jest file-mock pattern.
 */
module.exports = 'test-file-stub';
