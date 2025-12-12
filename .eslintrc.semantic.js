/**
 * 🔍 SEMANTIC HTML ESLINT CONFIGURATION
 *
 * ESLint configuration για enforcement των semantic HTML best practices
 * που εφαρμόσαμε στο project μετά την επιτυχή DIV-SOUP elimination.
 *
 * Usage:
 * - Add to main .eslintrc.js: extends: ['./.eslintrc.semantic.js']
 * - Or run directly: npx eslint --config .eslintrc.semantic.js src/
 */

module.exports = {
  extends: [
    'plugin:jsx-a11y/recommended'
  ],
  plugins: [
    'jsx-a11y',
    'react-hooks'
  ],
  rules: {
    // ============================================================================
    // ACCESSIBILITY & SEMANTIC HTML ENFORCEMENT
    // ============================================================================

    // 🔴 CRITICAL: ARIA and accessibility requirements
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',

    // 🟡 IMPORTANT: Navigation and landmark requirements
    'jsx-a11y/no-redundant-roles': 'warn',
    'jsx-a11y/landmark-accessibility-tree': 'off', // Enable when available

    // 🟢 RECOMMENDED: Interactive element requirements
    'jsx-a11y/interactive-supports-focus': 'error',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',

    // 🔴 CRITICAL: Form and input accessibility
    'jsx-a11y/label-has-associated-control': 'error',
    'jsx-a11y/form-has-label': 'warn',

    // 🟡 IMPORTANT: Image and media accessibility
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/media-has-caption': 'warn',

    // 🟢 RECOMMENDED: Keyboard navigation
    'jsx-a11y/no-access-key': 'warn',
    'jsx-a11y/tabindex-no-positive': 'error',

    // ============================================================================
    // SEMANTIC HTML STRUCTURE RULES
    // ============================================================================

    // 🔴 CRITICAL: Heading structure
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/no-distracting-elements': 'error',

    // 🟡 IMPORTANT: List semantics
    'jsx-a11y/no-redundant-roles': ['warn', {
      nav: ['navigation'],
      button: ['button'],
      article: ['article'],
      main: ['main'],
      section: ['region']
    }],

    // ============================================================================
    // REACT HOOKS & COMPONENT PATTERNS
    // ============================================================================

    // 🔴 CRITICAL: React hooks rules (για semantic hooks)
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn'
  },

  // ============================================================================
  // CUSTOM OVERRIDES FOR SPECIFIC PATTERNS
  // ============================================================================

  overrides: [
    {
      // 🎯 CRM Components: Stricter rules για contact/lead components
      files: [
        'src/components/crm/**/*.{tsx,jsx}',
        'src/components/leads/**/*.{tsx,jsx}',
        'src/components/contacts/**/*.{tsx,jsx}'
      ],
      rules: {
        // Require ARIA labels για navigation sections
        'jsx-a11y/aria-label': 'off', // Custom rule needed
        'jsx-a11y/interactive-supports-focus': 'error',

        // TODO: Custom rules για Schema.org requirements
        // 'semantic-html/contact-schema-required': 'error',
        // 'semantic-html/person-microdata-required': 'error'
      }
    },
    {
      // 🎯 Dashboard Components: Focus on navigation semantics
      files: [
        'src/components/crm/dashboard/**/*.{tsx,jsx}',
        'src/app/**/dashboard/**/*.{tsx,jsx}'
      ],
      rules: {
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/landmark-accessibility-tree': 'off'

        // TODO: Custom rules για dashboard patterns
        // 'semantic-html/dashboard-navigation-required': 'error',
        // 'semantic-html/widget-labeling-required': 'error'
      }
    },
    {
      // 🎯 Page Components: Require proper landmark structure
      files: [
        'src/app/**page.{tsx,jsx}',
        'src/pages/**/*.{tsx,jsx}'
      ],
      rules: {
        // TODO: Custom rules για page structure
        // 'semantic-html/main-element-required': 'error',
        // 'semantic-html/navigation-landmarks-required': 'error',
        // 'semantic-html/heading-hierarchy': 'error'
      }
    }
  ],

  // ============================================================================
  // SEMANTIC HTML CUSTOM RULES (PLACEHOLDER)
  // ============================================================================

  // TODO: Implement custom ESLint rules για semantic HTML patterns
  // Αυτές οι rules θα χρειαστούν custom implementation
  settings: {
    'semantic-html': {
      // Configuration for custom semantic HTML rules
      enforceSchemaOrg: true,
      requireAriaLabels: ['nav', 'section', 'aside'],
      preferredElements: {
        // Mappings από common class patterns σε semantic elements
        'card': 'article',
        'header': 'header',
        'navigation': 'nav',
        'sidebar': 'aside',
        'main-content': 'main',
        'contact-info': 'address',
        'action-buttons': 'nav',
        'item-list': 'ul'
      }
    }
  }
};

// ============================================================================
// CUSTOM SEMANTIC HTML RULES IMPLEMENTATION NOTES
// ============================================================================

/*
CUSTOM RULES TO IMPLEMENT:

1. 🎯 semantic-html/prefer-semantic-elements
   - Detect className patterns που suggest semantic elements
   - Suggest: <div className="card"> → <article>
   - Suggest: <div className="nav"> → <nav>

2. 🎯 semantic-html/require-aria-labels
   - Enforce aria-label ή aria-labelledby για navigation, sections
   - Require: <nav aria-label="..."> or <nav aria-labelledby="...">

3. 🎯 semantic-html/contact-schema-required
   - Detect contact/person components
   - Require: itemScope, itemType, itemProp for Schema.org

4. 🎯 semantic-html/no-excessive-divs
   - Count div elements per component
   - Warn when > threshold (configurable)
   - Suggest semantic alternatives

5. 🎯 semantic-html/list-semantics
   - Detect array.map() patterns
   - Suggest: <ul> + <li> instead of repeated <div>

6. 🎯 semantic-html/navigation-semantics
   - Detect button groups που act as navigation
   - Require: <nav> wrapper με aria-label

IMPLEMENTATION APPROACH:

```javascript
// Example custom rule implementation
module.exports = {
  rules: {
    'prefer-semantic-elements': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prefer semantic HTML elements over generic divs',
          category: 'Best Practices'
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          JSXElement(node) {
            if (node.openingElement.name.name === 'div') {
              const classNames = getClassNames(node);
              const suggestedElement = getSuggestedElement(classNames);

              if (suggestedElement) {
                context.report({
                  node,
                  message: `Consider using <${suggestedElement}> instead of <div>`,
                  fix: fixer => fixer.replaceText(node.openingElement.name, suggestedElement)
                });
              }
            }
          }
        };
      }
    }
  }
};
```

USAGE INSTRUCTIONS:

1. Install dependencies:
   ```bash
   npm install --save-dev eslint-plugin-jsx-a11y
   ```

2. Add to main ESLint config:
   ```json
   {
     "extends": ["./.eslintrc.semantic.js"]
   }
   ```

3. Run semantic HTML linting:
   ```bash
   npx eslint --config .eslintrc.semantic.js src/components/crm/
   ```

4. Auto-fix where possible:
   ```bash
   npx eslint --config .eslintrc.semantic.js --fix src/
   ```

INTEGRATION με CI/CD:

```yaml
# .github/workflows/semantic-html-check.yml
name: Semantic HTML Check
on: [push, pull_request]
jobs:
  semantic-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx eslint --config .eslintrc.semantic.js src/
      - run: node scripts/div-soup-detector.js src/
```
*/