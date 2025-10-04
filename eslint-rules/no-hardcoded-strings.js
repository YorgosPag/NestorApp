/**
 * ESLint rule to prevent hardcoded Greek/English strings
 * Detects string literals that should use i18n keys
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

    function isAllowedString(value) {
      return allowedPatterns.some(pattern => new RegExp(pattern).test(value));
    }

    function checkStringLiteral(node) {
      const value = node.value;
      
      // Skip empty strings and single characters
      if (!value || value.length < 3) return;
      
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
      // Check template literal quasis for hardcoded text
      node.quasis.forEach(quasi => {
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