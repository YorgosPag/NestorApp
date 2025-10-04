// ESLint Plugin for Design System Compliance
// Provides custom rules to enforce design token usage

const rules = require('./rules/design-system-rules');

module.exports = {
  rules,
  configs: {
    recommended: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-colors': 'error',
        'design-system/no-hardcoded-spacing': 'warn',
        'design-system/prefer-design-system-imports': 'warn',
        'design-system/enforce-semantic-colors': 'warn'
      }
    },
    strict: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-colors': 'error',
        'design-system/no-hardcoded-spacing': 'error',
        'design-system/prefer-design-system-imports': 'error',
        'design-system/enforce-semantic-colors': 'error'
      }
    }
  }
};