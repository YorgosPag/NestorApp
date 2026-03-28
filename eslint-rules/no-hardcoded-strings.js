/**
 * ESLint rule to prevent hardcoded Greek/English strings
 * Detects string literals that should use i18n keys
 *
 * 🏢 ENTERPRISE: Follows SAP/Microsoft i18n enforcement patterns
 * Excludes: imports, requires, console.*, error messages, technical IDs,
 *           CSS/Tailwind classes, throw/Error contexts, HTML attributes
 */
/* eslint-env node */
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

    // 🏢 ENTERPRISE: HTML/JS well-known constants that are NOT user-facing
    const WELL_KNOWN_CONSTANTS = new Set([
      // HTML target attributes
      '_blank', '_self', '_parent', '_top',
      // Intl.DateTimeFormat / NumberFormat options
      '2-digit', 'numeric', 'short', 'long', 'narrow', 'full',
      // Common HTML/DOM values
      'text', 'password', 'email', 'number', 'submit', 'button', 'reset',
      'checkbox', 'radio', 'hidden', 'file', 'search', 'tel', 'url',
      // CSS/layout
      'auto', 'none', 'block', 'inline', 'flex', 'grid',
      // Common technical terms
      'utf-8', 'base64', 'hex', 'ascii',
    ]);

    /**
     * 🏢 ENTERPRISE: Check if node is inside an import/require context
     */
    function isInImportOrRequireContext(node) {
      let current = node.parent;
      while (current) {
        if (current.type === 'ImportDeclaration') return true;
        if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportAllDeclaration') return true;
        if (current.type === 'CallExpression' &&
            current.callee &&
            current.callee.name === 'require') return true;
        if (current.type === 'ImportExpression') return true;
        current = current.parent;
      }
      return false;
    }

    /**
     * 🏢 ENTERPRISE: Check if node is inside a developer-only context
     * Covers: console.*, logger.*, t(), throw, new Error(), warn(), assert()
     */
    function isInDeveloperContext(node) {
      let current = node.parent;
      while (current) {
        // throw statements: throw new Error("...")
        if (current.type === 'ThrowStatement') return true;

        // new Error("..."), new TypeError("..."), etc.
        if (current.type === 'NewExpression' && current.callee) {
          const calleeName = current.callee.name;
          if (calleeName === 'Error' || calleeName === 'TypeError' ||
              calleeName === 'RangeError' || calleeName === 'ReferenceError' ||
              calleeName === 'SyntaxError') return true;
        }

        if (current.type === 'CallExpression' && current.callee) {
          // console.*, logger.* calls
          if (current.callee.type === 'MemberExpression' && current.callee.object) {
            const objectName = current.callee.object.name;
            if (objectName === 'console' || objectName === 'logger') return true;
          }
          // t() and i18n translation function calls (the keys inside t() are not user text)
          if (current.callee.type === 'Identifier') {
            const fnName = current.callee.name;
            if (fnName === 't' || fnName === 'warn' || fnName === 'assert') return true;
          }
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * 🏢 ENTERPRISE: Check if string looks like a technical identifier
     */
    function isTechnicalString(value) {
      if (typeof value !== 'string') return false;

      // Well-known HTML/JS constants
      if (WELL_KNOWN_CONSTANTS.has(value)) return true;

      // Next.js directives: "use client", "use server"
      if (/^use (client|server)$/.test(value)) return true;
      // Module paths: @/services/..., next/server, firebase/auth
      if (/^[@a-z][\w\-/.]+$/i.test(value)) return true;
      // File paths: ./foo, ../bar, /suppress-console.js
      if (/^\.{0,2}\/[\w\-./]+$/.test(value)) return true;
      // URLs and protocols
      if (/^(https?:\/\/|mailto:|tel:)/.test(value)) return true;
      // MIME types: application/pdf, image/jpeg, etc.
      if (/^(application|text|image|audio|video)\//.test(value)) return true;
      // HTTP methods
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(value)) return true;
      // Technical IDs with prefixes: bld_xxx, prj_xxx, etc.
      if (/^[a-z]{2,4}_[a-zA-Z0-9]+$/i.test(value)) return true;
      // Environment variables
      if (/^[A-Z][A-Z0-9_]+$/.test(value)) return true;
      // File accept patterns: ".dxf,.pdf,application/pdf,image/jpeg"
      if (/^[.,\w\-/]+$/.test(value) && value.includes(',') && (value.includes('.') || value.includes('/'))) return true;
      // Regex pattern strings: "/text-(\w+)-\d+/"
      if (/^\/.*\/$/.test(value)) return true;
      // CSS class strings (Tailwind): contain CSS-safe chars with indicators
      // Matches: "hover:opacity-90", "bg-[hsl(var(--bg-error))]", "[&>svg]:rotate-180"
      if (/^[\w\-\s[\]/.:()'=,>&*#~+@!%]+$/.test(value) && !greekPattern.test(value) && (/[:[(\]]/.test(value) || value.includes(' '))) return true;
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

      // 🏢 ENTERPRISE: Skip developer-only contexts (console, throw, Error, etc.)
      if (isInDeveloperContext(node)) return;

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
      // 🏢 ENTERPRISE: Skip template literals in developer contexts
      if (isInDeveloperContext(node)) return;

      // 🏢 ENTERPRISE: Skip template literals in import/require contexts
      if (isInImportOrRequireContext(node)) return;

      // Check template literal quasis for hardcoded text
      node.quasis.forEach(quasi => {
        // Skip technical strings in templates
        if (isTechnicalString(quasi.value.raw)) return;

        // Skip ID/slug segments like "-form-item", "-description", "/path"
        if (/^[\w\-/.:]+$/.test(quasi.value.raw) && !greekPattern.test(quasi.value.raw)) return;

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
