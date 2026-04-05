/**
 * =============================================================================
 * ESLint Rule: no-i18n-defaultvalue-literals (CLAUDE.md SOS. N.11)
 * =============================================================================
 *
 * Flags the `defaultValue: 'literal text'` anti-pattern in i18n `t()` calls.
 * Forces SSoT: every i18n key must live in `src/i18n/locales/{el,en}/*.json`
 * rather than having a hardcoded Greek/English fallback in the source code.
 *
 * Allowed:
 *   t('key')
 *   t('key', { defaultValue: '' })           — explicitly empty (safe fallback)
 *   t('key', { defaultValue: someVariable }) — computed, not a literal
 *   t('key', { defaultValue: `${x} items` }) — template literal, dynamic
 *
 * Blocked:
 *   t('key', { defaultValue: 'Some Greek text' })
 *   t('key', { defaultValue: "Add New Project" })
 *   t('key', { defaultValue: 'non-empty literal' })
 *
 * @module eslint-rules/no-i18n-defaultvalue-literals
 */

'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid hardcoded string literals in i18n defaultValue options (CLAUDE.md SOS. N.11)',
      category: 'i18n',
      recommended: true,
    },
    schema: [],
    messages: {
      hardcodedDefaultValue:
        'Hardcoded defaultValue "{{value}}" violates SSoT (CLAUDE.md N.11). ' +
        'Add the key to src/i18n/locales/{el,en}/*.json and drop the defaultValue ' +
        '(or use an empty string).',
    },
  },

  create(context) {
    /** Reports a property node that carries a hardcoded defaultValue string. */
    function reportProperty(propertyNode, value) {
      context.report({
        node: propertyNode,
        messageId: 'hardcodedDefaultValue',
        data: { value: String(value).slice(0, 60) },
      });
    }

    return {
      Property(node) {
        // Only care about `defaultValue: ...`
        const keyIsDefaultValue =
          (node.key.type === 'Identifier' && node.key.name === 'defaultValue') ||
          (node.key.type === 'Literal' && node.key.value === 'defaultValue');
        if (!keyIsDefaultValue) return;

        const value = node.value;

        // Literal string: defaultValue: 'text' / "text"
        if (value.type === 'Literal' && typeof value.value === 'string') {
          if (value.value.length > 0) {
            reportProperty(node, value.value);
          }
          return;
        }

        // Template literal with NO expressions: defaultValue: `text`
        if (
          value.type === 'TemplateLiteral' &&
          value.expressions.length === 0 &&
          value.quasis.length === 1
        ) {
          const raw = value.quasis[0].value.cooked;
          if (raw && raw.length > 0) {
            reportProperty(node, raw);
          }
        }
      },
    };
  },
};
