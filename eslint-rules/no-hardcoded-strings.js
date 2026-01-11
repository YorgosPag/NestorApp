/**
 * ESLint rule to prevent hardcoded Greek/English strings
 * Detects string literals that should use i18n keys
 *
 * 🏢 ENTERPRISE: Follows SAP/Microsoft i18n enforcement patterns
 * Excludes: imports, requires, console.*, error messages, technical IDs
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent hardcoded user-facing strings',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedPatterns: {
            type: 'array',
            items: { type: 'string' },
          },
          ignoreAttributes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedPatterns = options.allowedPatterns || [
      '^[a-z][a-zA-Z0-9]*$', // camelCase identifiers
      '^[A-Z_][A-Z0-9_]*$',  // CONSTANT_CASE
      '^[0-9\\s\\-\\+\\(\\)]+$', // numbers, whitespace, basic punctuation
      '^#[0-9a-fA-F]{3,8}$', // hex colors
      '^\\.[a-zA-Z\\-]+$',   // CSS classes
      '^[a-z\\-]+$',         // kebab-case
    ];

    const ignoreAttributes = options.ignoreAttributes || [
      'className', 'id', 'key', 'testId', 'data-testid', 'aria-label'
    ];

    // Greek and extended Latin characters
    const greekPattern = /[Α-Ωα-ωάέήίόύώ]/;
    const userFacingPattern = /[Α-Ωα-ωάέήίόύώA-Za-z]{3,}/;

    /**
     * 🏢 ENTERPRISE: Check if node is inside an import/require context
     * This prevents false positives on module paths like 'next/server'
     */
    function isInImportOrRequireContext(node) {
      let current = node.parent;
      while (current) {
        // Import declarations: import { x } from 'module'
        if (current.type === 'ImportDeclaration') return true;
        // Export declarations: export { x } from 'module'
        if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportAllDeclaration') return true;
        // Require calls: require('module')
        if (current.type === 'CallExpression' &&
            current.callee &&
            current.callee.name === 'require') return true;
        // Dynamic imports: import('module')
        if (current.type === 'ImportExpression') return true;
        current = current.parent;
      }
      return false;
    }

    /**
     * 🏢 ENTERPRISE: Check if node is inside console.* call
     * Console logs are for developers, not user-facing
     */
    function isInConsoleCall(node) {
      let current = node.parent;
      while (current) {
        if (current.type === 'CallExpression' &&
            current.callee &&
            current.callee.type === 'MemberExpression' &&
            current.callee.object &&
            current.callee.object.name === 'console') {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * 🏢 ENTERPRISE: Check if string looks like a technical identifier
     * IDs, paths, API routes, etc.
     */
    function isTechnicalString(value) {
      // Safety check: ensure value is a string
      if (typeof value !== 'string') return false;

      // Next.js directives: "use client", "use server"
      if (/^use (client|server)$/.test(value)) return true;
      // Module paths: @/services/..., next/server, firebase/auth
      if (/^[@a-z][\w\-\/\.]+$/i.test(value)) return true;
      // File paths: ./foo, ../bar, /suppress-console.js
      if (/^\.{0,2}\/[\w\-\.\/]+$/.test(value)) return true;
      // URLs and protocols
      if (/^(https?:\/\/|mailto:|tel:)/.test(value)) return true;
      // MIME types
      if (/^(application|text|image|audio|video)\//.test(value)) return true;
      // HTTP methods
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(value)) return true;
      // Technical IDs with prefixes: bld_xxx, prj_xxx, etc.
      if (/^[a-z]{2,4}_[a-zA-Z0-9]+$/i.test(value)) return true;
      // Environment variables
      if (/^[A-Z][A-Z0-9_]+$/.test(value)) return true;
      // CSS class strings (Tailwind): contain only alphanumeric, hyphens, colons, slashes, brackets, spaces
      if (/^[\w\-\s\[\]\/\.:]+$/.test(value) && value.indexOf(' ') >= 0 && !greekPattern.test(value)) return true;
      return false;
    }

    function isAllowedString(value) {
      return allowedPatterns.some(pattern => new RegExp(pattern).test(value));
    }

    function checkStringLiteral(node) {
      const value = node.value;

      // Skip empty strings and single characters
      if (!value || value.length < 3) return;

      // 🏢 ENTERPRISE: Skip import/require contexts
      if (isInImportOrRequireContext(node)) return;

      // 🏢 ENTERPRISE: Skip console.* calls
      if (isInConsoleCall(node)) return;

      // 🏢 ENTERPRISE: Skip technical strings
      if (isTechnicalString(value)) return;

      // Skip if matches allowed patterns
      if (isAllowedString(value)) return;

      // Report if contains user-facing text
      if (userFacingPattern.test(value)) {
        context.report({
          node,
          message: `Hardcoded string "${value}" should use i18n key instead. Use t('namespace.key') pattern.`,
        });
      }
    }

    function checkTemplateLiteral(node) {
      // 🏢 ENTERPRISE: Skip template literals in console.* calls
      if (isInConsoleCall(node)) return;

      // 🏢 ENTERPRISE: Skip template literals in import/require contexts
      if (isInImportOrRequireContext(node)) return;

      // Check template literal quasis for hardcoded text
      node.quasis.forEach(quasi => {
        // Skip technical strings in templates
        if (isTechnicalString(quasi.value.raw)) return;

        if (quasi.value.raw.length >= 3 && userFacingPattern.test(quasi.value.raw)) {
          context.report({
            node: quasi,
            message: `Hardcoded template string should use i18n key instead. Consider t('key', {variables}).`,
          });
        }
      });
    }

    function checkJSXText(node) {
      const value = node.value.trim();
      if (value.length >= 3 && userFacingPattern.test(value)) {
        context.report({
          node,
          message: `Hardcoded JSX text "${value}" should use {t('namespace.key')} instead.`,
        });
      }
    }

    function checkJSXAttribute(node) {
      if (!node.value || node.value.type !== 'Literal') return;
      
      // Skip ignored attributes
      const attrName = node.name.name;
      if (ignoreAttributes.includes(attrName)) return;
      
      checkStringLiteral(node.value);
    }

    return {
      Literal: checkStringLiteral,
      TemplateLiteral: checkTemplateLiteral,
      JSXText: checkJSXText,
      JSXAttribute: checkJSXAttribute,
    };
  },
};