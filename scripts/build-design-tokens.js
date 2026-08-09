/**
 * 🏢 ENTERPRISE DESIGN TOKEN GENERATOR
 *
 * Fortune 500-class automated design token generation system.
 * Converts design-tokens.json → CSS Variables, TypeScript types, Tailwind config.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @version 2.0.0 - Enterprise Automation
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - Enterprise Standards
// ============================================================================

const CONFIG = {
  input: {
    tokens: path.resolve(__dirname, '../design-tokens.json')
  },
  output: {
    css: path.resolve(__dirname, '../src/styles/design-system/generated'),
    typescript: path.resolve(__dirname, '../src/styles/design-tokens/generated'),
    tailwind: path.resolve(__dirname, '../tailwind.tokens.js')
  }
};

// ============================================================================
// UTILITIES - Token Processing
// ============================================================================

/**
 * Resolve token references (e.g., {color.brand.primary.500})
 */
function resolveTokenReferences(value, tokens) {
  if (typeof value !== 'string') return value;

  const referenceRegex = /\{([^}]+)\}/g;
  return value.replace(referenceRegex, (match, path) => {
    const keys = path.split('.');
    let resolved = tokens;

    for (const key of keys) {
      resolved = resolved?.[key];
    }

    return resolved?.value || match;
  });
}

/**
 * Flatten nested tokens into flat structure
 */
function flattenTokens(obj, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const currentKey = prefix ? `${prefix}-${key}` : key;

    if (value && typeof value === 'object' && value.value !== undefined) {
      // This is a token with a value
      result[currentKey] = value;
    } else if (value && typeof value === 'object') {
      // This is a nested object, flatten it
      flattenTokens(value, currentKey, result);
    }
  }

  return result;
}

/**
 * Convert to kebab-case for CSS variables
 */
function toKebabCase(str) {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Format value for CSS (add units where needed)
 */
function formatCSSValue(value, type) {
  if (type === 'spacing' || type === 'borderRadius') {
    return isNaN(value) ? value : `${value}px`;
  }
  if (type === 'fontSizes') {
    return isNaN(value) ? value : `${value}px`;
  }
  if (type === 'fontWeights') {
    return value;
  }
  if (type === 'duration') {
    return value;
  }
  // 🏢 ENTERPRISE: z-index values are unitless integers
  if (type === 'zIndex') {
    return value;
  }
  return value;
}

// ============================================================================
// GENERATORS - Output Generation
// ============================================================================

/**
 * Generate CSS Variables
 */
function generateCSS(tokens) {
  const flattened = flattenTokens(tokens);
  let css = `/**
 * 🤖 AUTO-GENERATED CSS VARIABLES
 *
 * Generated από design-tokens.json
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 *
 * Build command: npm run build:tokens
 * Source: design-tokens.json
 */

:root {\n`;

  // Generate CSS custom properties
  for (const [key, token] of Object.entries(flattened)) {
    if (token.value) {
      const cssVar = `--${toKebabCase(key)}`;
      const resolvedValue = resolveTokenReferences(token.value, tokens);
      const formattedValue = formatCSSValue(resolvedValue, token.type);
      css += `  ${cssVar}: ${formattedValue};\n`;
    }
  }

  css += `}\n\n`;

  // Generate utility classes για performance components
  css += `/* 🏢 ENTERPRISE UTILITY CLASSES - Auto-Generated */\n\n`;

  css += `.performance-success {\n`;
  css += `  background-color: var(--performance-component-success-background);\n`;
  css += `  color: var(--color-semantic-success);\n`;
  css += `  border-color: var(--performance-component-success-border);\n`;
  css += `}\n\n`;

  css += `.performance-warning {\n`;
  css += `  background-color: var(--performance-component-warning-background);\n`;
  css += `  color: var(--color-semantic-warning);\n`;
  css += `  border-color: var(--performance-component-warning-border);\n`;
  css += `}\n\n`;

  css += `.performance-error {\n`;
  css += `  background-color: var(--performance-component-error-background);\n`;
  css += `  color: var(--color-semantic-error);\n`;
  css += `  border-color: var(--performance-component-error-border);\n`;
  css += `}\n\n`;

  css += `.performance-info {\n`;
  css += `  background-color: var(--performance-component-info-background);\n`;
  css += `  color: var(--color-semantic-info);\n`;
  css += `  border-color: var(--performance-component-info-border);\n`;
  css += `}\n\n`;

  css += `.performance-card {\n`;
  css += `  background-color: var(--performance-component-card-background);\n`;
  css += `  border: 1px solid var(--performance-component-card-border);\n`;
  css += `  border-radius: var(--border-radius-lg);\n`;
  css += `  padding: var(--performance-component-card-padding);\n`;
  css += `}\n`;

  return css;
}

/**
 * Generate TypeScript types
 */
function generateTypeScript(tokens) {
  const flattened = flattenTokens(tokens);

  let ts = `/**
 * 🤖 AUTO-GENERATED TYPESCRIPT TYPES
 *
 * Generated από design-tokens.json
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 */

export interface DesignTokens {\n`;

  for (const [key, token] of Object.entries(flattened)) {
    if (token.value) {
      const tsKey = key.replace(/-/g, '_');
      ts += `  ${tsKey}: string;\n`;
    }
  }

  ts += `}\n\n`;

  ts += `export const designTokens: DesignTokens = {\n`;
  for (const [key, token] of Object.entries(flattened)) {
    if (token.value) {
      const tsKey = key.replace(/-/g, '_');
      const cssVar = `var(--${toKebabCase(key)})`;
      ts += `  ${tsKey}: '${cssVar}',\n`;
    }
  }
  ts += `};\n\n`;

  ts += `export default designTokens;\n\n`;
  ts += generateZIndexScale(tokens);

  return ts;
}

/**
 * Ο ΑΡΙΘΜΗΤΙΚΟΣ πίνακας z-index — η μία αυθεντία για τη σειρά στρώσης.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `designTokens`: εκείνο δίνει `'var(--z-index-toast)'`,
 * δηλαδή **συμβολοσειρά για CSS**. Ο κώδικας όμως κάνει **αριθμητική** πάνω στη σειρά
 * (`DxfZIndexSystem.styles.ts` γράφει `globalZIndex.modal + 10`), και μια συμβολοσειρά
 * `var(...)` δεν προσθέτεται. Γι' αυτό το `styles/design-tokens/modules/layout.ts`
 * κρατούσε **χειρόγραφο αντίγραφο** των ίδιων αριθμών με το σχόλιο «Synced with
 * design-tokens.json» — και **τίποτα δεν επέβαλλε αυτόν τον συγχρονισμό**. Δύο αλήθειες
 * για το ίδιο ερώτημα, η μία αναγκασμένη να πέσει έξω σιωπηλά (σχήμα ADR-749).
 *
 * ⚠️ Οι τιμές είναι **ακέραιοι**, όχι συμβολοσειρές: το `z-index` του CSS είναι
 * `<integer>`, και ένας αριθμός επιτρέπει στον μεταγλωττιστή να ελέγξει τη σύγκριση.
 *
 * ⚠️ Η **σειρά** των κλειδιών είναι η σειρά του `design-tokens.json` — και είναι
 * **συμβόλαιο**, όχι αισθητική: το CHECK 3.50 απαιτεί μονότονη αύξηση, ώστε ένας νέος
 * ρόλος να μην μπορεί να μπει σε λάθος σκαλί χωρίς να μπλοκάρει.
 */
function generateZIndexScale(tokens) {
  const scale = tokens.zIndex || {};
  let ts = `/**\n * 🤖 AUTO-GENERATED — η ΜΙΑ αριθμητική κλίμακα z-index.\n`;
  ts += ` * Πηγή: design-tokens.json ▸ zIndex.  Εντολή: npm run build:tokens\n`;
  ts += ` * ΜΗΝ γράψεις δεύτερη κλίμακα δίπλα σε αυτή — δες CHECK 3.50.\n */\n`;
  ts += `export const zIndexScale = {\n`;
  for (const [key, token] of Object.entries(scale)) {
    if (!token || typeof token !== 'object' || token.value === undefined) continue;
    ts += `  /** ${token.description || ''} */\n`;
    ts += `  ${key}: ${Number(token.value)},\n`;
  }
  ts += `} as const;\n\n`;
  ts += `export type ZIndexRole = keyof typeof zIndexScale;\n`;
  return ts;
}

/**
 * Generate Tailwind Config Extension
 */
function generateTailwindConfig(tokens) {
  let config = `/**
 * 🤖 AUTO-GENERATED TAILWIND CONFIG EXTENSION
 *
 * Generated από design-tokens.json
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 */

module.exports = {
  theme: {
    extend: {
      colors: {\n`;

  // Generate performance colors
  config += `        performance: {\n`;
  config += `          success: {\n`;
  config += `            DEFAULT: 'var(--color-semantic-success)',\n`;
  config += `            bg: 'var(--performance-component-success-background)',\n`;
  config += `            border: 'var(--performance-component-success-border)',\n`;
  config += `            hover: 'var(--performance-component-success-hover)'\n`;
  config += `          },\n`;
  config += `          warning: {\n`;
  config += `            DEFAULT: 'var(--color-semantic-warning)',\n`;
  config += `            bg: 'var(--performance-component-warning-background)',\n`;
  config += `            border: 'var(--performance-component-warning-border)',\n`;
  config += `            hover: 'var(--performance-component-warning-hover)'\n`;
  config += `          },\n`;
  config += `          error: {\n`;
  config += `            DEFAULT: 'var(--color-semantic-error)',\n`;
  config += `            bg: 'var(--performance-component-error-background)',\n`;
  config += `            border: 'var(--performance-component-error-border)',\n`;
  config += `            hover: 'var(--performance-component-error-hover)'\n`;
  config += `          },\n`;
  config += `          info: {\n`;
  config += `            DEFAULT: 'var(--color-semantic-info)',\n`;
  config += `            bg: 'var(--performance-component-info-background)',\n`;
  config += `            border: 'var(--performance-component-info-border)',\n`;
  config += `            hover: 'var(--performance-component-info-hover)'\n`;
  config += `          }\n`;
  config += `        }\n`;
  config += `      },\n`;
  config += `      spacing: {\n`;
  config += `        'performance-xs': 'var(--spacing-component-gap-xs)',\n`;
  config += `        'performance-sm': 'var(--spacing-component-gap-sm)',\n`;
  config += `        'performance-md': 'var(--spacing-component-gap-md)',\n`;
  config += `        'performance-lg': 'var(--spacing-component-gap-lg)'\n`;
  config += `      },\n`;
  config += `      fontSize: {\n`;
  config += `        'performance-xs': 'var(--typography-font-size-xs)',\n`;
  config += `        'performance-sm': 'var(--typography-font-size-sm)'\n`;
  config += `      }\n`;
  config += `    }\n`;
  config += `  }\n`;
  config += `};\n`;

  return config;
}

// ============================================================================
// MAIN EXECUTION - Build Pipeline
// ============================================================================

function main() {
  console.log('🏢 Enterprise Design Token Generator v2.0.0');
  console.log('============================================\n');

  try {
    // Load tokens
    console.log('📖 Loading design-tokens.json...');
    const tokensData = JSON.parse(fs.readFileSync(CONFIG.input.tokens, 'utf8'));

    // Ensure output directories exist
    if (!fs.existsSync(CONFIG.output.css)) {
      fs.mkdirSync(CONFIG.output.css, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.output.typescript)) {
      fs.mkdirSync(CONFIG.output.typescript, { recursive: true });
    }

    // Generate CSS
    console.log('🎨 Generating CSS Variables...');
    const css = generateCSS(tokensData);
    fs.writeFileSync(path.join(CONFIG.output.css, 'variables.css'), css);

    // Generate TypeScript
    console.log('📝 Generating TypeScript types...');
    const ts = generateTypeScript(tokensData);
    fs.writeFileSync(path.join(CONFIG.output.typescript, 'tokens.ts'), ts);

    // Generate Tailwind config
    console.log('🎯 Generating Tailwind config...');
    const tailwind = generateTailwindConfig(tokensData);
    fs.writeFileSync(CONFIG.output.tailwind, tailwind);

    console.log('\n✅ Design tokens generated successfully!');
    console.log('📁 Files created:');
    console.log(`   - ${path.relative(process.cwd(), path.join(CONFIG.output.css, 'variables.css'))}`);
    console.log(`   - ${path.relative(process.cwd(), path.join(CONFIG.output.typescript, 'tokens.ts'))}`);
    console.log(`   - ${path.relative(process.cwd(), CONFIG.output.tailwind)}`);
    console.log('\n🚀 Ready for production!');

  } catch (error) {
    console.error('❌ Error generating design tokens:', error.message);
    process.exit(1);
  }
}

// Run the generator
if (require.main === module) {
  if (process.argv.includes('--watch')) {
    // Initial build
    main();

    const DEBOUNCE_MS = 300;
    let debounceTimer = null;
    let isBuilding = false;

    console.log('\n[Watch] Monitoring design-tokens.json for changes...');
    console.log('[Watch] Press Ctrl+C to stop\n');

    fs.watch(CONFIG.input.tokens, { persistent: true }, (_eventType, filename) => {
      if (isBuilding) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        isBuilding = true;
        console.log(`[Watch] Change detected: ${filename || 'design-tokens.json'}`);
        try {
          main();
          console.log('[Watch] Tokens rebuilt successfully\n');
        } catch (error) {
          console.error('[Watch] Rebuild failed:', error.message);
        } finally {
          isBuilding = false;
        }
      }, DEBOUNCE_MS);
    });
  } else {
    main();
  }
}

module.exports = { main, generateCSS, generateTypeScript, generateTailwindConfig, generateZIndexScale };