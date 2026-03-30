/**
 * @fileoverview Patch all instances of @radix-ui/react-presence for React 19 compatibility
 *
 * Problem: react-presence@1.1.5 calls setNode(node) unconditionally in a ref callback,
 * causing infinite re-renders with React 19's stricter ref handling.
 * Fix: setNode((prev) => prev === node ? prev : node) — bail out if same node.
 *
 * Also patches @radix-ui/react-compose-refs useComposedRefs to use stable callback ref.
 *
 * This runs as postinstall to ensure ALL instances are patched (pnpm can create
 * multiple copies with different peer dependency contexts).
 *
 * @see https://github.com/radix-ui/primitives/issues/3241
 */

const fs = require('fs');
const path = require('path');

const PNPM_DIR = path.join(__dirname, '..', 'node_modules', '.pnpm');

function findAllFiles(dir, filename) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllFiles(fullPath, filename));
    } else if (entry.name === filename) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Patch react-presence ---
function patchPresence() {
  const presenceDir = path.join(PNPM_DIR);
  const dirs = fs.existsSync(presenceDir)
    ? fs.readdirSync(presenceDir).filter(d => d.startsWith('@radix-ui+react-presence@'))
    : [];

  let patched = 0;
  for (const dir of dirs) {
    for (const ext of ['index.mjs', 'index.js']) {
      const filePath = path.join(presenceDir, dir, 'node_modules', '@radix-ui', 'react-presence', 'dist', ext);
      if (!fs.existsSync(filePath)) continue;

      let content = fs.readFileSync(filePath, 'utf8');
      // Only patch if it has the unpatched pattern
      if (content.includes('setNode(node2);') && !content.includes('prev === node2')) {
        content = content.replace(
          /setNode\(node2\);/g,
          'setNode((prev) => prev === node2 ? prev : node2);'
        );
        fs.writeFileSync(filePath, content, 'utf8');
        patched++;
      }
    }
  }
  if (patched > 0) {
    console.log(`  ✅ Patched ${patched} react-presence files for React 19`);
  }
}

// --- Patch react-compose-refs ---
function patchComposeRefs() {
  const dirs = fs.existsSync(PNPM_DIR)
    ? fs.readdirSync(PNPM_DIR).filter(d => d.startsWith('@radix-ui+react-compose-refs@'))
    : [];

  let patched = 0;
  for (const dir of dirs) {
    for (const ext of ['index.mjs', 'index.js']) {
      const filePath = path.join(PNPM_DIR, dir, 'node_modules', '@radix-ui', 'react-compose-refs', 'dist', ext);
      if (!fs.existsSync(filePath)) continue;

      let content = fs.readFileSync(filePath, 'utf8');
      // Only patch if it has the old unstable pattern and NOT the fix
      if (content.includes('composeRefs(...refs), refs)') && !content.includes('refsRef')) {
        // Replace the unstable useComposedRefs with a stable version
        const oldPattern = 'return React.useCallback(composeRefs(...refs), refs);';
        const newCode = [
          'const refsRef = React.useRef(refs);',
          '  React.useEffect(() => {',
          '    refsRef.current = refs;',
          '  });',
          '  return React.useCallback((node) => {',
          '    refsRef.current.forEach((ref) => {',
          '      if (typeof ref === "function") {',
          '        ref(node);',
          '      } else if (ref !== null && ref !== void 0) {',
          '        ref.current = node;',
          '      }',
          '    });',
          '  }, []);',
        ].join('\n');

        content = content.replace(oldPattern, newCode);
        fs.writeFileSync(filePath, content, 'utf8');
        patched++;
      }
    }
  }
  if (patched > 0) {
    console.log(`  ✅ Patched ${patched} react-compose-refs files for React 19`);
  }
}

console.log('🔧 Radix UI React 19 compatibility patches...');
patchPresence();
patchComposeRefs();
console.log('🔧 Done.');
