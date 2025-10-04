// Quick fix for missing lucide-react icon
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', 'arrow-down-to-dot.js');
const iconContent = `/**
 * @license lucide-react v0.263.1 - ISC
 */

import createLucideIcon from '../createLucideIcon.js';

const ArrowDownToDot = createLucideIcon("ArrowDownToDot", [
  ["path", { d: "m12 5v14", key: "1xy0gb" }],
  ["path", { d: "m19 12-7 7-7-7", key: "1m1v7v" }],
  ["circle", { cx: "12", cy: "21", r: "1", key: "1tgyze" }]
]);

export default ArrowDownToDot;`;

try {
  fs.writeFileSync(iconPath, iconContent);
  console.log('✅ Fixed missing lucide-react icon!');
} catch (error) {
  console.error('❌ Could not fix icon:', error.message);
}